import { getDb } from "./db.js";
import { createPostgresAdapter } from "./postgres-adapter.js";
import type { StorageAdapter } from "./adapter.js";

/**
 * Creates a StorageAdapter based on configuration.
 * Uses STORAGE_ADAPTER env (default: postgres) when DATABASE_URL is set.
 */
export function createStorageAdapter(dbUrl: string): StorageAdapter {
  const adapter = (process.env.STORAGE_ADAPTER || "postgres").toLowerCase();
  const db = getDb(dbUrl);

  switch (adapter) {
    case "postgres":
    case "mysql":
      return createPostgresAdapter(db);
    default:
      return createPostgresAdapter(db);
  }
}
