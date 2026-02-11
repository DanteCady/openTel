import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS queues (
      id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      tenant_id CHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      routing_strategy VARCHAR(50) NOT NULL DEFAULT 'round-robin',
      max_wait_sec INT,
      overflow_queue_id CHAR(36),
      created_at DATETIME(6) NOT NULL DEFAULT (CURRENT_TIMESTAMP(6)),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (overflow_queue_id) REFERENCES queues(id)
    )
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS queue_members (
      id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      queue_id CHAR(36) NOT NULL,
      endpoint_id CHAR(36) NOT NULL,
      priority INT NOT NULL DEFAULT 0,
      skills JSON,
      created_at DATETIME(6) NOT NULL DEFAULT (CURRENT_TIMESTAMP(6)),
      FOREIGN KEY (queue_id) REFERENCES queues(id),
      FOREIGN KEY (endpoint_id) REFERENCES endpoints(id),
      UNIQUE KEY idx_queue_members_unique (queue_id, endpoint_id)
    )
  `.execute(db);

  await sql`ALTER TABLE endpoints ADD COLUMN agent_state VARCHAR(50) DEFAULT 'available'`.execute(db).catch((err: { code?: string }) => {
    if (err?.code !== "ER_DUP_FIELDNAME") throw err;
  });

  await sql`ALTER TABLE calls ADD COLUMN queue_id CHAR(36)`.execute(db).catch((err: { code?: string }) => {
    if (err?.code !== "ER_DUP_FIELDNAME") throw err;
  });
  await sql`ALTER TABLE calls ADD COLUMN direction VARCHAR(20)`.execute(db).catch((err: { code?: string }) => {
    if (err?.code !== "ER_DUP_FIELDNAME") throw err;
  });

  await db.schema
    .createIndex("idx_queues_tenant")
    .on("queues")
    .column("tenant_id")
    .execute()
    .catch((err: { code?: string }) => {
      if (err?.code !== "ER_DUP_KEYNAME") throw err;
    });

  await db.schema
    .createIndex("idx_queue_members_queue")
    .on("queue_members")
    .column("queue_id")
    .execute()
    .catch((err: { code?: string }) => {
      if (err?.code !== "ER_DUP_KEYNAME") throw err;
    });

  await db.schema
    .createIndex("idx_queue_members_endpoint")
    .on("queue_members")
    .column("endpoint_id")
    .execute()
    .catch((err: { code?: string }) => {
      if (err?.code !== "ER_DUP_KEYNAME") throw err;
    });
}
