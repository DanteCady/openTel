import path from "node:path";
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: path.resolve(process.cwd(), "../../.env") });
dotenvConfig();
import { initTracing } from "@opentel/telemetry";
initTracing("opentel-signaling");
import Fastify from "fastify";
import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import { Counter, Gauge, register, collectDefaultMetrics } from "prom-client";
import { connect as natsConnect, publishCallEvent, publishChatEvent, deliverWebhook } from "@opentel/events";
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
  getChatThread,
  createChatMessage,
  getQueue,
  listQueueMembers,
  getAgentState,
  getPresence,
  setAgentState,
  updateEndpointAgentState,
} from "@opentel/storage";
import { DialMessageSchema, isE164, JoinThreadMessageSchema, SendMessageSchema } from "@opentel/schemas";
import {
  isPhase2Enabled,
  originateToPstn,
  registerInboundHandler,
  notifyInboundCall,
} from "@opentel/gateway-client";

const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/opentel";
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
// Prefer 127.0.0.1 so Docker-exposed NATS is reachable when Node resolves localhost to IPv6 (::1)
const natsUrl = (process.env.NATS_URL || "nats://127.0.0.1:4222").replace(
  /localhost/i,
  "127.0.0.1"
);
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

app.get("/health", async (_req, reply) => {
  return reply.send({ status: "ok", service: "signaling" });
});

app.get("/metrics", async (_req, reply) => {
  reply.header("Content-Type", register.contentType);
  return reply.send(await register.metrics());
});

const inboundTenantId = process.env.OPENTEL_INBOUND_TENANT_ID?.trim();
const inboundDefaultEndpointId = process.env.OPENTEL_INBOUND_DEFAULT_ENDPOINT_ID?.trim();
if (isPhase2Enabled() && inboundTenantId && inboundDefaultEndpointId) {
  registerInboundHandler(async (info) => {
    const metadata: Record<string, string> = {};
    if (info.channelUuid) metadata.gatewayChannelUuid = info.channelUuid;
    const call = await createCall(db, inboundTenantId, null, inboundDefaultEndpointId, metadata, {
      fromPhoneNumber: info.callerId,
    });
    callsCreatedCounter.inc();
    await updateCallState(db, call.id, "RINGING");
    const ts = new Date().toISOString();
    await publishCallEvent({
      event: "call.created",
      callId: call.id,
      tenantId: inboundTenantId,
      fromEndpointId: null,
      toEndpointId: inboundDefaultEndpointId,
      metadata,
      ts,
    });
    await publishCallEvent({ event: "call.ringing", callId: call.id, ts });
    const callee = sockets.get(inboundDefaultEndpointId);
    if (callee) {
      send(callee.ws, {
        type: "incoming_call",
        callId: call.id,
        fromEndpointId: null,
        fromPhoneNumber: info.callerId,
        metadata,
        ts,
      });
    }
    const tenant = await getTenant(db, inboundTenantId);
    if (tenant?.webhook_url) {
      deliverWebhook(tenant.webhook_url, "call.created", {
        callId: call.id,
        tenantId: inboundTenantId,
        fromPhoneNumber: info.callerId,
        toEndpointId: inboundDefaultEndpointId,
        metadata,
      });
      deliverWebhook(tenant.webhook_url, "call.ringing", { callId: call.id });
    }
    return { endpointIds: [inboundDefaultEndpointId] };
  });
}

const inboundSecret = process.env.OPENTEL_INBOUND_SECRET?.trim();
const inboundAllowedIps = process.env.OPENTEL_INBOUND_ALLOWED_IPS?.trim()
  ? process.env.OPENTEL_INBOUND_ALLOWED_IPS.split(",").map((s) => s.trim()).filter(Boolean)
  : null;

function checkInboundAuth(
  req: { ip?: string; headers?: { [k: string]: string | undefined } },
  reply: { status: (code: number) => { send: (body: object) => unknown } }
): boolean {
  if (inboundAllowedIps && inboundAllowedIps.length > 0) {
    const clientIp = req.ip ?? req.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ?? "";
    if (!clientIp || !inboundAllowedIps.includes(clientIp)) {
      reply.status(403).send({ error: "Forbidden: IP not allowed" });
      return false;
    }
  }
  if (inboundSecret) {
    const headerSecret = req.headers?.["x-inbound-secret"] ?? (req.headers?.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : undefined);
    if (headerSecret !== inboundSecret) {
      reply.status(401).send({ error: "Unauthorized: invalid or missing inbound secret" });
      return false;
    }
  }
  return true;
}

