import path from "node:path";
import { config as dotenvConfig } from "dotenv";
// Load root .env when running from apps/api (e.g. via turbo)
dotenvConfig({ path: path.resolve(process.cwd(), "../../.env") });
dotenvConfig(); // override with local .env if present
import { initTracing } from "@opentel/telemetry";
initTracing("opentel-api");
import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { mintToken, verifyToken } from "@opentel/auth";
import { OpenTelError, toHttpStatus } from "@opentel/errors";
import {
  getDb,
  getRedis,
  createTenant,
  createEndpoint,
  updateTenantWebhook,
  getTenant,
  listEndpoints,
  listCalls,
  getCall,
  createChatThread,
  getChatThread,
  listChatThreads,
  createChatMessage,
  listChatMessages,
  getChannelConfig,
  upsertChannelConfig,
  createEmailThread,
  getEmailThread,
  createEmailMessage,
  createSmsMessage,
  createQueue,
  getQueue,
  listQueues,
  addQueueMember,
  removeQueueMember,
  listQueueMembers,
  getEndpoint,
  updateEndpointAgentState,
  setAgentState,
  createUser,
  getUserByEmail,
} from "@opentel/storage";
import bcrypt from "bcryptjs";
import { createSecretsProvider } from "@opentel/secrets";
import {
  sendViaSendGrid,
  sendViaMailgun,
  sendViaSmtp,
  sendViaGmail,
  sendViaMicrosoft,
} from "./email-send.js";
import { sendViaTwilio } from "./sms-send.js";
import {
  getGmailAuthUrl,
  exchangeGmailCode,
  parseGmailState,
  getMicrosoftAuthUrl,
  exchangeMicrosoftCode,
  parseMicrosoftState,
} from "./oauth.js";
import {
  CreateTenantInputSchema,
  CreateEndpointInputSchema,
  MintTokenInputSchema,
  UpdateTenantInputSchema,
  CreateQueueInputSchema,
  AddQueueMemberInputSchema,
  UpdateEndpointStateInputSchema,
} from "@opentel/schemas";
import { register, collectDefaultMetrics } from "prom-client";

const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/opentel";
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const jwtSecret = process.env.JWT_SECRET || "dev-secret";
const port = Number(process.env.API_PORT) || 3000;
const rateLimitEnabled = process.env.RATE_LIMIT_ENABLED === "1" || process.env.RATE_LIMIT_ENABLED === "true";
const rateLimitMax = Math.max(1, parseInt(process.env.RATE_LIMIT_MAX ?? "200", 10));
const rateLimitTimeWindowMs = Math.max(1000, parseInt(process.env.RATE_LIMIT_TIME_WINDOW_MS ?? "60000", 10));

const db = getDb(dbUrl);
getRedis(redisUrl);

collectDefaultMetrics();

const app = Fastify({ logger: true });

app.addHook("onRequest", async (req, _reply) => {
  (req as { requestId?: string }).requestId = randomUUID();
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
if (rateLimitEnabled) {
  await app.register(rateLimit, {
    max: rateLimitMax,
    timeWindow: rateLimitTimeWindowMs,
    keyGenerator: (request) => {
      const payload = getAuth(request);
      if (payload?.tenantId) return `tenant:${payload.tenantId}`;
      const ip =
        request.ip ??
        request.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ??
        "unknown";
      return `ip:${ip}`;
    },
  });
}
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

app.patch("/v1/tenants/:tenantId/endpoints/:endpointId/state", async (req, reply) => {
  const auth = requireAuth(req);
  const { tenantId, endpointId } = (req as { params: { tenantId: string; endpointId: string } }).params;
  validateUuid(tenantId, "tenantId");
  validateUuid(endpointId, "endpointId");

  const parsed = UpdateEndpointStateInputSchema.safeParse(req.body);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => ({ path: i.path, message: i.message }));
    throw new OpenTelError("VALIDATION_ERROR", "Request validation failed", { fields });
  }

  if (auth.tenantId && auth.tenantId !== tenantId) {
    throw new OpenTelError("TENANT_MISMATCH", "Token tenant does not match", { tenantId });
  }

  const endpoint = await getEndpoint(db, endpointId);
  if (!endpoint || endpoint.tenant_id !== tenantId) {
    throw new OpenTelError("ENDPOINT_NOT_FOUND", `Endpoint ${endpointId} not found`, { endpointId });
  }

  await updateEndpointAgentState(db, endpointId, parsed.data.agentState);
  await setAgentState(endpointId, parsed.data.agentState);
  return reply.send({ endpointId, agentState: parsed.data.agentState });
});

