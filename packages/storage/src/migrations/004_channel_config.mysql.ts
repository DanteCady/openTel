import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS channel_config (
      id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      tenant_id CHAR(36) NOT NULL,
      channel VARCHAR(20) NOT NULL,
      provider VARCHAR(50) NOT NULL,
      config JSON,
      created_at DATETIME(6) NOT NULL DEFAULT (CURRENT_TIMESTAMP(6)),
      updated_at DATETIME(6) NOT NULL DEFAULT (CURRENT_TIMESTAMP(6)),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      UNIQUE KEY idx_channel_config_tenant_channel (tenant_id, channel)
    )
  `.execute(db);

  await db.schema
    .createIndex("idx_channel_config_tenant")
    .on("channel_config")
    .column("tenant_id")
    .execute()
    .catch((err: { code?: string }) => {
      if (err?.code !== "ER_DUP_KEYNAME") throw err;
    });
}
