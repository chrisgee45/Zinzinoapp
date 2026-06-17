// Customer-Care CRM routes. Customers are the post-sale equivalent of leads
// — distinct table, distinct surface in the UI. Surfaces:
//
//   GET    /api/customers                  → list
//   POST   /api/customers                  → create (optionally auto-welcome)
//   GET    /api/customers/:id              → detail + email thread
//   PATCH  /api/customers/:id              → name/email/phone/notes
//   DELETE /api/customers/:id              → cascade emails too
//   POST   /api/customers/:id/welcome      → manually fire welcome
//   POST   /api/customers/:id/drip         → manually fire monthly drip
//   POST   /api/customers/:id/pause        → set ai_paused=true
//   POST   /api/customers/:id/resume       → set ai_paused=false
//   POST   /api/customers/:id/reply        → simulate inbound (for testing)

import { Router } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db.js";
import { customers, customerEmails } from "../../shared/schema.js";
import { authenticate } from "../middleware/auth.js";
import {
  sendWelcomeEmail,
  sendMonthlyDrip,
  sendInboundAutoReply,
} from "../products/customerCare.js";

const router = Router();

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(60).optional().or(z.literal("")),
  notes: z.string().trim().max(5000).optional().or(z.literal("")),
  sendWelcome: z.boolean().optional().default(true),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  phone: z.string().trim().max(60).nullable().optional(),
  notes: z.string().trim().max(5000).optional(),
});

router.get("/", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  // Schema-drift safe: if the customers table hasn't been created on
  // this database yet (migration 0012 not applied + bootstrap pending),
  // return an empty list with ok=true so the dashboard renders the
  // empty state instead of TanStack Query retrying forever on a 500.
  try {
    const rows = await db
      .select()
      .from(customers)
      .where(eq(customers.partnerId, req.partner.id))
      .orderBy(desc(customers.createdAt));
    res.json({ customers: rows });
  } catch (err) {
    console.warn("[customers] list failed (likely schema-drift):", (err as Error).message);
    res.json({ customers: [] });
  }
});

router.post("/", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.flatten() });
    return;
  }
  const partnerId = req.partner.id;
  const email = parsed.data.email.toLowerCase();

  let created;
  try {
    // Dedupe at the partner+email level — matches the unique index.
    const [existing] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.partnerId, partnerId), eq(customers.email, email)))
      .limit(1);
    if (existing) {
      res.status(409).json({ error: "Customer already exists", id: existing.id });
      return;
    }

    [created] = await db
      .insert(customers)
      .values({
        partnerId,
        name: parsed.data.name,
        email,
        phone: parsed.data.phone || null,
        notes: parsed.data.notes || "",
      })
      .returning();
  } catch (err) {
    console.error("[customers] insert failed:", (err as Error).message);
    res.status(503).json({
      error: "Customer storage isn't ready yet. The platform admin needs to apply migration 0012 to the database. Try again in a minute — the server tries to bootstrap on each restart.",
    });
    return;
  }

  // Fire the welcome email asynchronously so the HTTP response returns fast.
  // The customerCare module handles its own gating (consent, paused, etc.).
  if (parsed.data.sendWelcome) {
    void sendWelcomeEmail(created.id).catch((e) =>
      console.warn("[customer-care] welcome kickoff failed:", e),
    );
  }

  res.status(201).json({ customer: created });
});

router.get("/:id", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, id), eq(customers.partnerId, req.partner.id)))
    .limit(1);
  if (!customer) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const thread = await db
    .select()
    .from(customerEmails)
    .where(eq(customerEmails.customerId, id))
    .orderBy(customerEmails.sentAt);
  res.json({ customer, thread });
});

router.patch("/:id", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const id = Number(req.params.id);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  await db
    .update(customers)
    .set({ ...parsed.data })
    .where(and(eq(customers.id, id), eq(customers.partnerId, req.partner.id)));
  res.json({ ok: true });
});

router.delete("/:id", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const id = Number(req.params.id);
  await db
    .delete(customers)
    .where(and(eq(customers.id, id), eq(customers.partnerId, req.partner.id)));
  res.json({ ok: true });
});

router.post("/:id/welcome", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const id = Number(req.params.id);
  const result = await sendWelcomeEmail(id);
  res.json(result);
});

router.post("/:id/drip", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const id = Number(req.params.id);
  const result = await sendMonthlyDrip(id);
  res.json(result);
});

router.post("/:id/pause", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const id = Number(req.params.id);
  await db
    .update(customers)
    .set({ aiPaused: true })
    .where(and(eq(customers.id, id), eq(customers.partnerId, req.partner.id)));
  res.json({ ok: true });
});

router.post("/:id/resume", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const id = Number(req.params.id);
  await db
    .update(customers)
    .set({ aiPaused: false })
    .where(and(eq(customers.id, id), eq(customers.partnerId, req.partner.id)));
  res.json({ ok: true });
});

const replySchema = z.object({ message: z.string().trim().min(1).max(8000) });

router.post("/:id/reply", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const id = Number(req.params.id);
  const parsed = replySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  // Make sure this is the partner's customer before triggering an AI call.
  const [customer] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.id, id), eq(customers.partnerId, req.partner.id)))
    .limit(1);
  if (!customer) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const result = await sendInboundAutoReply(id, parsed.data.message);
  res.json(result);
});

export default router;
