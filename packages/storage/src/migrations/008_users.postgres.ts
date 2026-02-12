import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("users")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("email", "varchar(255)", (col) => col.notNull().unique())
    .addColumn("password_hash", "varchar(255)", (col) => col.notNull())
    .addColumn("tenant_id", "uuid", (col) => col.notNull().references("tenants.id"))
    .addColumn("endpoint_id", "uuid", (col) => col.notNull().references("endpoints.id"))
    .addColumn("created_at", "timestamptz", (col) => col.defaultTo(sql`now()`).notNull())
    .execute();

  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)`.execute(db);
}