// --- Queues ---

app.post("/v1/tenants/:tenantId/queues", async (req, reply) => {
  requireAuth(req);
  const { tenantId } = (req as { params: { tenantId: string } }).params;
  validateUuid(tenantId, "tenantId");

  const parsed = CreateQueueInputSchema.safeParse(req.body);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => ({ path: i.path, message: i.message }));
    throw new OpenTelError("VALIDATION_ERROR", "Request validation failed", { fields });
  }

  const queue = await createQueue(db, tenantId, parsed.data.name, {
    routingStrategy: parsed.data.routingStrategy,
    maxWaitSec: parsed.data.maxWaitSec ?? null,
    overflowQueueId: parsed.data.overflowQueueId ?? null,
  });
  return reply.send({
    id: queue.id,
    tenantId: queue.tenant_id,
    name: queue.name,
    routingStrategy: queue.routing_strategy,
    maxWaitSec: queue.max_wait_sec,
    overflowQueueId: queue.overflow_queue_id,
    createdAt: queue.created_at,
  });
});

app.get("/v1/tenants/:tenantId/queues", async (req, reply) => {
  requireAuth(req);
  const { tenantId } = (req as { params: { tenantId: string } }).params;
  validateUuid(tenantId, "tenantId");

  const q = (req as { query?: { limit?: string; offset?: string } }).query;
  const queues = await listQueues(db, tenantId, {
    limit: q?.limit ? Number(q.limit) : 50,
    offset: q?.offset ? Number(q.offset) : 0,
  });
  return reply.send(
    queues.map((r) => ({
      id: r.id,
      tenantId: r.tenant_id,
      name: r.name,
      routingStrategy: r.routing_strategy,
      maxWaitSec: r.max_wait_sec,
      overflowQueueId: r.overflow_queue_id,
      createdAt: r.created_at,
    }))
  );
});

app.get("/v1/tenants/:tenantId/queues/:queueId", async (req, reply) => {
  const auth = requireAuth(req);
  const { tenantId, queueId } = (req as { params: { tenantId: string; queueId: string } }).params;
  validateUuid(tenantId, "tenantId");
  validateUuid(queueId, "queueId");

  const queue = await getQueue(db, queueId);
  if (!queue || queue.tenant_id !== tenantId) {
    throw new OpenTelError("QUEUE_NOT_FOUND", `Queue ${queueId} not found`, { queueId });
  }
  if (auth.tenantId && auth.tenantId !== tenantId) {
    throw new OpenTelError("TENANT_MISMATCH", "Token tenant does not match", { tenantId });
  }

  const members = await listQueueMembers(db, queueId);
  return reply.send({
    id: queue.id,
    tenantId: queue.tenant_id,
    name: queue.name,
    routingStrategy: queue.routing_strategy,
    maxWaitSec: queue.max_wait_sec,
    overflowQueueId: queue.overflow_queue_id,
    createdAt: queue.created_at,
    members: members.map((m) => ({
      id: m.id,
      endpointId: m.endpoint_id,
      priority: m.priority,
      skills: m.skills,
    })),
  });
});

