import "dotenv/config";
import { Kysely } from "kysely";
import type { Database } from "./db.js";
import { createDialect, getDatabaseFlavor } from "./dialect.js";

const url = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5433/opentel";

async function migrate() {
  const flavor = getDatabaseFlavor(url);
  const db = new Kysely<Database>({
    dialect: createDialect(url),
  });

  if (flavor === "postgres") {
    const { up } = await import("./migrations/001_initial.postgres.js");
    await up(db);
    console.log("Ran 001_initial (postgres)");
  } else {
    const { up } = await import("./migrations/001_initial.mysql.js");
    await up(db);
    console.log("Ran 001_initial (mysql)");
  }

  await db.destroy();
}

migrate().catch(console.error);
