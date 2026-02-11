import type { Dialect } from "kysely";
import { PostgresDialect } from "kysely";
import { Pool } from "pg";

export function createPostgresDialect(url: string): Dialect {
  return new PostgresDialect({
    pool: new Pool({ connectionString: url }),
  });
}