app.post("/v1/tenants/:tenantId/queues/:queueId/members", async (req, reply) => {
  requireAuth(req);
  const { tenantId, queueId } = (req as { params: { tenantId: string; queueId: string } }).params;
  validateUuid(tenantId, "tenantId");
  validateUuid(queueId, "queueId");

  const parsed = AddQueueMemberInputSchema.safeParse(req.body);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => ({ path: i.path, message: i.message }));
    throw new OpenTelError("VALIDATION_ERROR", "Request validation failed", { fields });
  }

  const queue = await getQueue(db, queueId);
  if (!queue || queue.tenant_id !== tenantId) {
    throw new OpenTelError("QUEUE_NOT_FOUND", `Queue ${queueId} not found`, { queueId });
  }

  const endpoint = await getEndpoint(db, parsed.data.endpointId);
  if (!endpoint || endpoint.tenant_id !== tenantId) {
    throw new OpenTelError("ENDPOINT_NOT_FOUND", `Endpoint ${parsed.data.endpointId} not in tenant`, {
      endpointId: parsed.data.endpointId,
    });
  }

  const member = await addQueueMember(db, queueId, parsed.data.endpointId, {
    priority: parsed.data.priority,
    skills: parsed.data.skills ?? null,
  });
  return reply.send({
    id: member.id,
    queueId: member.queue_id,
    endpointId: member.endpoint_id,
    priority: member.priority,
    skills: member.skills,
  });
});

