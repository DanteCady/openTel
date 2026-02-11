import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS chat_threads (
      id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      tenant_id CHAR(36) NOT NULL,
      contact_id VARCHAR(255),
      state VARCHAR(50) NOT NULL DEFAULT 'open',
      metadata JSON,
      created_at DATETIME(6) NOT NULL DEFAULT (CURRENT_TIMESTAMP(6)),
      updated_at DATETIME(6) NOT NULL DEFAULT (CURRENT_TIMESTAMP(6)),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    )
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      thread_id CHAR(36) NOT NULL,
      from_endpoint_id CHAR(36),
      body TEXT NOT NULL,
      metadata JSON,
      created_at DATETIME(6) NOT NULL DEFAULT (CURRENT_TIMESTAMP(6)),
      FOREIGN KEY (thread_id) REFERENCES chat_threads(id),
      FOREIGN KEY (from_endpoint_id) REFERENCES endpoints(id)
    )
  `.execute(db);

  await db.schema
    .createIndex("idx_chat_threads_tenant")
    .on("chat_threads")
    .column("tenant_id")
    .execute()
    .catch((err: { code?: string }) => {
      if (err?.code !== "ER_DUP_KEYNAME") throw err;
    });

  await db.schema
    .createIndex("idx_chat_threads_contact")
    .on("chat_threads")
    .column("contact_id")
    .execute()
    .catch((err: { code?: string }) => {
      if (err?.code !== "ER_DUP_KEYNAME") throw err;
    });

  await db.schema
    .createIndex("idx_chat_messages_thread")
    .on("chat_messages")
    .column("thread_id")
    .execute()
    .catch((err: { code?: string }) => {
      if (err?.code !== "ER_DUP_KEYNAME") throw err;
    });
}