app.post("/inbound-call", async (req, reply) => {
  if (!checkInboundAuth(req as { ip?: string; headers?: { [k: string]: string | undefined } }, reply)) return;
  try {
    const body = (req as { body?: { callerId?: string; dialedNumber?: string; channelUuid?: string; routingHint?: string } }).body;
    const callerId = body?.callerId ?? body?.dialedNumber ?? "";
    const dialedNumber = body?.dialedNumber ?? "";
    if (!callerId && !dialedNumber) {
      return reply.status(400).send({ error: "callerId or dialedNumber required" });
    }
    const result = await notifyInboundCall({
      callerId: String(callerId),
      dialedNumber: String(dialedNumber),
      channelUuid: body?.channelUuid,
      routingHint: body?.routingHint,
    });
    return reply.send(result);
  } catch (err) {
    app.log.warn({ err }, "Inbound call failed");
    return reply.status(500).send({ error: err instanceof Error ? err.message : String(err) });
  }
});

const sockets = new Map<string, { ws: WebSocket; tenantId: string }>();
// threadId -> endpointId -> { ws, tenantId }
const threadParticipants = new Map<string, Map<string, { ws: WebSocket; tenantId: string }>>();
// endpointId -> Set<threadId> (for cleanup on disconnect)
const endpointThreads = new Map<string, Set<string>>();

function send(ws: WebSocket, msg: object) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function addToThread(threadId: string, endpointId: string, tenantId: string, ws: WebSocket) {
  let participants = threadParticipants.get(threadId);
  if (!participants) {
    participants = new Map();
    threadParticipants.set(threadId, participants);
  }
  participants.set(endpointId, { ws, tenantId });
  let threads = endpointThreads.get(endpointId);
  if (!threads) {
    threads = new Set();
    endpointThreads.set(endpointId, threads);
  }
  threads.add(threadId);
}

function removeFromThread(threadId: string, endpointId: string) {
  const participants = threadParticipants.get(threadId);
  if (participants) {
    participants.delete(endpointId);
    if (participants.size === 0) threadParticipants.delete(threadId);
  }
  const threads = endpointThreads.get(endpointId);
  if (threads) {
    threads.delete(threadId);
    if (threads.size === 0) endpointThreads.delete(endpointId);
  }
}

function removeEndpointFromAllThreads(endpointId: string) {
  const threads = endpointThreads.get(endpointId);
  if (!threads) return;
  for (const threadId of threads) {
    const participants = threadParticipants.get(threadId);
    if (participants) {
      participants.delete(endpointId);
      if (participants.size === 0) threadParticipants.delete(threadId);
    }
  }
  endpointThreads.delete(endpointId);
}

