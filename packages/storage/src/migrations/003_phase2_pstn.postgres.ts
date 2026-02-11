import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("calls")
    .addColumn("to_phone_number", "varchar(32)")
    .execute();
  await db.schema
    .alterTable("calls")
    .addColumn("from_phone_number", "varchar(32)")
    .execute();
  await db.schema
    .alterTable("calls")
    .alterColumn("to_endpoint_id", (col) => col.dropNotNull())
    .execute();
  await db.schema
    .alterTable("calls")
    .alterColumn("from_endpoint_id", (col) => col.dropNotNull())
    .execute();
}
