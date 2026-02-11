import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS tenants (
      id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      name VARCHAR(255) NOT NULL,
      webhook_url TEXT,
      created_at DATETIME(6) NOT NULL DEFAULT (CURRENT_TIMESTAMP(6))
    )
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS endpoints (
      id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      tenant_id CHAR(36) NOT NULL,
      label VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL DEFAULT 'webrtc',
      created_at DATETIME(6) NOT NULL DEFAULT (CURRENT_TIMESTAMP(6)),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    )
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS calls (
      id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      tenant_id CHAR(36) NOT NULL,
      from_endpoint_id CHAR(36) NOT NULL,
      to_endpoint_id CHAR(36) NOT NULL,
      state VARCHAR(50) NOT NULL,
      metadata JSON,
      created_at DATETIME(6) NOT NULL DEFAULT (CURRENT_TIMESTAMP(6)),
      updated_at DATETIME(6) NOT NULL DEFAULT (CURRENT_TIMESTAMP(6)),
      answered_at DATETIME(6) NULL,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (from_endpoint_id) REFERENCES endpoints(id),
      FOREIGN KEY (to_endpoint_id) REFERENCES endpoints(id)
    )
  `.execute(db);

  await db.schema
    .createIndex("idx_endpoints_tenant")
    .on("endpoints")
    .column("tenant_id")
    .execute()
    .catch((err: { code?: string }) => {
      if (err?.code !== "ER_DUP_KEYNAME") throw err;
    });

  await db.schema
    .createIndex("idx_calls_tenant")
    .on("calls")
    .column("tenant_id")
    .execute()
    .catch((err: { code?: string }) => {
      if (err?.code !== "ER_DUP_KEYNAME") throw err;
    });
}
