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
    const { up: up3 } = await import("./migrations/003_phase2_pstn.postgres.js");
    await up3(db);
    console.log("Ran 003_phase2_pstn (postgres)");
    const { up: up4 } = await import("./migrations/004_channel_config.postgres.js");
    await up4(db);
    console.log("Ran 004_channel_config (postgres)");
    const { up: up5 } = await import("./migrations/005_email.postgres.js");
    await up5(db);
    console.log("Ran 005_email (postgres)");
    const { up: up7 } = await import("./migrations/007_sms.postgres.js");
    await up7(db);
    console.log("Ran 007_sms (postgres)");
    const { up: up8 } = await import("./migrations/008_users.postgres.js");
    await up8(db);
    console.log("Ran 008_users (postgres)");
  } else {
    const { up: up1 } = await import("./migrations/001_initial.mysql.js");
    await up1(db);
    console.log("Ran 001_initial (mysql)");
    const { up: up2 } = await import("./migrations/002_chat.mysql.js");
    await up2(db);
    console.log("Ran 002_chat (mysql)");
    const { up: up4 } = await import("./migrations/004_channel_config.mysql.js");
    await up4(db);
    console.log("Ran 004_channel_config (mysql)");
    const { up: up5 } = await import("./migrations/005_email.mysql.js");
    await up5(db);
    console.log("Ran 005_email (mysql)");
    const { up: up7 } = await import("./migrations/007_sms.mysql.js");
    await up7(db);
    console.log("Ran 007_sms (mysql)");
    const { up: up8 } = await import("./migrations/008_users.mysql.js");
    await up8(db);
    console.log("Ran 008_users (mysql)");
  }

  await db.destroy();
}

migrate().catch(console.error);
