// One shared Prisma client for the whole API.
// Prisma 7 talks to MySQL through a driver adapter (no separate engine binary).
import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "./generated/prisma/client.ts";

const url = new URL(process.env.DATABASE_URL);

const adapter = new PrismaMariaDb({
  host: url.hostname,
  port: Number(url.port) || 3306,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
  connectionLimit: 5,
  // MySQL 8 uses caching_sha2_password; this lets the driver fetch the key locally.
  allowPublicKeyRetrieval: true,
});

export const prisma = new PrismaClient({ adapter });
