import "dotenv/config";
import Fastify from "fastify";
import websocket from "@fastify/websocket";
import { Counter, Gauge, register, collectDefaultMetrics } from "prom-client";
import { connect as natsConnect, publishCallEvent, deliverWebhook } from "@opentel/events";
import { verifyToken } from "@opentel/auth";
import { transitionCallState } from "@opentel/core";
import {
  getDb,
  getRedis,
  createCall,
  updateCallState,
  getCall,
  getTenant,
  setPresence,
} from "@opentel/storage";
import { DialMessageSchema } from "@opentel/schemas";

const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/opentel";
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const natsUrl = process.env.NATS_URL || "nats://localhost:4222";
const jwtSecret = process.env.JWT_SECRET || "dev-secret";
const port = Number(process.env.SIGNALING_PORT) || 3001;

const db = getDb(dbUrl);
getRedis(redisUrl);

await natsConnect(natsUrl);

collectDefaultMetrics();
const wsConnectionsGauge = new Gauge({
  name: "opentel_ws_connections_total",
  help: "Active WebSocket connections",
});
const callsCreatedCounter = new Counter({
  name: "opentel_calls_created_total",
  help: "Total calls created",
});
const callsEndedCounter = new Counter({
  name: "opentel_calls_ended_total",
  help: "Total calls ended",
});

const app = Fastify({ logger: true });

app.register(websocket);

app.get("/metrics", async (_req, reply) => {
  reply.header("Content-Type", register.contentType);
  return reply.send(await register.metrics());
});

const sockets = new Map<string, { ws: WebSocket; tenantId: string }>();

function send(ws: WebSocket, msg: object) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}

