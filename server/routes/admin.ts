import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { count, desc, eq, sql } from "drizzle-orm";
import { db } from "../db.js";
import { leads, partners } from "../../shared/schema.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";

const router = Router();

router.use(authenticate, requireAdmin);

router.get("/stats", async (_req, res) => {
  const [[{ total: partnerTotal = 0 } = { total: 0 }]] = await Promise.all([
    db.select({ total: count() }).from(partners),
  ]);
  const [[{ total: leadTotal = 0 } = { total: 0 }]] = await Promise.all([
    db.select({ total: count() }).from(leads),
  ]);
  const [activeRow] = await db
    .select({ total: count() })
    .from(partners)
    .where(eq(partners.subscriptionStatus, "active"));
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [recentLeadsRow] = await db
    .select({ total: count() })
    .from(leads)
    .where(sql`${leads.createdAt} >= ${since}`);
  res.json({
    partners: partnerTotal,
    activePartners: activeRow?.total ?? 0,
    leads: leadTotal,
    leadsLast7d: recentLeadsRow?.total ?? 0,
  });
});

router.get("/partners", async (_req, res) => {
  const rows = await db
    .select({
      id: partners.id,
      email: partners.email,
      name: partners.name,
      slug: partners.slug,
      subscriptionStatus: partners.subscriptionStatus,
      isAdmin: partners.isAdmin,
      createdAt: partners.createdAt,
      stripeCustomerId: partners.stripeCustomerId,
      leadCount: sql<number>`count(${leads.id})`.as("lead_count"),
    })
    .from(partners)
    .leftJoin(leads, eq(leads.partnerId, partners.id))
    .groupBy(partners.id)
    .orderBy(desc(partners.createdAt))
    .limit(500);
  res.json({ partners: rows });
});

router.get("/leads", async (_req, res) => {
  const rows = await db
    .select({
      id: leads.id,
      partnerId: leads.partnerId,
      partnerName: partners.name,
      partnerSlug: partners.slug,
      name: leads.name,
      email: leads.email,
      phone: leads.phone,
      status: leads.status,
      interest: leads.interest,
      createdAt: leads.createdAt,
    })
    .from(leads)
    .leftJoin(partners, eq(partners.id, leads.partnerId))
    .orderBy(desc(leads.createdAt))
    .limit(500);
  res.json({ leads: rows });
});

const subStatusSchema = z.object({
  status: z.enum(["active", "inactive", "past_due", "canceled", "trialing", "unpaid", "incomplete"]),
});

router.put("/partners/:id/subscription", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = subStatusSchema.safeParse(req.body);
  if (!Number.isFinite(id) || !parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const [updated] = await db
    .update(partners)
    .set({ subscriptionStatus: parsed.data.status })
    .where(eq(partners.id, id))
    .returning({ id: partners.id, subscriptionStatus: partners.subscriptionStatus });
  if (!updated) {
    res.status(404).json({ error: "Partner not found" });
    return;
  }
  res.json(updated);
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8),
});

router.post("/partners/:id/reset-password", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!Number.isFinite(id) || !parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const hash = await bcrypt.hash(parsed.data.newPassword, 12);
  const [updated] = await db
    .update(partners)
    .set({ password: hash })
    .where(eq(partners.id, id))
    .returning({ id: partners.id });
  if (!updated) {
    res.status(404).json({ error: "Partner not found" });
    return;
  }
  res.json({ ok: true });
});

const updateEmailSchema = z.object({
  email: z.string().email().toLowerCase(),
});

router.post("/partners/:id/update-email", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = updateEmailSchema.safeParse(req.body);
  if (!Number.isFinite(id) || !parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  try {
    const [updated] = await db
      .update(partners)
      .set({ email: parsed.data.email })
      .where(eq(partners.id, id))
      .returning({ id: partners.id, email: partners.email });
    if (!updated) {
      res.status(404).json({ error: "Partner not found" });
      return;
    }
    res.json(updated);
  } catch (e) {
    res.status(409).json({ error: "That email is already in use." });
  }
});

router.delete("/partners/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  if (req.partner?.id === id) {
    res.status(400).json({ error: "Can't delete your own account from here." });
    return;
  }
  const deleted = await db.delete(partners).where(eq(partners.id, id)).returning({ id: partners.id });
  if (deleted.length === 0) {
    res.status(404).json({ error: "Partner not found" });
    return;
  }
  res.json({ ok: true });
});

export default router;
