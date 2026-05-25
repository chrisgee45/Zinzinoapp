import "dotenv/config";
import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

import authRoutes from "./routes/auth.js";
import partnerRoutes from "./routes/partners.js";
import leadRoutes from "./routes/leads.js";
import pushRoutes from "./routes/push.js";
import visitRoutes from "./routes/visits.js";
import { seedAdmin } from "./seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const PORT = Number(process.env.PORT ?? 5000);
const isProd = process.env.NODE_ENV === "production";

app.set("trust proxy", 1);
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.use(
  cors({
    origin: isProd ? true : ["http://localhost:5173", "http://localhost:5000"],
    credentials: true,
  }),
);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
const leadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/partner", partnerRoutes);
app.use("/api/leads", leadLimiter, leadRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/page-visits", visitRoutes);

if (isProd) {
  // esbuild emits dist/server.js, vite emits dist/client/* — so the built
  // client lives next to the server bundle.
  const candidates = [
    path.resolve(__dirname, "./client"),
    path.resolve(__dirname, "../client"),
    path.resolve(process.cwd(), "dist/client"),
  ];
  const clientDir = candidates.find((p) => fs.existsSync(path.join(p, "index.html")));
  if (clientDir) {
    app.use(express.static(clientDir, { maxAge: "1h", index: false }));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api/") || req.path.startsWith("/t/")) return next();
      res.sendFile(path.join(clientDir, "index.html"));
    });
  } else {
    console.warn("[server] No built client found — only API routes will respond.");
  }
}

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error("[server]", err);
  if (res.headersSent) return;
  res.status(500).json({ error: "Internal server error" });
};
app.use(errorHandler);

async function start(): Promise<void> {
  await seedAdmin();
  app.listen(PORT, () => {
    console.log(`[server] BFA platform listening on :${PORT} (${isProd ? "prod" : "dev"})`);
  });
}

start().catch((err) => {
  console.error("[server] Failed to start:", err);
  process.exit(1);
});
