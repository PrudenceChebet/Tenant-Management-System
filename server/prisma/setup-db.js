// Prepares an online database on start-up (used on Render):
//   1. If the tables don't exist yet, creates them from prisma/init.sql.
//   2. If there are no users yet, adds the demo data (prisma/seed.js),
//      so the demo accounts work straight away.
// On later starts it finds both done and changes nothing.
//
// Run: node prisma/setup-db.js

import { readFile } from "node:fs/promises";
import { prisma } from "../src/db.js";

async function tablesExist() {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND LOWER(table_name) = 'user'",
  );
  return Number(rows[0].n) > 0;
}

async function main() {
  if (await tablesExist()) {
    console.log("Database tables already exist.");
  } else {
    console.log("Creating database tables...");
    const sql = await readFile(new URL("./init.sql", import.meta.url), "utf8");
    const statements = sql
      .split(/;\s*(?:\r?\n|$)/)
      .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
      .filter(Boolean);
    for (const statement of statements) await prisma.$executeRawUnsafe(statement);
    console.log(`Created ${statements.length} tables.`);
  }

  const users = await prisma.user.count();
  if (users === 0) {
    console.log("No users yet, adding demo data...");
    await import("./seed.js"); // seed.js runs by itself and disconnects when done
  } else {
    console.log(`Database has ${users} users, leaving data as it is.`);
    await prisma.$disconnect();
  }
}

main().catch(async (err) => {
  console.error("Database setup failed:", err.message);
  await prisma.$disconnect();
  process.exit(1);
});
