import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("email_threads")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("tenant_id", "uuid", (col) => col.notNull().references("tenants.id"))
    .addColumn("contact_id", "varchar(255)")
    .addColumn("external_id", "varchar(255)")
    .addColumn("state", "varchar(50)", (col) => col.notNull().defaultTo("open"))
    .addColumn("metadata", "jsonb")
    .addColumn("created_at", "timestamptz", (col) => col.defaultTo(sql`now()`).notNull())
    .addColumn("updated_at", "timestamptz", (col) => col.defaultTo(sql`now()`).notNull())
    .execute();

  await db.schema
    .createTable("email_messages")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("thread_id", "uuid", (col) => col.notNull().references("email_threads.id"))
    .addColumn("direction", "varchar(10)", (col) => col.notNull())
    .addColumn("from_address", "varchar(255)", (col) => col.notNull())
    .addColumn("to_address", "varchar(255)", (col) => col.notNull())
    .addColumn("subject", "text")
    .addColumn("body_text", "text")
    .addColumn("body_html", "text")
    .addColumn("provider_message_id", "varchar(255)")
    .addColumn("metadata", "jsonb")
    .addColumn("created_at", "timestamptz", (col) => col.defaultTo(sql`now()`).notNull())
    .execute();

  await sql`CREATE INDEX IF NOT EXISTS idx_email_threads_tenant ON email_threads(tenant_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_email_messages_thread ON email_messages(thread_id)`.execute(db);
}
