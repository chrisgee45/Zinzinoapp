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
import siteContentRoutes from "./routes/site-content.js";
import uploadRoutes from "./routes/uploads.js";
import billingRoutes, { webhookHandler as stripeWebhookHandler } from "./routes/billing.js";
import adminRoutes from "./routes/admin.js";
import coachRoutes from "./routes/coach.js";
import calendarRoutes from "./routes/calendar.js";
import analyticsRoutes from "./routes/analytics.js";
import productRoutes from "./routes/products.js";
import customerRoutes from "./routes/customers.js";
import { inboundEmailHandler } from "./routes/bot-webhook.js";
import { runCatchup } from "./bot/scheduler.js";
import { runCalendarCatchup } from "./calendar/scheduler.js";
import { seedAdmin } from "./seed.js";
import { bootstrapSchema } from "./bootstrap-schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const PORT = Number(process.env.PORT ?? 5000);
const isProd = process.env.NODE_ENV === "production";

app.set("trust proxy", 1);

// Webhooks MUST be mounted before express.json() so they can read the raw body.
app.post("/api/billing/webhook", ...stripeWebhookHandler);
app.post("/api/bot/inbound-email", ...inboundEmailHandler);

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
// Advisor + customer-care AI calls go to Anthropic — much more expensive
// than a normal API hit, so we cap per partner more strictly. 30/min lets
// a real partner stay productive but stops a runaway client.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
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
app.use("/api/site-content", siteContentRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/coach", coachRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/products", aiLimiter, productRoutes);
app.use("/api/customers", aiLimiter, customerRoutes);

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
  await bootstrapSchema();
  await seedAdmin();
  app.listen(PORT, () => {
    console.log(`[server] BFA platform listening on :${PORT} (${isProd ? "prod" : "dev"})`);
  });
  // Boot catchup runs after 5s — let listen settle, then re-schedule any
  // missed warm-sequence touches with a stagger so we don't fan out at once.
  setTimeout(() => {
    void runCatchup().catch((e) => console.warn("[bot] catchup failed:", e));
    void runCalendarCatchup().catch((e) => console.warn("[calendar] catchup failed:", e));
  }, 5000);
}

// Don't let a single unhandled DB error or async hiccup tear the process down —
// Railway will see the exit and serve a 502 for the next ~30s during restart.
process.on("unhandledRejection", (reason) => {
  console.error("[server] unhandledRejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[server] uncaughtException:", err);
});

start().catch((err) => {
  console.error("[server] Failed to start:", err);
  process.exit(1);
});
