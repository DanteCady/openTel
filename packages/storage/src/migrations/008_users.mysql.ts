import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      tenant_id CHAR(36) NOT NULL,
      endpoint_id CHAR(36) NOT NULL,
      created_at DATETIME(6) NOT NULL DEFAULT (CURRENT_TIMESTAMP(6)),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (endpoint_id) REFERENCES endpoints(id)
    )
  `.execute(db);
}