function handleWsConnection(ws: WebSocket) {
  app.log.info("WebSocket client connected");
  let tenantId: string | null = null;
  let endpointId: string | null = null;

  ws.on("message", async (data: Buffer | ArrayBuffer | Buffer[]) => {
    const raw = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "auth") {
        const payload = verifyToken(jwtSecret, msg.token);
        tenantId = payload.tenantId;
        ws.send(JSON.stringify({ type: "auth_ok" }));
        return;
      }
      if (msg.type === "register") {
        if (!tenantId) {
          ws.send(JSON.stringify({ type: "error", message: "Auth first" }));
          return;
        }
        const eidReg = msg.endpointId;
        if (!eidReg || typeof eidReg !== "string") {
          ws.send(JSON.stringify({ type: "error", message: "Invalid endpointId" }));
          return;
        }
        endpointId = eidReg;
        sockets.set(eidReg, { ws, tenantId });
        wsConnectionsGauge.set(sockets.size);
        await setPresence(eidReg, true);
        ws.send(JSON.stringify({ type: "registered" }));
        return;
      }

      if (!tenantId || !endpointId) {
        ws.send(JSON.stringify({ type: "error", message: "Auth and register first" }));
        return;
      }

      const tid = tenantId;
      const eid = endpointId;

      if (msg.type === "dial") {
        const parsed = DialMessageSchema.safeParse(msg);
        if (!parsed.success) {
          ws.send(JSON.stringify({ type: "error", message: "Invalid dial" }));
          return;
        }
        const { toEndpointId, toQueueId, toPhoneNumber, metadata } = parsed.data;
        const isPstn = toPhoneNumber != null && toPhoneNumber.trim() !== "" && isE164(toPhoneNumber.trim());

        if (toQueueId) {
          const queue = await getQueue(db, toQueueId);
          if (!queue || queue.tenant_id !== tid) {
            ws.send(JSON.stringify({ type: "error", message: "Queue not found" }));
            return;
          }
          const members = await listQueueMembers(db, toQueueId);
          const available: string[] = [];
          for (const m of members) {
            const online = await getPresence(m.endpoint_id);
            const state = (await getAgentState(m.endpoint_id)) ?? "available";
            if (online && state === "available") available.push(m.endpoint_id);
          }
          if (available.length === 0) {
            ws.send(JSON.stringify({ type: "error", message: "No available agents in queue" }));
            return;
          }
          const toId = queue.routing_strategy === "longest-idle" ? available[0] : available[0];
          const call = await createCall(db, tid, eid, toId, metadata, { queueId: toQueueId, direction: "outbound" });
          callsCreatedCounter.inc();
          await updateCallState(db, call.id, "RINGING");

          const ts = new Date().toISOString();
          await publishCallEvent({ event: "call.created", callId: call.id, tenantId: tid, fromEndpointId: eid, toEndpointId: toId, metadata, ts });
          await publishCallEvent({ event: "call.ringing", callId: call.id, ts });

          const callee = sockets.get(toId);
          if (callee) {
            send(callee.ws, { type: "incoming_call", callId: call.id, fromEndpointId: eid, metadata, ts });
          }
          send(ws, { type: "call_created", callId: call.id, state: "RINGING" });

          const tenant = await getTenant(db, tid);
          if (tenant?.webhook_url) {
            deliverWebhook(tenant.webhook_url, "call.created", { callId: call.id, tenantId: tid, fromEndpointId: eid, toEndpointId: toId, queueId: toQueueId, metadata });
            deliverWebhook(tenant.webhook_url, "call.ringing", { callId: call.id });
          }
          return;
        }

        if (isPstn) {
          const phone = toPhoneNumber!.trim();
          if (!isPhase2Enabled()) {
            ws.send(JSON.stringify({ type: "error", message: "PSTN not configured: set OPENTEL_GATEWAY_URL" }));
            return;
          }
          const call = await createCall(db, tid, eid, null, metadata, { toPhoneNumber: phone });
          callsCreatedCounter.inc();
          try {
            await originateToPstn(phone);
            await updateCallState(db, call.id, "RINGING");
            const ts = new Date().toISOString();
            await publishCallEvent({ event: "call.created", callId: call.id, tenantId: tid, fromEndpointId: eid, toEndpointId: null, metadata, ts });
            await publishCallEvent({ event: "call.ringing", callId: call.id, ts });
            send(ws, { type: "call_created", callId: call.id, state: "RINGING" });
            const tenant = await getTenant(db, tid);
            if (tenant?.webhook_url) {
              deliverWebhook(tenant.webhook_url, "call.created", { callId: call.id, tenantId: tid, fromEndpointId: eid, toPhoneNumber: phone, metadata });
              deliverWebhook(tenant.webhook_url, "call.ringing", { callId: call.id });
            }
          } catch (err) {
            await updateCallState(db, call.id, "ENDED");
            const msgErr = err instanceof Error ? err.message : String(err);
            ws.send(JSON.stringify({ type: "error", message: `PSTN originate failed: ${msgErr}` }));
          }
          return;
        }

        const toId = toEndpointId!;
        const call = await createCall(db, tid, eid, toId, metadata);
        callsCreatedCounter.inc();
        await updateCallState(db, call.id, "RINGING");

        const ts = new Date().toISOString();
        await publishCallEvent({ event: "call.created", callId: call.id, tenantId: tid, fromEndpointId: eid, toEndpointId: toId, metadata, ts });
        await publishCallEvent({ event: "call.ringing", callId: call.id, ts });

        const callee = sockets.get(toId);
        if (callee) {
          send(callee.ws, { type: "incoming_call", callId: call.id, fromEndpointId: eid, metadata, ts });
        }
        send(ws, { type: "call_created", callId: call.id, state: "RINGING" });

        const tenant = await getTenant(db, tid);
        if (tenant?.webhook_url) {
          deliverWebhook(tenant.webhook_url, "call.created", { callId: call.id, tenantId: tid, fromEndpointId: eid, toEndpointId: toId, metadata });
          deliverWebhook(tenant.webhook_url, "call.ringing", { callId: call.id });
        }
        return;
      }

      if (msg.type === "answer") {
        const callId = msg.callId;
        const sdp = msg.sdp;
        const call = await getCall(db, callId);
        if (!call || call.tenant_id !== tid) {
          ws.send(JSON.stringify({ type: "error", message: "Call not found" }));
          return;
        }
        const next = transitionCallState(call.state as "CREATED" | "RINGING" | "ANSWERED" | "ENDED", "ANSWER");
        if (!next) {
          ws.send(JSON.stringify({ type: "error", message: "Invalid state transition" }));
          return;
        }
        await updateCallState(db, callId, next, new Date());
        await setAgentState(eid, "busy");
        await updateEndpointAgentState(db, eid, "busy");

        const ts = new Date().toISOString();
        await publishCallEvent({ event: "call.answered", callId, ts });
        await publishCallEvent({ event: "signaling.answer", callId, sdp, ts });

        const caller = call.from_endpoint_id ? sockets.get(call.from_endpoint_id) : undefined;
        if (caller) send(caller.ws, { type: "answer", callId, sdp, ts });

        const tenant = await getTenant(db, tid);
        if (tenant?.webhook_url) deliverWebhook(tenant.webhook_url, "call.answered", { callId });

        send(ws, { type: "call_answered", callId });
        return;
      }

      if (msg.type === "offer") {
        const callId = msg.callId;
        const sdp = msg.sdp;
        const call = await getCall(db, callId);
        if (!call || call.tenant_id !== tid) return;
        const callee = call.to_endpoint_id ? sockets.get(call.to_endpoint_id) : undefined;
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
        const other = otherId != null ? sockets.get(otherId) : undefined;
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
        const agentId = call.to_endpoint_id;
        if (agentId) {
          await setAgentState(agentId, "available");
          await updateEndpointAgentState(db, agentId, "available");
        }

        const duration = call.answered_at
          ? Math.floor((Date.now() - new Date(call.answered_at).getTime()) / 1000)
          : undefined;
        const ts = new Date().toISOString();
        await publishCallEvent({ event: "call.ended", callId, reason: "hangup", duration, metadata: call.metadata ?? undefined, ts });

        const otherId = call.from_endpoint_id === endpointId ? call.to_endpoint_id : call.from_endpoint_id;
        const other = otherId != null ? sockets.get(otherId) : undefined;
        if (other) send(other.ws, { type: "hangup", callId, reason: "hangup", ts });

        const tenant = await getTenant(db, tid);
        if (tenant?.webhook_url) deliverWebhook(tenant.webhook_url, "call.ended", { callId, reason: "hangup", duration, metadata: call.metadata });

        send(ws, { type: "call_ended", callId });
        return;
      }

      if (msg.type === "join_thread") {
        const parsed = JoinThreadMessageSchema.safeParse(msg);
        if (!parsed.success) {
          ws.send(JSON.stringify({ type: "error", message: "Invalid join_thread" }));
          return;
        }
        const { threadId } = parsed.data;
        const thread = await getChatThread(db, threadId);
        if (!thread || thread.tenant_id !== tid) {
          ws.send(JSON.stringify({ type: "error", message: "Thread not found" }));
          return;
        }
        addToThread(threadId, eid, tid, ws);
        ws.send(JSON.stringify({ type: "thread_joined", threadId }));
        return;
      }

      if (msg.type === "send_message") {
        const parsed = SendMessageSchema.safeParse(msg);
        if (!parsed.success) {
          ws.send(JSON.stringify({ type: "error", message: "Invalid send_message" }));
          return;
        }
        const { threadId, body, metadata } = parsed.data;
        const thread = await getChatThread(db, threadId);
        if (!thread || thread.tenant_id !== tid) {
          ws.send(JSON.stringify({ type: "error", message: "Thread not found" }));
          return;
        }
        const message = await createChatMessage(db, threadId, body, {
          fromEndpointId: eid,
          metadata: metadata ?? undefined,
        });
        const ts = new Date().toISOString();
        await publishChatEvent({
          event: "chat.message.created",
          messageId: message.id,
          threadId,
          fromEndpointId: eid,
          body,
          ts,
        });
        const participants = threadParticipants.get(threadId);
        if (participants) {
          for (const [pid, { ws: pWs }] of participants) {
            send(pWs, {
              type: "message.received",
              messageId: message.id,
              threadId,
              fromEndpointId: eid,
              body,
              ts,
            });
          }
        }
        send(ws, { type: "message.sent", messageId: message.id, threadId, ts });
        return;
      }
    } catch (e) {
      ws.send(JSON.stringify({ type: "error", message: String(e) }));
    }
  });

  ws.on("close", () => {
    if (endpointId) {
      removeEndpointFromAllThreads(endpointId);
      sockets.delete(endpointId);
      wsConnectionsGauge.set(sockets.size);
      setPresence(endpointId, false);
    }
  });
}

async function start() {
  await app.listen({ port, host: "0.0.0.0" });
  const server = app.server;
  if (!server) throw new Error("Fastify server not available");
  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (request, socket, head) => {
    if (request.url === "/ws" || request.url?.startsWith("/ws?")) {
      wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
        wss.emit("connection", ws, request);
        handleWsConnection(ws);
      });
    } else {
      socket.destroy();
    }
  });
  console.log(`Signaling listening on http://localhost:${port}`);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
