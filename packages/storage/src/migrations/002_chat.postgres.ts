import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("chat_threads")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("tenant_id", "uuid", (col) => col.notNull().references("tenants.id"))
    .addColumn("contact_id", "varchar(255)")
    .addColumn("state", "varchar(50)", (col) => col.notNull().defaultTo("open"))
    .addColumn("metadata", "jsonb")
    .addColumn("created_at", "timestamptz", (col) => col.defaultTo(sql`now()`).notNull())
    .addColumn("updated_at", "timestamptz", (col) => col.defaultTo(sql`now()`).notNull())
    .execute();

  await db.schema
    .createTable("chat_messages")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("thread_id", "uuid", (col) => col.notNull().references("chat_threads.id"))
    .addColumn("from_endpoint_id", "uuid", (col) => col.references("endpoints.id"))
    .addColumn("body", "text", (col) => col.notNull())
    .addColumn("metadata", "jsonb")
    .addColumn("created_at", "timestamptz", (col) => col.defaultTo(sql`now()`).notNull())
    .execute();

  await sql`CREATE INDEX IF NOT EXISTS idx_chat_threads_tenant ON chat_threads(tenant_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_chat_threads_contact ON chat_threads(contact_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages(thread_id)`.execute(db);
}
