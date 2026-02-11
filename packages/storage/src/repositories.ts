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

export async function listEndpoints(
  db: Kysely<Database>,
  tenantId: string,
  limit = 50,
  offset = 0
) {
  return db
    .selectFrom("endpoints")
    .select(["id", "tenant_id", "label", "type", "created_at"])
    .where("tenant_id", "=", tenantId)
    .limit(limit)
    .offset(offset)
    .execute();
}

export async function createCall(
  db: Kysely<Database>,
  tenantId: string,
  fromEndpointId: string,
  toEndpointId: string,
  metadata?: Record<string, string> | null
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
