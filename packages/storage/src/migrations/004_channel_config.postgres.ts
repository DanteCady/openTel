import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("channel_config")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("tenant_id", "uuid", (col) => col.notNull().references("tenants.id"))
    .addColumn("channel", "varchar(20)", (col) => col.notNull())
    .addColumn("provider", "varchar(50)", (col) => col.notNull())
    .addColumn("config", "jsonb")
    .addColumn("created_at", "timestamptz", (col) => col.defaultTo(sql`now()`).notNull())
    .addColumn("updated_at", "timestamptz", (col) => col.defaultTo(sql`now()`).notNull())
    .execute();

  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_config_tenant_channel ON channel_config(tenant_id, channel)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_channel_config_tenant ON channel_config(tenant_id)`.execute(db);
}
