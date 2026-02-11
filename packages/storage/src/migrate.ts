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
    const { up: up1 } = await import("./migrations/001_initial.postgres.js");
    await up1(db);
    console.log("Ran 001_initial (postgres)");
    const { up: up2 } = await import("./migrations/002_chat.postgres.js");
    await up2(db);
    console.log("Ran 002_chat (postgres)");
  } else {
    const { up: up1 } = await import("./migrations/001_initial.mysql.js");
    await up1(db);
    console.log("Ran 001_initial (mysql)");
    const { up: up2 } = await import("./migrations/002_chat.mysql.js");
    await up2(db);
    console.log("Ran 002_chat (mysql)");
  }

  await db.destroy();
}

migrate().catch(console.error);
