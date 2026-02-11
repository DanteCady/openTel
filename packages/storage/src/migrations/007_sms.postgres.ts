import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("sms_messages")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("tenant_id", "uuid", (col) => col.notNull().references("tenants.id"))
    .addColumn("direction", "varchar(10)", (col) => col.notNull())
    .addColumn("from_number", "varchar(50)", (col) => col.notNull())
    .addColumn("to_number", "varchar(50)", (col) => col.notNull())
    .addColumn("body", "text", (col) => col.notNull())
    .addColumn("provider_message_id", "varchar(255)")
    .addColumn("metadata", "jsonb")
    .addColumn("created_at", "timestamptz", (col) => col.defaultTo(sql`now()`).notNull())
    .execute();

  await sql`CREATE INDEX IF NOT EXISTS idx_sms_messages_tenant ON sms_messages(tenant_id)`.execute(db);
}
