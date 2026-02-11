import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { getDb } from "@opentel/storage";
import { mintToken, verifyToken } from "@opentel/auth";
import { OpenTelError, toHttpStatus } from "@opentel/errors";
import {
  createTenant,
  createEndpoint,
  updateTenantWebhook,
  getTenant,
  listEndpoints,
  listCalls,
  getCall,
} from "@opentel/storage";
import {
  CreateTenantInputSchema,
  CreateEndpointInputSchema,
  MintTokenInputSchema,
  UpdateTenantInputSchema,
} from "@opentel/schemas";
import { register, collectDefaultMetrics } from "prom-client";

const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/opentel";
const jwtSecret = process.env.JWT_SECRET || "dev-secret";
const port = Number(process.env.API_PORT) || 3000;

const db = getDb(dbUrl);

collectDefaultMetrics();

const app = Fastify({ logger: true });

app.addHook("onRequest", async (req, _reply) => {
  (req as { requestId?: string }).requestId = crypto.randomUUID();
});

app.setErrorHandler((err, req, reply) => {
  const requestId = (req as { requestId?: string }).requestId;
  const path = req.url;
  const method = req.method;

  if (err instanceof OpenTelError) {
    const status = toHttpStatus(err.code);
    const body = err.toApiResponse({ requestId, path, method });
    req.log.warn({ err, requestId, code: err.code }, err.message);
    return reply.status(status).send(body);
  }

  req.log.error({ err, requestId }, "Unhandled error");
  const body = new OpenTelError(
    "INTERNAL_ERROR",
    "An unexpected error occurred"
  ).toApiResponse({ requestId, path, method });
  return reply.status(500).send(body);
});

app.register(cors, { origin: true });
app.register(swagger, {
  openapi: {
    info: { title: "OpenTel API", version: "0.1.0" },
  },
});
app.register(swaggerUi, { routePrefix: "/docs" });

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getAuth(req: { headers?: { authorization?: string } }) {
  const auth = req.headers?.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    return verifyToken(jwtSecret, auth.slice(7));
  } catch {
    return null;
  }
}

function isAdmin(payload: { scopes?: string[] } | null): boolean {
  return payload?.scopes?.includes("admin") ?? false;
}

function requireAuth(req: { headers?: { authorization?: string } }) {
  const auth = req.headers?.authorization;
  if (!auth) {
    throw new OpenTelError("TOKEN_MISSING", "Missing Authorization header");
  }
  if (!auth.startsWith("Bearer ")) {
    throw new OpenTelError("TOKEN_INVALID", "Invalid Authorization format; expected 'Bearer <token>'");
  }
  try {
    return verifyToken(jwtSecret, auth.slice(7));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("expired")) {
      throw new OpenTelError("TOKEN_EXPIRED", "Token has expired");
    }
    throw new OpenTelError("TOKEN_INVALID", "Invalid or malformed token");
  }
}

function requireAdmin(req: { headers?: { authorization?: string } }) {
  const auth = requireAuth(req);
  if (!isAdmin(auth)) {
    throw new OpenTelError("INSUFFICIENT_SCOPE", "Admin scope required for this operation", {
      required: ["admin"],
    });
  }
  return auth;
}

function validateUuid(value: string, param: string): void {
  if (!UUID_REGEX.test(value)) {
    throw new OpenTelError("INVALID_UUID", `Invalid UUID for ${param}`, { [param]: value });
  }
}

app.get("/health", async () => ({ status: "ok" }));

app.get("/metrics", async (_req, reply) => {
  reply.header("Content-Type", register.contentType);
  return reply.send(await register.metrics());
});

app.post("/v1/tenants", async (req, reply) => {
  requireAdmin(req);
  const parsed = CreateTenantInputSchema.safeParse(req.body);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => ({
      path: i.path,
      message: i.message,
    }));
    throw new OpenTelError("VALIDATION_ERROR", "Request validation failed", { fields });
  }
  if (!parsed.data.name?.trim()) {
    throw new OpenTelError("NAME_REQUIRED", "Tenant name is required");
  }
  const tenant = await createTenant(db, parsed.data.name.trim(), parsed.data.webhookUrl);
  return reply.send(tenant);
});

