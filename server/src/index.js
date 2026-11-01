import "dotenv/config";
import express from "express";
import cors from "cors";
import { prisma } from "./db.js";
import { errorHandler } from "./lib/errors.js";
import authRoutes from "./routes/auth.js";
import requestRoutes from "./routes/requests.js";
import propertyRoutes from "./routes/properties.js";
import photoRoutes from "./routes/photos.js";
import { UPLOAD_DIR, usingCloudinary } from "./services/storage.js";
import { startAiWarmup } from "./services/priority.js";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is missing. Add it to server/.env (see .env.example).");
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "100kb" }));

// Health check: confirms the API is up and can reach the database.
app.get("/api/health", async (_req, res) => {
  try {
    const [users, requests] = await Promise.all([
      prisma.user.count(),
      prisma.maintenanceRequest.count(),
    ]);
    res.json({ status: "ok", database: "connected", users, requests });
  } catch (err) {
    console.error(err);
    res.status(503).json({ status: "error", database: "unreachable" });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/requests/:id/photos", photoRoutes);
app.use("/api/requests", requestRoutes);
// Photos saved on this computer (only used when Cloudinary is not set up).
app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "7d", immutable: true }));
app.use("/api", propertyRoutes);
app.use("/api", (_req, res) => res.status(404).json({ error: "No such endpoint" }));

// Online, this same server also hands out the app itself (the built React
// files in client/dist), so the app and the API share one web address.
// Locally you use the Vite dev server instead, and this folder may not exist.
const CLIENT_DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/dist");
if (existsSync(CLIENT_DIST)) {
  app.use(
    express.static(CLIENT_DIST, {
      index: false,
      maxAge: "1h",
      // Always check for a new version of the page and the service worker.
      setHeaders: (res, file) => {
        if (/(\.html|sw\.js|registerSW\.js|manifest\.webmanifest)$/.test(file)) res.setHeader("Cache-Control", "no-cache");
      },
    }),
  );
  // Any other address is a page inside the app (e.g. /requests/5).
  app.get(/^\/(?!api\/|uploads\/).*/, (_req, res) => res.sendFile(path.join(CLIENT_DIST, "index.html")));
}

app.use((_req, res) => res.status(404).json({ error: "No such endpoint" }));
app.use(errorHandler);

const port = Number(process.env.PORT) || 4000;
app.listen(port, (err) => {
  if (err) {
    if (err.code === "EADDRINUSE") {
      console.error(`Port ${port} is already in use. The server is probably already running in another terminal.`);
    } else {
      console.error("Server failed to start:", err.message);
    }
    process.exit(1);
  }
  console.log(`TMS API running on http://localhost:${port}`);
  console.log(`Photos are stored ${usingCloudinary() ? "on Cloudinary" : "in server/uploads (Cloudinary not set up)"}`);
  if (existsSync(CLIENT_DIST)) console.log("Also serving the app from client/dist");
  startAiWarmup();
});