app.get("/ws", { websocket: true }, (conn, req) => {
  let tenantId: string | null = null;
  let endpointId: string | null = null;

  conn.socket.on("message", async (data: Buffer) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === "auth") {
        const payload = verifyToken(jwtSecret, msg.token);
        tenantId = payload.tenantId;
        conn.socket.send(JSON.stringify({ type: "auth_ok" }));
        return;
      }
      if (msg.type === "register") {
        if (!tenantId) {
          conn.socket.send(JSON.stringify({ type: "error", message: "Auth first" }));
          return;
        }
        const eidReg = msg.endpointId;
        if (!eidReg || typeof eidReg !== "string") {
          conn.socket.send(JSON.stringify({ type: "error", message: "Invalid endpointId" }));
          return;
        }
        endpointId = eidReg;
        sockets.set(eidReg, { ws: conn.socket, tenantId });
        wsConnectionsGauge.set(sockets.size);
        await setPresence(eidReg, true);
        conn.socket.send(JSON.stringify({ type: "registered" }));
        return;
      }

      if (!tenantId || !endpointId) {
        conn.socket.send(JSON.stringify({ type: "error", message: "Auth and register first" }));
        return;
      }

      const tid = tenantId;
      const eid = endpointId;

      if (msg.type === "dial") {
        const parsed = DialMessageSchema.safeParse(msg);
        if (!parsed.success) {
          conn.socket.send(JSON.stringify({ type: "error", message: "Invalid dial" }));
          return;
        }
        const { toEndpointId, metadata } = parsed.data;
        const call = await createCall(db, tid, eid, toEndpointId, metadata);
        callsCreatedCounter.inc();
        await updateCallState(db, call.id, "RINGING");

        const ts = new Date().toISOString();
        await publishCallEvent({ event: "call.created", callId: call.id, tenantId: tid, fromEndpointId: eid, toEndpointId, metadata, ts });
        await publishCallEvent({ event: "call.ringing", callId: call.id, ts });

        const callee = sockets.get(toEndpointId);
        if (callee) {
          send(callee.ws, { type: "incoming_call", callId: call.id, fromEndpointId: eid, metadata, ts });
        }
        send(conn.socket, { type: "call_created", callId: call.id, state: "RINGING" });

        const tenant = await getTenant(db, tid);
        if (tenant?.webhook_url) {
          deliverWebhook(tenant.webhook_url, "call.created", { callId: call.id, tenantId: tid, fromEndpointId: eid, toEndpointId, metadata });
          deliverWebhook(tenant.webhook_url, "call.ringing", { callId: call.id });
        }
        return;
      }

      if (msg.type === "answer") {
        const callId = msg.callId;
        const sdp = msg.sdp;
        const call = await getCall(db, callId);
        if (!call || call.tenant_id !== tid) {
          conn.socket.send(JSON.stringify({ type: "error", message: "Call not found" }));
          return;
        }
        const next = transitionCallState(call.state as "CREATED" | "RINGING" | "ANSWERED" | "ENDED", "ANSWER");
        if (!next) {
          conn.socket.send(JSON.stringify({ type: "error", message: "Invalid state transition" }));
          return;
        }
        await updateCallState(db, callId, next, new Date());

        const ts = new Date().toISOString();
        await publishCallEvent({ event: "call.answered", callId, ts });
        await publishCallEvent({ event: "signaling.answer", callId, sdp, ts });

        const caller = sockets.get(call.from_endpoint_id);
        if (caller) send(caller.ws, { type: "answer", callId, sdp, ts });

        const tenant = await getTenant(db, tid);
        if (tenant?.webhook_url) deliverWebhook(tenant.webhook_url, "call.answered", { callId });

        send(conn.socket, { type: "call_answered", callId });
        return;
      }

      if (msg.type === "offer") {
        const callId = msg.callId;
        const sdp = msg.sdp;
        const call = await getCall(db, callId);
        if (!call || call.tenant_id !== tid) return;
        const callee = sockets.get(call.to_endpoint_id);
        if (callee) send(callee.ws, { type: "offer", callId, sdp, ts: new Date().toISOString() });
        await publishCallEvent({ event: "signaling.offer", callId, sdp, ts: new Date().toISOString() });
        return;
      }

      if (msg.type === "ice") {
        const callId = msg.callId;
        const candidate = msg.candidate;
        const call = await getCall(db, callId);
        if (!call || call.tenant_id !== tid) return;
        const otherId = call.from_endpoint_id === eid ? call.to_endpoint_id : call.from_endpoint_id;
        const other = sockets.get(otherId);
        if (other) send(other.ws, { type: "ice", callId, candidate, ts: new Date().toISOString() });
        await publishCallEvent({ event: "signaling.ice", callId, candidate, ts: new Date().toISOString() });
        return;
      }

      if (msg.type === "hangup") {
        const callId = msg.callId;
        const call = await getCall(db, callId);
        if (!call || call.tenant_id !== tid) return;
        const next = transitionCallState(call.state as "CREATED" | "RINGING" | "ANSWERED" | "ENDED", "HANGUP");
        if (!next) return;
        callsEndedCounter.inc();
        await updateCallState(db, callId, next);

        const duration = call.answered_at
          ? Math.floor((Date.now() - new Date(call.answered_at).getTime()) / 1000)
          : undefined;
        const ts = new Date().toISOString();
        await publishCallEvent({ event: "call.ended", callId, reason: "hangup", duration, metadata: call.metadata ?? undefined, ts });

        const otherId = call.from_endpoint_id === endpointId ? call.to_endpoint_id : call.from_endpoint_id;
        const other = sockets.get(otherId);
        if (other) send(other.ws, { type: "hangup", callId, reason: "hangup", ts });

        const tenant = await getTenant(db, tid);
        if (tenant?.webhook_url) deliverWebhook(tenant.webhook_url, "call.ended", { callId, reason: "hangup", duration, metadata: call.metadata });

        send(conn.socket, { type: "call_ended", callId });
        return;
      }
    } catch (e) {
      conn.socket.send(JSON.stringify({ type: "error", message: String(e) }));
    }
  });

  conn.socket.on("close", () => {
    if (endpointId) {
      sockets.delete(endpointId);
      wsConnectionsGauge.set(sockets.size);
      setPresence(endpointId, false);
    }
  });
});

app.listen({ port, host: "0.0.0.0" }, (err) => {
  if (err) throw err;
  console.log(`Signaling listening on http://localhost:${port}`);
});
