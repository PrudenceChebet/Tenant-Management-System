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
app.listen(port, () => console.log(`TMS API running on http://localhost:${port}`));
