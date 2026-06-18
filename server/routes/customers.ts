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
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../db.js";
import { customers, customerEmails, customerProducts } from "../../shared/schema.js";
import { authenticate } from "../middleware/auth.js";
import {
  sendWelcomeEmail,
  sendMonthlyDrip,
  sendInboundAutoReply,
} from "../products/customerCare.js";
import { findProduct } from "../products/catalog.js";

const router = Router();

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(60).optional().or(z.literal("")),
  notes: z.string().trim().max(5000).optional().or(z.literal("")),
  sendWelcome: z.boolean().optional().default(true),
});

// `date` fields accept "YYYY-MM-DD" or null to clear. Empty string also
// maps to null so the client doesn't have to switch between "" and
// explicit null when the user wipes the field.
const dateField = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .nullable()
  .optional()
  .or(z.literal(""));

const updateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  phone: z.string().trim().max(60).nullable().optional(),
  notes: z.string().trim().max(5000).optional(),
  billingDate: dateField,
  testDate: dateField,
  retestDate: dateField,
});

const addProductSchema = z.object({
  productName: z.string().trim().min(1).max(200),
  variant: z.string().trim().max(120).optional().or(z.literal("")),
  quantity: z.number().int().min(1).max(99).optional().default(1),
  monthlyCreditCents: z.number().int().min(0).max(1_000_000).optional().default(0),
});

const editProductSchema = z.object({
  variant: z.string().trim().max(120).nullable().optional(),
  quantity: z.number().int().min(1).max(99).optional(),
  monthlyCreditCents: z.number().int().min(0).max(1_000_000).optional(),
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
  // Active products (removedAt is null). The customer's lifetime
  // product history is preserved on the row but the UI only shows
  // what they're currently on.
  let products: typeof customerProducts.$inferSelect[] = [];
  try {
    products = await db
      .select()
      .from(customerProducts)
      .where(and(eq(customerProducts.customerId, id), isNull(customerProducts.removedAt)))
      .orderBy(customerProducts.addedAt);
  } catch (err) {
    // Pre-migration safety — if customer_products doesn't exist yet,
    // the rest of the detail page still works.
    console.warn("[customers] products load failed (likely schema-drift):", (err as Error).message);
  }
  res.json({ customer, thread, products });
});

router.patch("/:id", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const id = Number(req.params.id);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.flatten() });
    return;
  }
  // Normalise the optional date fields: "" → null so the column can be
  // cleared from the UI. Drizzle's `date` mapper takes either null or
  // a YYYY-MM-DD string; everything else gets routed to undefined so
  // the PATCH doesn't touch fields the client didn't send.
  const patch: Record<string, unknown> = {};
  for (const k of ["name", "email", "phone", "notes"] as const) {
    if (parsed.data[k] !== undefined) patch[k] = parsed.data[k];
  }
  for (const k of ["billingDate", "testDate", "retestDate"] as const) {
    const v = parsed.data[k];
    if (v === undefined) continue;
    patch[k] = v === "" || v === null ? null : v;
    // Clearing a date also resets its reminder-sent timestamp so the
    // scheduler picks the new date up cleanly on the next tick.
    if (k === "testDate") patch.testReminderSentAt = null;
    if (k === "billingDate") patch.billingReminderSentAt = null;
    if (k === "retestDate") patch.retestReminderSentAt = null;
  }
  await db
    .update(customers)
    .set(patch)
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

// ── Customer products ────────────────────────────────────────────────
//
// What the customer is currently on. Each row is one product line,
// with optional variant (size/flavor) and an optional snapshot of the
// partner's monthly credit value (placeholder field — populated when
// the user wires real commission data into the catalog).

// Verify the customer belongs to the calling partner. Returns the
// customer id on success or null when the lookup misses. Centralised
// so the three product endpoints can't accidentally diverge.
async function assertOwned(partnerId: number, id: number): Promise<boolean> {
  const [row] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.id, id), eq(customers.partnerId, partnerId)))
    .limit(1);
  return !!row;
}

router.post("/:id/products", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = addProductSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.flatten() });
    return;
  }
  if (!(await assertOwned(req.partner.id, id))) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  // Soft validation: prefer a canonical catalog name, but accept any
  // string the partner picked from the typeahead (some Bode Pro /
  // Truvy SKUs may not match perfectly + partners occasionally log a
  // mix-pack the catalog hasn't broken out). findProduct returns the
  // canonical record when there's an exact match.
  const canonical = findProduct(parsed.data.productName);
  const productName = canonical?.name ?? parsed.data.productName;

  const [created] = await db
    .insert(customerProducts)
    .values({
      customerId: id,
      partnerId: req.partner.id,
      productName,
      variant: parsed.data.variant ? parsed.data.variant : null,
      quantity: parsed.data.quantity,
      monthlyCreditCents: parsed.data.monthlyCreditCents,
    })
    .returning();
  res.status(201).json({ product: created });
});

router.patch("/:id/products/:productId", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const id = Number(req.params.id);
  const productId = Number(req.params.productId);
  if (!Number.isFinite(id) || !Number.isFinite(productId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = editProductSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.flatten() });
    return;
  }
  if (!(await assertOwned(req.partner.id, id))) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  await db
    .update(customerProducts)
    .set({
      ...(parsed.data.variant !== undefined ? { variant: parsed.data.variant || null } : {}),
      ...(parsed.data.quantity !== undefined ? { quantity: parsed.data.quantity } : {}),
      ...(parsed.data.monthlyCreditCents !== undefined ? { monthlyCreditCents: parsed.data.monthlyCreditCents } : {}),
    })
    .where(and(eq(customerProducts.id, productId), eq(customerProducts.customerId, id)));
  res.json({ ok: true });
});

router.delete("/:id/products/:productId", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const id = Number(req.params.id);
  const productId = Number(req.params.productId);
  if (!Number.isFinite(id) || !Number.isFinite(productId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  if (!(await assertOwned(req.partner.id, id))) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  // Soft-delete (mark removedAt) so the lifecycle stays on the row.
  // Daily commission sums + LTV math filter on removedAt IS NULL.
  await db
    .update(customerProducts)
    .set({ removedAt: new Date() })
    .where(and(eq(customerProducts.id, productId), eq(customerProducts.customerId, id)));
  res.json({ ok: true });
});

export default router;