app.patch("/v1/tenants/:tenantId", async (req, reply) => {
  requireAuth(req);
  const { tenantId } = (req as { params: { tenantId: string } }).params;
  validateUuid(tenantId, "tenantId");

  const parsed = UpdateTenantInputSchema.safeParse(req.body);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => ({ path: i.path, message: i.message }));
    throw new OpenTelError("VALIDATION_ERROR", "Request validation failed", { fields });
  }

  if (parsed.data.webhookUrl !== undefined) {
    await updateTenantWebhook(db, tenantId, parsed.data.webhookUrl);
  }
  const tenant = await getTenant(db, tenantId);
  if (!tenant) {
    throw new OpenTelError("TENANT_NOT_FOUND", `Tenant with id '${tenantId}' does not exist`, {
      tenantId,
    });
  }
  return reply.send(tenant);
});

app.get("/v1/tenants/:tenantId/endpoints", async (req, reply) => {
  requireAuth(req);
  const { tenantId } = (req as { params: { tenantId: string } }).params;
  validateUuid(tenantId, "tenantId");

  const limit = Number((req as { query?: { limit?: string } }).query?.limit) || 50;
  const offset = Number((req as { query?: { offset?: string } }).query?.offset) || 0;
  const endpoints = await listEndpoints(db, tenantId, limit, offset);
  return reply.send(endpoints);
});

app.post("/v1/tenants/:tenantId/endpoints", async (req, reply) => {
  requireAuth(req);
  const { tenantId } = (req as { params: { tenantId: string } }).params;
  validateUuid(tenantId, "tenantId");

  const parsed = CreateEndpointInputSchema.safeParse(req.body);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => ({ path: i.path, message: i.message }));
    throw new OpenTelError("VALIDATION_ERROR", "Request validation failed", { fields });
  }
  if (!parsed.data.label?.trim()) {
    throw new OpenTelError("LABEL_REQUIRED", "Endpoint label is required");
  }

  const endpoint = await createEndpoint(db, tenantId, parsed.data.label.trim());
  return reply.send(endpoint);
});

app.post("/v1/tokens", async (req, reply) => {
  requireAdmin(req);
  const parsed = MintTokenInputSchema.safeParse(req.body);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => ({ path: i.path, message: i.message }));
    throw new OpenTelError("VALIDATION_ERROR", "Request validation failed", { fields });
  }
  validateUuid(parsed.data.tenantId, "tenantId");
  if (parsed.data.endpointId) validateUuid(parsed.data.endpointId, "endpointId");

  const token = mintToken(jwtSecret, {
    tenantId: parsed.data.tenantId,
    endpointId: parsed.data.endpointId,
    scopes: parsed.data.scopes,
  });
  return reply.send({ token });
});

app.get("/v1/tenants/:tenantId/calls", async (req, reply) => {
  requireAuth(req);
  const { tenantId } = (req as { params: { tenantId: string } }).params;
  validateUuid(tenantId, "tenantId");

  const q = (req as { query?: { state?: string; limit?: string; offset?: string } }).query;
  const calls = await listCalls(db, tenantId, {
    state: q?.state,
    limit: q?.limit ? Number(q.limit) : 50,
    offset: q?.offset ? Number(q.offset) : 0,
  });
  return reply.send(calls);
});

app.get("/v1/calls/:callId", async (req, reply) => {
  const auth = requireAuth(req);
  const { callId } = (req as { params: { callId: string } }).params;
  validateUuid(callId, "callId");

  const call = await getCall(db, callId);
  if (!call) {
    throw new OpenTelError("CALL_NOT_FOUND", `Call with id '${callId}' does not exist`, {
      callId,
    });
  }
  if (auth.tenantId && call.tenant_id !== auth.tenantId) {
    throw new OpenTelError("TENANT_MISMATCH", "Token tenant does not match call tenant", {
      callId,
    });
  }
  return reply.send(call);
});

app.listen({ port, host: "0.0.0.0" }, (err) => {
  if (err) throw err;
  console.log(`API listening on http://localhost:${port}`);
});
