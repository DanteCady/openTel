import type { Dialect } from "kysely";
import { MysqlDialect } from "kysely";
import { createPool } from "mysql2";

export function createMysqlDialect(url: string): Dialect {
  const parsed = new URL(url.replace(/^mysql2:/, "mysql:"));
  const pool = createPool({
    host: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port, 10) : 3306,
    user: parsed.username || undefined,
    password: parsed.password || undefined,
    database: parsed.pathname ? parsed.pathname.slice(1) : undefined,
  });
  // mysql2 Pool type doesn't exactly match Kysely's MysqlPool interface
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new MysqlDialect({ pool } as any);
}
