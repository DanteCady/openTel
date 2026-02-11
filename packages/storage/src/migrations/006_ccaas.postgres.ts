import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("queues")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("tenant_id", "uuid", (col) => col.notNull().references("tenants.id"))
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .addColumn("routing_strategy", "varchar(50)", (col) => col.notNull().defaultTo("round-robin"))
    .addColumn("max_wait_sec", "integer")
    .addColumn("overflow_queue_id", "uuid", (col) => col.references("queues.id"))
    .addColumn("created_at", "timestamptz", (col) => col.defaultTo(sql`now()`).notNull())
    .execute();

  await db.schema
    .createTable("queue_members")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("queue_id", "uuid", (col) => col.notNull().references("queues.id"))
    .addColumn("endpoint_id", "uuid", (col) => col.notNull().references("endpoints.id"))
    .addColumn("priority", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("skills", "jsonb")
    .addColumn("created_at", "timestamptz", (col) => col.defaultTo(sql`now()`).notNull())
    .execute();

  await sql`ALTER TABLE endpoints ADD COLUMN IF NOT EXISTS agent_state VARCHAR(50) DEFAULT 'available'`.execute(db);
  await sql`ALTER TABLE calls ADD COLUMN IF NOT EXISTS queue_id UUID REFERENCES queues(id)`.execute(db);
  await sql`ALTER TABLE calls ADD COLUMN IF NOT EXISTS direction VARCHAR(20)`.execute(db);

  await sql`CREATE INDEX IF NOT EXISTS idx_queues_tenant ON queues(tenant_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_queue_members_queue ON queue_members(queue_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_queue_members_endpoint ON queue_members(endpoint_id)`.execute(db);
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_queue_members_unique ON queue_members(queue_id, endpoint_id)`.execute(db);
}
