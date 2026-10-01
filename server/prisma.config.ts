import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.js",
  },
  datasource: {
    // Falls back to an empty string so `prisma generate` works before .env exists.
    url: process.env.DATABASE_URL ?? "",
  },
});
