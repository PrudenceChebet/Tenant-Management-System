import "dotenv/config";
import express from "express";
import cors from "cors";
import { prisma } from "./db.js";

const app = express();
app.use(cors());
app.use(express.json());

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