app.delete("/v1/tenants/:tenantId/queues/:queueId/members/:endpointId", async (req, reply) => {
  requireAuth(req);
  const { tenantId, queueId, endpointId } = (req as {
    params: { tenantId: string; queueId: string; endpointId: string };
  }).params;
  validateUuid(tenantId, "tenantId");
  validateUuid(queueId, "queueId");
  validateUuid(endpointId, "endpointId");

  const queue = await getQueue(db, queueId);
  if (!queue || queue.tenant_id !== tenantId) {
    throw new OpenTelError("QUEUE_NOT_FOUND", `Queue ${queueId} not found`, { queueId });
  }

  await removeQueueMember(db, queueId, endpointId);
  return reply.status(204).send();
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

// --- Email auth (CCaaS sign up / sign in) ---

app.post("/v1/auth/register", async (req, reply) => {
  const body = (req as { body?: { email?: string; password?: string; organizationName?: string } }).body;
  const email = body?.email?.trim();
  const password = body?.password;
  if (!email || !password) {
    throw new OpenTelError("VALIDATION_ERROR", "email and password are required");
  }
  if (password.length < 8) {
    throw new OpenTelError("VALIDATION_ERROR", "password must be at least 8 characters");
  }
  const existing = await getUserByEmail(db, email);
  if (existing) {
    throw new OpenTelError("VALIDATION_ERROR", "An account with this email already exists");
  }
  const orgName = body?.organizationName?.trim() || "My organization";
  const tenant = await createTenant(db, orgName);
  const endpoint = await createEndpoint(db, tenant.id, email.split("@")[0] || "agent");
  const passwordHash = await bcrypt.hash(password, 10);
  await createUser(db, email, passwordHash, tenant.id, endpoint.id);
  return reply.status(201).send({
    message: "Account created. Sign in at /login with your email and password.",
  });
});

app.post("/v1/auth/login", async (req, reply) => {
  const body = (req as { body?: { email?: string; password?: string } }).body;
  const email = body?.email?.trim();
  const password = body?.password;
  if (!email || !password) {
    throw new OpenTelError("VALIDATION_ERROR", "email and password are required");
  }
  const user = await getUserByEmail(db, email);
  if (!user) {
    throw new OpenTelError("TOKEN_INVALID", "Invalid email or password");
  }
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    throw new OpenTelError("TOKEN_INVALID", "Invalid email or password");
  }
  const token = mintToken(jwtSecret, {
    tenantId: user.tenant_id,
    endpointId: user.endpoint_id,
  });
  return reply.send({ token, tenantId: user.tenant_id, endpointId: user.endpoint_id });
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

// --- Chat ---

app.post("/v1/tenants/:tenantId/chat/threads", async (req, reply) => {
  requireAuth(req);
  const { tenantId } = (req as { params: { tenantId: string } }).params;
  validateUuid(tenantId, "tenantId");

  const body = (req as { body?: { contactId?: string; metadata?: Record<string, string> } }).body ?? {};
  const thread = await createChatThread(db, tenantId, {
    contactId: body.contactId ?? null,
    metadata: body.metadata ?? null,
  });
  return reply.send({
    id: thread.id,
    tenantId: thread.tenant_id,
    contactId: thread.contact_id,
    state: thread.state,
    metadata: thread.metadata,
    createdAt: thread.created_at,
    updatedAt: thread.updated_at,
  });
});

app.get("/v1/tenants/:tenantId/chat/threads", async (req, reply) => {
  requireAuth(req);
  const { tenantId } = (req as { params: { tenantId: string } }).params;
  validateUuid(tenantId, "tenantId");

  const q = (req as { query?: { contactId?: string; limit?: string; offset?: string } }).query;
  const threads = await listChatThreads(db, tenantId, {
    contactId: q?.contactId,
    limit: q?.limit ? Number(q.limit) : 50,
    offset: q?.offset ? Number(q.offset) : 0,
  });
  return reply.send(
    threads.map((t) => ({
      id: t.id,
      tenantId: t.tenant_id,
      contactId: t.contact_id,
      state: t.state,
      metadata: t.metadata,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    }))
  );
});

app.get("/v1/tenants/:tenantId/chat/threads/:threadId", async (req, reply) => {
  const auth = requireAuth(req);
  const { tenantId, threadId } = (req as { params: { tenantId: string; threadId: string } }).params;
  validateUuid(tenantId, "tenantId");
  validateUuid(threadId, "threadId");

  const thread = await getChatThread(db, threadId);
  if (!thread) {
    throw new OpenTelError("THREAD_NOT_FOUND", `Thread with id '${threadId}' does not exist`, {
      threadId,
    });
  }
  if (auth.tenantId && thread.tenant_id !== auth.tenantId) {
    throw new OpenTelError("TENANT_MISMATCH", "Token tenant does not match thread tenant", {
      threadId,
    });
  }
  return reply.send({
    id: thread.id,
    tenantId: thread.tenant_id,
    contactId: thread.contact_id,
    state: thread.state,
    metadata: thread.metadata,
    createdAt: thread.created_at,
    updatedAt: thread.updated_at,
  });
});

app.get("/v1/tenants/:tenantId/chat/threads/:threadId/messages", async (req, reply) => {
  const auth = requireAuth(req);
  const { tenantId, threadId } = (req as { params: { tenantId: string; threadId: string } }).params;
  validateUuid(tenantId, "tenantId");
  validateUuid(threadId, "threadId");

  const thread = await getChatThread(db, threadId);
  if (!thread) {
    throw new OpenTelError("THREAD_NOT_FOUND", `Thread with id '${threadId}' does not exist`, {
      threadId,
    });
  }
  if (auth.tenantId && thread.tenant_id !== auth.tenantId) {
    throw new OpenTelError("TENANT_MISMATCH", "Token tenant does not match thread tenant", {
      threadId,
    });
  }

  const q = (req as { query?: { limit?: string; offset?: string } }).query;
  const messages = await listChatMessages(db, threadId, {
    limit: q?.limit ? Number(q.limit) : 100,
    offset: q?.offset ? Number(q.offset) : 0,
  });
  return reply.send(
    messages.map((m) => ({
      id: m.id,
      threadId: m.thread_id,
      fromEndpointId: m.from_endpoint_id,
      body: m.body,
      metadata: m.metadata,
      createdAt: m.created_at,
    }))
  );
});

// --- Email channel & OAuth ---

const apiBaseUrl = process.env.API_BASE_URL ?? `http://localhost:${port}`;

function getSecrets() {
  try {
    return createSecretsProvider();
  } catch (e) {
    throw new OpenTelError(
      "CONFIG_ERROR",
      "Secrets provider not configured. Set SECRETS_ENCRYPTION_KEY and DATABASE_URL for encrypted_db.",
      { cause: String(e) }
    );
  }
}

// Gmail OAuth: start (redirect to Google) and callback (exchange code, store refresh_token)
app.get("/v1/auth/gmail/start", async (req, reply) => {
  const query = (req as { query?: { tenantId?: string; redirect_uri?: string } }).query;
  const tenantId = query?.tenantId;
  if (!tenantId || !UUID_REGEX.test(tenantId)) {
    throw new OpenTelError("VALIDATION_ERROR", "tenantId (UUID) is required");
  }
  const tenant = await getTenant(db, tenantId);
  if (!tenant) {
    throw new OpenTelError("TENANT_NOT_FOUND", "Tenant not found", { tenantId });
  }
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new OpenTelError(
      "CONFIG_ERROR",
      "Gmail OAuth not configured. Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET."
    );
  }
  const redirectUri = `${apiBaseUrl.replace(/\/$/, "")}/v1/auth/gmail/callback`;
  const url = getGmailAuthUrl(
    { clientId, clientSecret, redirectUri },
    tenantId,
    query?.redirect_uri
  );
  return reply.redirect(302, url);
});

app.get("/v1/auth/gmail/callback", async (req, reply) => {
  const query = (req as { query?: { code?: string; state?: string } }).query;
  const code = query?.code;
  const state = query?.state;
  if (!code || !state) {
    return reply.redirect(302, `${apiBaseUrl}/auth/error?message=missing_code_or_state`);
  }
  const { tenantId, successRedirectUri } = parseGmailState(state);
  if (!UUID_REGEX.test(tenantId)) {
    return reply.redirect(302, `${apiBaseUrl}/auth/error?message=invalid_state`);
  }
  const tenant = await getTenant(db, tenantId);
  if (!tenant) {
    return reply.redirect(302, `${apiBaseUrl}/auth/error?message=tenant_not_found`);
  }
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return reply.redirect(302, `${apiBaseUrl}/auth/error?message=oauth_not_configured`);
  }
  const redirectUri = `${apiBaseUrl.replace(/\/$/, "")}/v1/auth/gmail/callback`;
  try {
    const { refreshToken } = await exchangeGmailCode(
      { clientId, clientSecret, redirectUri },
      code
    );
    const secrets = getSecrets();
    await secrets.set(tenantId, "email_gmail_refresh_token", refreshToken);
  } catch {
    return reply.redirect(302, `${apiBaseUrl}/auth/error?message=token_exchange_failed`);
  }
  const successUrl = successRedirectUri ?? `${apiBaseUrl}/auth/success`;
  return reply.redirect(302, successUrl);
});

// Microsoft OAuth: start and callback
app.get("/v1/auth/microsoft/start", async (req, reply) => {
  const query = (req as { query?: { tenantId?: string; redirect_uri?: string } }).query;
  const tenantId = query?.tenantId;
  if (!tenantId || !UUID_REGEX.test(tenantId)) {
    throw new OpenTelError("VALIDATION_ERROR", "tenantId (UUID) is required");
  }
  const tenant = await getTenant(db, tenantId);
  if (!tenant) {
    throw new OpenTelError("TENANT_NOT_FOUND", "Tenant not found", { tenantId });
  }
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const tenantIdAzure = process.env.MICROSOFT_TENANT_ID ?? "common";
  if (!clientId || !clientSecret) {
    throw new OpenTelError(
      "CONFIG_ERROR",
      "Microsoft OAuth not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET."
    );
  }
  const redirectUri = `${apiBaseUrl.replace(/\/$/, "")}/v1/auth/microsoft/callback`;
  const url = await getMicrosoftAuthUrl(
    { clientId, clientSecret, tenantId: tenantIdAzure, redirectUri },
    tenantId,
    query?.redirect_uri
  );
  return reply.redirect(302, url);
});

app.get("/v1/auth/microsoft/callback", async (req, reply) => {
  const query = (req as { query?: { code?: string; state?: string } }).query;
  const code = query?.code;
  const state = query?.state;
  if (!code || !state) {
    return reply.redirect(302, `${apiBaseUrl}/auth/error?message=missing_code_or_state`);
  }
  const { tenantId, successRedirectUri } = parseMicrosoftState(state);
  if (!UUID_REGEX.test(tenantId)) {
    return reply.redirect(302, `${apiBaseUrl}/auth/error?message=invalid_state`);
  }
  const tenant = await getTenant(db, tenantId);
  if (!tenant) {
    return reply.redirect(302, `${apiBaseUrl}/auth/error?message=tenant_not_found`);
  }
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const tenantIdAzure = process.env.MICROSOFT_TENANT_ID ?? "common";
  if (!clientId || !clientSecret) {
    return reply.redirect(302, `${apiBaseUrl}/auth/error?message=oauth_not_configured`);
  }
  const redirectUri = `${apiBaseUrl.replace(/\/$/, "")}/v1/auth/microsoft/callback`;
  try {
    const { refreshToken } = await exchangeMicrosoftCode(
      { clientId, clientSecret, tenantId: tenantIdAzure, redirectUri },
      code
    );
    const secrets = getSecrets();
    await secrets.set(tenantId, "email_microsoft_refresh_token", refreshToken);
  } catch {
    return reply.redirect(302, `${apiBaseUrl}/auth/error?message=token_exchange_failed`);
  }
  const successUrl = successRedirectUri ?? `${apiBaseUrl}/auth/success`;
  return reply.redirect(302, successUrl);
});

app.patch("/v1/tenants/:tenantId/channels/email", async (req, reply) => {
  requireAuth(req);
  const { tenantId } = (req as { params: { tenantId: string } }).params;
  validateUuid(tenantId, "tenantId");

  const body = (req as {
    body?: {
      provider: string;
      config?: Record<string, string>;
      apiKey?: string;
      password?: string;
    };
  }).body;
  const allowed = ["sendgrid", "mailgun", "gmail", "microsoft", "smtp"];
  if (!body?.provider || !allowed.includes(body.provider)) {
    throw new OpenTelError(
      "VALIDATION_ERROR",
      `provider must be one of: ${allowed.join(", ")}`
    );
  }
  const config = body.config ?? {};
  if (body.provider === "mailgun" && !config.domain) {
    throw new OpenTelError("VALIDATION_ERROR", "Mailgun requires config.domain");
  }
  if (body.provider === "sendgrid" && !config.from) {
    throw new OpenTelError("VALIDATION_ERROR", "SendGrid requires config.from");
  }
  if (body.provider === "smtp") {
    if (!config.host || config.port === undefined) {
      throw new OpenTelError(
        "VALIDATION_ERROR",
        "SMTP requires config.host and config.port"
      );
    }
    if (!config.from) {
      throw new OpenTelError("VALIDATION_ERROR", "SMTP requires config.from");
    }
  }

  const row = await upsertChannelConfig(db, tenantId, "email", body.provider, config as Record<string, unknown>);
  if (body.apiKey) {
    const secrets = getSecrets();
    await secrets.set(tenantId, `email_${body.provider}_api_key`, body.apiKey);
  }
  if (body.provider === "smtp" && body.password) {
    const secrets = getSecrets();
    await secrets.set(tenantId, "email_smtp_password", body.password);
  }
  return reply.send({
    id: row.id,
    tenantId: row.tenant_id,
    channel: "email",
    provider: row.provider,
    config: row.config,
  });
});

app.post("/v1/tenants/:tenantId/email/send", async (req, reply) => {
  requireAuth(req);
  const { tenantId } = (req as { params: { tenantId: string } }).params;
  validateUuid(tenantId, "tenantId");

  const body = (req as {
    body?: {
      to: string;
      subject: string;
      bodyText?: string;
      bodyHtml?: string;
      threadId?: string;
      from?: string;
    };
  }).body;
  if (!body?.to || !body?.subject) {
    throw new OpenTelError("VALIDATION_ERROR", "to and subject are required");
  }

  const channelConfig = await getChannelConfig(db, tenantId, "email");
  if (!channelConfig) {
    throw new OpenTelError(
      "CONFIG_ERROR",
      "Email not configured for tenant. PATCH /channels/email first.",
      { tenantId }
    );
  }

  const secrets = getSecrets();
  const config = (channelConfig.config ?? {}) as Record<string, string>;
  const from = body.from ?? config.from ?? "noreply@example.com";

  let messageId: string;
  if (channelConfig.provider === "sendgrid") {
    const apiKey = await secrets.get(tenantId, "email_sendgrid_api_key");
    if (!apiKey) {
      throw new OpenTelError(
        "CONFIG_ERROR",
        "Email API key not set. PATCH /channels/email with apiKey.",
        { tenantId }
      );
    }
    const result = await sendViaSendGrid(apiKey, {
      to: body.to,
      from,
      subject: body.subject,
      bodyText: body.bodyText,
      bodyHtml: body.bodyHtml,
    });
    messageId = result.messageId;
  } else if (channelConfig.provider === "mailgun") {
    const apiKey = await secrets.get(tenantId, "email_mailgun_api_key");
    if (!apiKey) {
      throw new OpenTelError(
        "CONFIG_ERROR",
        "Email API key not set. PATCH /channels/email with apiKey.",
        { tenantId }
      );
    }
    const domain = config.domain;
    if (!domain) throw new OpenTelError("CONFIG_ERROR", "Mailgun domain not configured");
    const result = await sendViaMailgun(apiKey, domain, {
      to: body.to,
      from,
      subject: body.subject,
      bodyText: body.bodyText,
      bodyHtml: body.bodyHtml,
    });
    messageId = result.messageId;
  } else if (channelConfig.provider === "gmail") {
    const refreshToken = await secrets.get(tenantId, "email_gmail_refresh_token");
    if (!refreshToken) {
      throw new OpenTelError(
        "CONFIG_ERROR",
        "Gmail not connected. Complete OAuth flow: GET /v1/auth/gmail/start?tenantId=...",
        { tenantId }
      );
    }
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new OpenTelError(
        "CONFIG_ERROR",
        "Gmail OAuth not configured. Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET."
      );
    }
    const redirectUri = `${apiBaseUrl.replace(/\/$/, "")}/v1/auth/gmail/callback`;
    const result = await sendViaGmail(
      { clientId, clientSecret, redirectUri, refreshToken },
      {
        to: body.to,
        from,
        subject: body.subject,
        bodyText: body.bodyText,
        bodyHtml: body.bodyHtml,
      }
    );
    messageId = result.messageId;
  } else if (channelConfig.provider === "microsoft") {
    const refreshToken = await secrets.get(tenantId, "email_microsoft_refresh_token");
    if (!refreshToken) {
      throw new OpenTelError(
        "CONFIG_ERROR",
        "Microsoft 365 not connected. Complete OAuth flow: GET /v1/auth/microsoft/start?tenantId=...",
        { tenantId }
      );
    }
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    const tenantIdAzure = process.env.MICROSOFT_TENANT_ID ?? "common";
    if (!clientId || !clientSecret) {
      throw new OpenTelError(
        "CONFIG_ERROR",
        "Microsoft OAuth not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET."
      );
    }
    const result = await sendViaMicrosoft(
      { clientId, clientSecret, tenantId: tenantIdAzure, refreshToken },
      {
        to: body.to,
        from,
        subject: body.subject,
        bodyText: body.bodyText,
        bodyHtml: body.bodyHtml,
      }
    );
    messageId = result.messageId;
  } else if (channelConfig.provider === "smtp") {
    const password = await secrets.get(tenantId, "email_smtp_password");
    if (!password) {
      throw new OpenTelError(
        "CONFIG_ERROR",
        "SMTP password not set. PATCH /channels/email with password.",
        { tenantId }
      );
    }
    const port = Number(config.port);
    if (Number.isNaN(port)) {
      throw new OpenTelError("CONFIG_ERROR", "SMTP config.port must be a number");
    }
    const result = await sendViaSmtp(
      {
        host: config.host,
        port,
        secure: config.secure === "true" || config.secure === "1",
        user: config.user,
        password,
      },
      {
        to: body.to,
        from,
        subject: body.subject,
        bodyText: body.bodyText,
        bodyHtml: body.bodyHtml,
      }
    );
    messageId = result.messageId;
  } else {
    throw new OpenTelError("CONFIG_ERROR", `Unsupported email provider: ${channelConfig.provider}`);
  }

  if (body.threadId) {
    const thread = await getEmailThread(db, body.threadId);
    if (thread && thread.tenant_id === tenantId) {
      await createEmailMessage(db, body.threadId, {
        direction: "outbound",
        fromAddress: from,
        toAddress: body.to,
        subject: body.subject,
        bodyText: body.bodyText ?? null,
        bodyHtml: body.bodyHtml ?? null,
        providerMessageId: messageId,
      });
    }
  }

  return reply.send({ messageId, sentAt: new Date().toISOString() });
});

