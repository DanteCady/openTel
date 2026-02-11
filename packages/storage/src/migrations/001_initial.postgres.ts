import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("tenants")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .addColumn("webhook_url", "text")
    .addColumn("created_at", "timestamptz", (col) => col.defaultTo(sql`now()`).notNull())
    .execute();

  await db.schema
    .createTable("endpoints")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("tenant_id", "uuid", (col) => col.notNull().references("tenants.id"))
    .addColumn("label", "varchar(255)", (col) => col.notNull())
    .addColumn("type", "varchar(50)", (col) => col.notNull().defaultTo("webrtc"))
    .addColumn("created_at", "timestamptz", (col) => col.defaultTo(sql`now()`).notNull())
    .execute();

  await db.schema
    .createTable("calls")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("tenant_id", "uuid", (col) => col.notNull().references("tenants.id"))
    .addColumn("from_endpoint_id", "uuid", (col) => col.notNull().references("endpoints.id"))
    .addColumn("to_endpoint_id", "uuid", (col) => col.notNull().references("endpoints.id"))
    .addColumn("state", "varchar(50)", (col) => col.notNull())
    .addColumn("metadata", "jsonb")
    .addColumn("created_at", "timestamptz", (col) => col.defaultTo(sql`now()`).notNull())
    .addColumn("updated_at", "timestamptz", (col) => col.defaultTo(sql`now()`).notNull())
    .addColumn("answered_at", "timestamptz")
    .execute();

  await db.schema
    .createIndex("idx_endpoints_tenant")
    .on("endpoints")
    .column("tenant_id")
    .execute();

  await db.schema
    .createIndex("idx_calls_tenant")
    .on("calls")
    .column("tenant_id")
    .execute();
}
