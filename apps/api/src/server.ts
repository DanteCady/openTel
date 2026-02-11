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
} from "@opentel/storage";
import { createSecretsProvider } from "@opentel/secrets";
import { sendViaSendGrid, sendViaMailgun } from "./email-send.js";
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

// --- Email channel ---

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

app.patch("/v1/tenants/:tenantId/channels/email", async (req, reply) => {
  requireAuth(req);
  const { tenantId } = (req as { params: { tenantId: string } }).params;
  validateUuid(tenantId, "tenantId");

  const body = (req as {
    body?: { provider: string; config?: Record<string, string>; apiKey?: string };
  }).body;
  if (!body?.provider || !["sendgrid", "mailgun"].includes(body.provider)) {
    throw new OpenTelError("VALIDATION_ERROR", "provider must be sendgrid or mailgun");
  }
  const config = body.config ?? {};
  if (body.provider === "mailgun" && !config.domain) {
    throw new OpenTelError("VALIDATION_ERROR", "Mailgun requires config.domain");
  }
  if (body.provider === "sendgrid" && !config.from) {
    throw new OpenTelError("VALIDATION_ERROR", "SendGrid requires config.from");
  }

  const row = await upsertChannelConfig(db, tenantId, "email", body.provider, config as Record<string, unknown>);
  if (body.apiKey) {
    const secrets = getSecrets();
    await secrets.set(tenantId, `email_${body.provider}_api_key`, body.apiKey);
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
  const apiKey = await secrets.get(tenantId, `email_${channelConfig.provider}_api_key`);
  if (!apiKey) {
    throw new OpenTelError(
      "CONFIG_ERROR",
      "Email API key not set. PATCH /channels/email with apiKey.",
      { tenantId }
    );
  }

  const config = (channelConfig.config ?? {}) as Record<string, string>;
  const from = body.from ?? config.from ?? "noreply@example.com";

  let messageId: string;
  if (channelConfig.provider === "sendgrid") {
    const result = await sendViaSendGrid(apiKey, {
      to: body.to,
      from,
      subject: body.subject,
      bodyText: body.bodyText,
      bodyHtml: body.bodyHtml,
    });
    messageId = result.messageId;
  } else if (channelConfig.provider === "mailgun") {
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

if (process.env.NODE_ENV !== "test") {
  app.listen({ port, host: "0.0.0.0" }, (err) => {
    if (err) throw err;
    console.log(`API listening on http://localhost:${port}`);
  });
}

export { app };
