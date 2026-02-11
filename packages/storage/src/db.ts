import { Kysely } from "kysely";
import { createDialect } from "./dialect.js";

export interface Database {
  tenants: {
    id: string;
    name: string;
    webhook_url: string | null;
    created_at: Date;
  };
  endpoints: {
    id: string;
    tenant_id: string;
    label: string;
    type: string;
    created_at: Date;
  };
  calls: {
    id: string;
    tenant_id: string;
    from_endpoint_id: string;
    to_endpoint_id: string;
    state: string;
    metadata: Record<string, string> | null;
    created_at: Date;
    updated_at: Date;
    answered_at: Date | null;
  };
  chat_threads: {
    id: string;
    tenant_id: string;
    contact_id: string | null;
    state: string;
    metadata: Record<string, string> | null;
    created_at: Date;
    updated_at: Date;
  };
  chat_messages: {
    id: string;
    thread_id: string;
    from_endpoint_id: string | null;
    body: string;
    metadata: Record<string, string> | null;
    created_at: Date;
  };
}

let db: Kysely<Database> | null = null;

export function getDb(url: string): Kysely<Database> {
  if (!db) {
    db = new Kysely<Database>({
      dialect: createDialect(url),
    });
  }
  return db;
}
