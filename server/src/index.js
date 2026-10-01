import "dotenv/config";
import express from "express";
import cors from "cors";
import { prisma } from "./db.js";
import { errorHandler } from "./lib/errors.js";
import authRoutes from "./routes/auth.js";
import requestRoutes from "./routes/requests.js";
import propertyRoutes from "./routes/properties.js";

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
app.use("/api/requests", requestRoutes);
app.use("/api", propertyRoutes);

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
});
