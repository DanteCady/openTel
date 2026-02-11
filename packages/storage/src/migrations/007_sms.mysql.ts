import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS sms_messages (
      id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      tenant_id CHAR(36) NOT NULL,
      direction VARCHAR(10) NOT NULL,
      from_number VARCHAR(50) NOT NULL,
      to_number VARCHAR(50) NOT NULL,
      body TEXT NOT NULL,
      provider_message_id VARCHAR(255),
      metadata JSON,
      created_at DATETIME(6) NOT NULL DEFAULT (CURRENT_TIMESTAMP(6)),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    )
  `.execute(db);

  await db.schema
    .createIndex("idx_sms_messages_tenant")
    .on("sms_messages")
    .column("tenant_id")
    .execute()
    .catch((err: { code?: string }) => {
      if (err?.code !== "ER_DUP_KEYNAME") throw err;
    });
}
