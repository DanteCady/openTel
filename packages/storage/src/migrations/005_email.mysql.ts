import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS email_threads (
      id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      tenant_id CHAR(36) NOT NULL,
      contact_id VARCHAR(255),
      external_id VARCHAR(255),
      state VARCHAR(50) NOT NULL DEFAULT 'open',
      metadata JSON,
      created_at DATETIME(6) NOT NULL DEFAULT (CURRENT_TIMESTAMP(6)),
      updated_at DATETIME(6) NOT NULL DEFAULT (CURRENT_TIMESTAMP(6)),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    )
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS email_messages (
      id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      thread_id CHAR(36) NOT NULL,
      direction VARCHAR(10) NOT NULL,
      from_address VARCHAR(255) NOT NULL,
      to_address VARCHAR(255) NOT NULL,
      subject TEXT,
      body_text TEXT,
      body_html TEXT,
      provider_message_id VARCHAR(255),
      metadata JSON,
      created_at DATETIME(6) NOT NULL DEFAULT (CURRENT_TIMESTAMP(6)),
      FOREIGN KEY (thread_id) REFERENCES email_threads(id)
    )
  `.execute(db);

  await db.schema
    .createIndex("idx_email_threads_tenant")
    .on("email_threads")
    .column("tenant_id")
    .execute()
    .catch((err: { code?: string }) => {
      if (err?.code !== "ER_DUP_KEYNAME") throw err;
    });

  await db.schema
    .createIndex("idx_email_messages_thread")
    .on("email_messages")
    .column("thread_id")
    .execute()
    .catch((err: { code?: string }) => {
      if (err?.code !== "ER_DUP_KEYNAME") throw err;
    });
}