// --- SMS channel ---

app.patch("/v1/tenants/:tenantId/channels/sms", async (req, reply) => {
  requireAuth(req);
  const { tenantId } = (req as { params: { tenantId: string } }).params;
  validateUuid(tenantId, "tenantId");

  const body = (req as {
    body?: { provider: string; config?: Record<string, string>; accountSid?: string; authToken?: string };
  }).body;
  if (!body?.provider || body.provider !== "twilio") {
    throw new OpenTelError("VALIDATION_ERROR", "provider must be twilio");
  }
  const config = body.config ?? {};
  if (!config.fromNumber) {
    throw new OpenTelError("VALIDATION_ERROR", "SMS requires config.fromNumber (Twilio phone number)");
  }

  const row = await upsertChannelConfig(db, tenantId, "sms", "twilio", config as Record<string, unknown>);
  if (body.accountSid) {
    const secrets = getSecrets();
    await secrets.set(tenantId, "sms_twilio_account_sid", body.accountSid);
  }
  if (body.authToken) {
    const secrets = getSecrets();
    await secrets.set(tenantId, "sms_twilio_auth_token", body.authToken);
  }
  return reply.send({
    id: row.id,
    tenantId: row.tenant_id,
    channel: "sms",
    provider: row.provider,
    config: row.config,
  });
});

