// One shared Prisma client for the whole API.
// Prisma 7 talks to MySQL through a driver adapter (no separate engine binary).
import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "./generated/prisma/client.ts";

const url = new URL(process.env.DATABASE_URL);

// Online databases (like Aiven) only accept encrypted connections. Their
// connection string ends in ?ssl-mode=REQUIRED (or ?sslaccept=...), which
// switches encryption on here. Local XAMPP needs none of this.
//   DATABASE_CA   optional: the database's CA certificate (PEM text). With it,
//                 the server's certificate is checked too.
function sslOptions() {
  const mode = (url.searchParams.get("ssl-mode") || url.searchParams.get("sslmode") || "").toUpperCase();
  const accept = url.searchParams.get("sslaccept");
  const wanted = (mode && mode !== "DISABLED") || accept || process.env.DATABASE_SSL === "true";
  if (!wanted) return undefined;
  if (process.env.DATABASE_CA) return { ca: process.env.DATABASE_CA.replace(/\\n/g, "\n"), rejectUnauthorized: true };
  return { rejectUnauthorized: accept === "strict" };
}

const adapter = new PrismaMariaDb({
  host: url.hostname,
  port: Number(url.port) || 3306,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
  connectionLimit: 5,
  // MySQL 8 uses caching_sha2_password; this lets the driver fetch the key locally.
  allowPublicKeyRetrieval: true,
  ssl: sslOptions(),
});

export const prisma = new PrismaClient({ adapter });
