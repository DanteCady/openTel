import type { Database } from "./db.js";
import type { Kysely } from "kysely";
import { randomUUID } from "crypto";

export async function createTenant(
  db: Kysely<Database>,
  name: string,
  webhookUrl?: string | null
): Promise<{ id: string; name: string; webhookUrl: string | null; createdAt: Date }> {
  const existing = await db
    .selectFrom("tenants")
    .select(["id", "name", "webhook_url", "created_at"])
    .where("name", "=", name)
    .executeTakeFirst();

  if (existing) {
    return {
      id: existing.id,
      name: existing.name,
      webhookUrl: existing.webhook_url,
      createdAt: existing.created_at,
    };
  }

  const id = randomUUID();
  await db
    .insertInto("tenants")
    .values({
      id,
      name,
      webhook_url: webhookUrl ?? null,
      created_at: new Date(),
    })
    .execute();

  const row = await db.selectFrom("tenants").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
  return {
    id: row.id,
    name: row.name,
    webhookUrl: row.webhook_url,
    createdAt: row.created_at,
  };
}

export async function updateTenantWebhook(
  db: Kysely<Database>,
  tenantId: string,
  webhookUrl: string | null
): Promise<void> {
  await db
    .updateTable("tenants")
    .set({ webhook_url: webhookUrl })
    .where("id", "=", tenantId)
    .execute();
}

export async function getTenant(db: Kysely<Database>, tenantId: string) {
  return db
    .selectFrom("tenants")
    .select(["id", "name", "webhook_url", "created_at"])
    .where("id", "=", tenantId)
    .executeTakeFirst();
}

export async function createEndpoint(
  db: Kysely<Database>,
  tenantId: string,
  label: string,
  type = "webrtc"
): Promise<{ id: string; tenantId: string; label: string; type: string; createdAt: Date }> {
  const existing = await db
    .selectFrom("endpoints")
    .select(["id", "tenant_id", "label", "type", "created_at"])
    .where("tenant_id", "=", tenantId)
    .where("label", "=", label)
    .executeTakeFirst();

  if (existing) {
    return {
      id: existing.id,
      tenantId: existing.tenant_id,
      label: existing.label,
      type: existing.type,
      createdAt: existing.created_at,
    };
  }

  const id = randomUUID();
  await db
    .insertInto("endpoints")
    .values({
      id,
      tenant_id: tenantId,
      label,
      type,
      created_at: new Date(),
    })
    .execute();

  const row = await db
    .selectFrom("endpoints")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirstOrThrow();
  return {
    id: row.id,
    tenantId: row.tenant_id,
    label: row.label,
    type: row.type,
    createdAt: row.created_at,
  };
}

export async function getEndpoint(db: Kysely<Database>, endpointId: string) {
  return db
    .selectFrom("endpoints")
    .select(["id", "tenant_id", "label", "type", "agent_state", "created_at"])
    .where("id", "=", endpointId)
    .executeTakeFirst();
}

export async function listEndpoints(
  db: Kysely<Database>,
  tenantId: string,
  limit = 50,
  offset = 0
) {
  return db
    .selectFrom("endpoints")
    .select(["id", "tenant_id", "label", "type", "agent_state", "created_at"])
    .where("tenant_id", "=", tenantId)
    .limit(limit)
    .offset(offset)
    .execute();
}

export async function createCall(
  db: Kysely<Database>,
  tenantId: string,
  fromEndpointId: string | null,
  toEndpointId: string | null,
  metadata?: Record<string, string> | null,
  opts?: {
    toPhoneNumber?: string | null;
    fromPhoneNumber?: string | null;
    queueId?: string | null;
    direction?: string | null;
  }
): Promise<{ id: string; state: string }> {
  const id = randomUUID();
  const now = new Date();
  await db
    .insertInto("calls")
    .values({
      id,
      tenant_id: tenantId,
      from_endpoint_id: fromEndpointId,
      to_endpoint_id: toEndpointId,
      from_phone_number: opts?.fromPhoneNumber ?? null,
      to_phone_number: opts?.toPhoneNumber ?? null,
      queue_id: opts?.queueId ?? null,
      direction: opts?.direction ?? null,
      state: "CREATED",
      metadata: metadata ?? null,
      created_at: now,
      updated_at: now,
    })
    .execute();
  return { id, state: "CREATED" };
}

export async function updateCallState(
  db: Kysely<Database>,
  callId: string,
  state: string,
  answeredAt?: Date | null
): Promise<void> {
  const set: Record<string, unknown> = { state, updated_at: new Date() };
  if (answeredAt !== undefined) set.answered_at = answeredAt;
  await db.updateTable("calls").set(set).where("id", "=", callId).execute();
}

export async function updateCallToEndpoint(
  db: Kysely<Database>,
  callId: string,
  toEndpointId: string
): Promise<void> {
  await db
    .updateTable("calls")
    .set({ to_endpoint_id: toEndpointId, updated_at: new Date() })
    .where("id", "=", callId)
    .execute();
}