app.post("/v1/tenants/:tenantId/sms/send", async (req, reply) => {
  requireAuth(req);
  const { tenantId } = (req as { params: { tenantId: string } }).params;
  validateUuid(tenantId, "tenantId");

  const body = (req as { body?: { to: string; body: string; from?: string } }).body;
  if (!body?.to || !body?.body) {
    throw new OpenTelError("VALIDATION_ERROR", "to and body are required");
  }

  const channelConfig = await getChannelConfig(db, tenantId, "sms");
  if (!channelConfig) {
    throw new OpenTelError(
      "CONFIG_ERROR",
      "SMS not configured for tenant. PATCH /channels/sms first.",
      { tenantId }
    );
  }

  const secrets = getSecrets();
  const accountSid = await secrets.get(tenantId, "sms_twilio_account_sid");
  const authToken = await secrets.get(tenantId, "sms_twilio_auth_token");
  if (!accountSid || !authToken) {
    throw new OpenTelError(
      "CONFIG_ERROR",
      "SMS Twilio credentials not set. PATCH /channels/sms with accountSid and authToken.",
      { tenantId }
    );
  }

  const config = (channelConfig.config ?? {}) as Record<string, string>;
  const from = body.from ?? config.fromNumber;
  if (!from) throw new OpenTelError("CONFIG_ERROR", "SMS fromNumber not configured");

  const result = await sendViaTwilio(accountSid, authToken, {
    to: body.to,
    from,
    body: body.body,
  });

  await createSmsMessage(db, tenantId, {
    direction: "outbound",
    fromNumber: from,
    toNumber: body.to,
    body: body.body,
    providerMessageId: result.messageId,
  });

  return reply.send({
    messageId: result.messageId,
    sentAt: new Date().toISOString(),
  });
});

if (process.env.NODE_ENV !== "test") {
  app.listen({ port, host: "0.0.0.0" }, (err) => {
    if (err) throw err;
    console.log(`API listening on http://localhost:${port}`);
  });
}

export { app };
