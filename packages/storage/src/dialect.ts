import type { Dialect } from "kysely";
import { createMysqlDialect } from "./dialect-mysql.js";
import { createPostgresDialect } from "./dialect-postgres.js";

export type DatabaseFlavor = "postgres" | "mysql";

export function getDatabaseFlavor(url: string): DatabaseFlavor {
  const u = url.trim().toLowerCase();
  if (u.startsWith("mysql://") || u.startsWith("mysql2://")) return "mysql";
  return "postgres";
}

export function createDialect(url: string): Dialect {
  return getDatabaseFlavor(url) === "mysql" ? createMysqlDialect(url) : createPostgresDialect(url);
}