export async function getCall(db: Kysely<Database>, callId: string) {
  return db
    .selectFrom("calls")
    .selectAll()
    .where("id", "=", callId)
    .executeTakeFirst();
}

export async function listCalls(
  db: Kysely<Database>,
  tenantId: string,
  opts?: { state?: string; limit?: number; offset?: number }
) {
  let q = db
    .selectFrom("calls")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .orderBy("created_at", "desc");

  if (opts?.state) q = q.where("state", "=", opts.state);
  q = q.limit(opts?.limit ?? 50).offset(opts?.offset ?? 0);

  return q.execute();
}

// --- Chat ---

export async function createChatThread(
  db: Kysely<Database>,
  tenantId: string,
  opts?: { contactId?: string | null; metadata?: Record<string, string> | null }
) {
  const id = randomUUID();
  const now = new Date();
  await db
    .insertInto("chat_threads")
    .values({
      id,
      tenant_id: tenantId,
      contact_id: opts?.contactId ?? null,
      state: "open",
      metadata: opts?.metadata ?? null,
      created_at: now,
      updated_at: now,
    })
    .execute();
  const row = await db.selectFrom("chat_threads").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
  return row;
}

export async function getChatThread(db: Kysely<Database>, threadId: string) {
  return db
    .selectFrom("chat_threads")
    .selectAll()
    .where("id", "=", threadId)
    .executeTakeFirst();
}

export async function listChatThreads(
  db: Kysely<Database>,
  tenantId: string,
  opts?: { contactId?: string; limit?: number; offset?: number }
) {
  let q = db
    .selectFrom("chat_threads")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .orderBy("updated_at", "desc");

  if (opts?.contactId) q = q.where("contact_id", "=", opts.contactId);
  q = q.limit(opts?.limit ?? 50).offset(opts?.offset ?? 0);

  return q.execute();
}

export async function createChatMessage(
  db: Kysely<Database>,
  threadId: string,
  body: string,
  opts?: { fromEndpointId?: string | null; metadata?: Record<string, string> | null }
) {
  const id = randomUUID();
  const now = new Date();
  await db
    .insertInto("chat_messages")
    .values({
      id,
      thread_id: threadId,
      from_endpoint_id: opts?.fromEndpointId ?? null,
      body,
      metadata: opts?.metadata ?? null,
      created_at: now,
    })
    .execute();
  await db
    .updateTable("chat_threads")
    .set({ updated_at: now })
    .where("id", "=", threadId)
    .execute();
  const row = await db.selectFrom("chat_messages").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
  return row;
}

export async function listChatMessages(
  db: Kysely<Database>,
  threadId: string,
  opts?: { limit?: number; offset?: number }
) {
  return db
    .selectFrom("chat_messages")
    .selectAll()
    .where("thread_id", "=", threadId)
    .orderBy("created_at", "asc")
    .limit(opts?.limit ?? 100)
    .offset(opts?.offset ?? 0)
    .execute();
}

// --- Channel config ---

export async function getChannelConfig(
  db: Kysely<Database>,
  tenantId: string,
  channel: string
) {
  return db
    .selectFrom("channel_config")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .where("channel", "=", channel)
    .executeTakeFirst();
}

export async function upsertChannelConfig(
  db: Kysely<Database>,
  tenantId: string,
  channel: string,
  provider: string,
  config: Record<string, unknown> | null
) {
  const now = new Date();
  const existing = await getChannelConfig(db, tenantId, channel);
  if (existing) {
    await db
      .updateTable("channel_config")
      .set({ provider, config, updated_at: now })
      .where("id", "=", existing.id)
      .execute();
    return { id: existing.id, tenant_id: tenantId, channel, provider, config, created_at: existing.created_at, updated_at: now };
  }
  const id = randomUUID();
  await db
    .insertInto("channel_config")
    .values({
      id,
      tenant_id: tenantId,
      channel,
      provider,
      config,
      created_at: now,
      updated_at: now,
    })
    .execute();
  const row = await db.selectFrom("channel_config").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
  return row;
}

// --- Email ---

// --- Queues ---

export async function createQueue(
  db: Kysely<Database>,
  tenantId: string,
  name: string,
  opts?: { routingStrategy?: string; maxWaitSec?: number | null; overflowQueueId?: string | null }
) {
  const id = randomUUID();
  await db
    .insertInto("queues")
    .values({
      id,
      tenant_id: tenantId,
      name,
      routing_strategy: opts?.routingStrategy ?? "round-robin",
      max_wait_sec: opts?.maxWaitSec ?? null,
      overflow_queue_id: opts?.overflowQueueId ?? null,
      created_at: new Date(),
    })
    .execute();
  const row = await db.selectFrom("queues").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
  return row;
}

export async function getQueue(db: Kysely<Database>, queueId: string) {
  return db
    .selectFrom("queues")
    .selectAll()
    .where("id", "=", queueId)
    .executeTakeFirst();
}

export async function listQueues(
  db: Kysely<Database>,
  tenantId: string,
  opts?: { limit?: number; offset?: number }
) {
  return db
    .selectFrom("queues")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .orderBy("name", "asc")
    .limit(opts?.limit ?? 50)
    .offset(opts?.offset ?? 0)
    .execute();
}

