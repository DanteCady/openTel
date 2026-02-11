import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE calls ADD COLUMN IF NOT EXISTS to_phone_number VARCHAR(32)`.execute(db);
  await sql`ALTER TABLE calls ADD COLUMN IF NOT EXISTS from_phone_number VARCHAR(32)`.execute(db);
  await sql`ALTER TABLE calls ALTER COLUMN to_endpoint_id DROP NOT NULL`.execute(db).catch(() => {});
  await sql`ALTER TABLE calls ALTER COLUMN from_endpoint_id DROP NOT NULL`.execute(db).catch(() => {});
}