export async function addQueueMember(
  db: Kysely<Database>,
  queueId: string,
  endpointId: string,
  opts?: { priority?: number; skills?: Record<string, unknown> | null }
) {
  const id = randomUUID();
  await db
    .insertInto("queue_members")
    .values({
      id,
      queue_id: queueId,
      endpoint_id: endpointId,
      priority: opts?.priority ?? 0,
      skills: opts?.skills ?? null,
      created_at: new Date(),
    })
    .execute();
  const row = await db
    .selectFrom("queue_members")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirstOrThrow();
  return row;
}

export async function removeQueueMember(db: Kysely<Database>, queueId: string, endpointId: string) {
  await db
    .deleteFrom("queue_members")
    .where("queue_id", "=", queueId)
    .where("endpoint_id", "=", endpointId)
    .execute();
}

export async function listQueueMembers(db: Kysely<Database>, queueId: string) {
  return db
    .selectFrom("queue_members")
    .selectAll()
    .where("queue_id", "=", queueId)
    .orderBy("priority", "desc")
    .orderBy("created_at", "asc")
    .execute();
}

export async function updateEndpointAgentState(
  db: Kysely<Database>,
  endpointId: string,
  agentState: string | null
) {
  await db
    .updateTable("endpoints")
    .set({ agent_state: agentState })
    .where("id", "=", endpointId)
    .execute();
}

// --- Email ---

export async function createEmailThread(
  db: Kysely<Database>,
  tenantId: string,
  opts?: { contactId?: string | null; externalId?: string | null; metadata?: Record<string, string> | null }
) {
  const id = randomUUID();
  const now = new Date();
  await db
    .insertInto("email_threads")
    .values({
      id,
      tenant_id: tenantId,
      contact_id: opts?.contactId ?? null,
      external_id: opts?.externalId ?? null,
      state: "open",
      metadata: opts?.metadata ?? null,
      created_at: now,
      updated_at: now,
    })
    .execute();
  const row = await db.selectFrom("email_threads").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
  return row;
}

export async function getEmailThread(db: Kysely<Database>, threadId: string) {
  return db
    .selectFrom("email_threads")
    .selectAll()
    .where("id", "=", threadId)
    .executeTakeFirst();
}

export async function createEmailMessage(
  db: Kysely<Database>,
  threadId: string,
  opts: {
    direction: string;
    fromAddress: string;
    toAddress: string;
    subject?: string | null;
    bodyText?: string | null;
    bodyHtml?: string | null;
    providerMessageId?: string | null;
    metadata?: Record<string, string> | null;
  }
) {
  const id = randomUUID();
  const now = new Date();
  await db
    .insertInto("email_messages")
    .values({
      id,
      thread_id: threadId,
      direction: opts.direction,
      from_address: opts.fromAddress,
      to_address: opts.toAddress,
      subject: opts.subject ?? null,
      body_text: opts.bodyText ?? null,
      body_html: opts.bodyHtml ?? null,
      provider_message_id: opts.providerMessageId ?? null,
      metadata: opts.metadata ?? null,
      created_at: now,
    })
    .execute();
  await db
    .updateTable("email_threads")
    .set({ updated_at: now })
    .where("id", "=", threadId)
    .execute();
  const row = await db.selectFrom("email_messages").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
  return row;
}

// --- SMS ---

export async function createSmsMessage(
  db: Kysely<Database>,
  tenantId: string,
  opts: {
    direction: string;
    fromNumber: string;
    toNumber: string;
    body: string;
    providerMessageId?: string | null;
    metadata?: Record<string, string> | null;
  }
) {
  const id = randomUUID();
  const now = new Date();
  await db
    .insertInto("sms_messages")
    .values({
      id,
      tenant_id: tenantId,
      direction: opts.direction,
      from_number: opts.fromNumber,
      to_number: opts.toNumber,
      body: opts.body,
      provider_message_id: opts.providerMessageId ?? null,
      metadata: opts.metadata ?? null,
      created_at: now,
    })
    .execute();
  const row = await db.selectFrom("sms_messages").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
  return row;
}

// --- Users (email auth for CCaaS) ---

export async function createUser(
  db: Kysely<Database>,
  email: string,
  passwordHash: string,
  tenantId: string,
  endpointId: string
): Promise<{ id: string; email: string; tenant_id: string; endpoint_id: string; created_at: Date }> {
  const id = randomUUID();
  await db
    .insertInto("users")
    .values({
      id,
      email: email.toLowerCase().trim(),
      password_hash: passwordHash,
      tenant_id: tenantId,
      endpoint_id: endpointId,
      created_at: new Date(),
    })
    .execute();
  const row = await db.selectFrom("users").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
  return row;
}

export async function getUserByEmail(
  db: Kysely<Database>,
  email: string
): Promise<{ id: string; email: string; password_hash: string; tenant_id: string; endpoint_id: string; created_at: Date } | undefined> {
  return db
    .selectFrom("users")
    .selectAll()
    .where("email", "=", email.toLowerCase().trim())
    .executeTakeFirst();
}
