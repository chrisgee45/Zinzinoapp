import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db.js";
import {
  createLeadSchema,
  leadDetailsSchema,
  leads,
  partners,
} from "../../shared/schema.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.post("/", async (req, res) => {
  const parsed = createLeadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.flatten() });
    return;
  }
  const [partner] = await db
    .select({ id: partners.id })
    .from(partners)
    .where(eq(partners.id, parsed.data.partnerId))
    .limit(1);
  if (!partner) {
    res.status(404).json({ error: "Partner not found" });
    return;
  }
  const [lead] = await db
    .insert(leads)
    .values({
      partnerId: parsed.data.partnerId,
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone ?? null,
      currentWork: parsed.data.currentWork ?? null,
      futureVision: parsed.data.futureVision ?? null,
      bestTime: parsed.data.bestTime ?? null,
      status: "new",
    })
    .returning();
  res.status(201).json({ id: lead.id, lead });
});

router.patch("/:id/details", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid lead id" });
    return;
  }
  const parsed = leadDetailsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.flatten() });
    return;
  }
  const [existing] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  const [updated] = await db
    .update(leads)
    .set({
      phone: parsed.data.phone,
      currentWork: parsed.data.currentWork,
      futureVision: parsed.data.futureVision,
      bestTime: parsed.data.bestTime,
      status: existing.status === "new" ? "qualified" : existing.status,
    })
    .where(eq(leads.id, id))
    .returning();
  // Bot sequence trigger lives in M2 (server/bot/scheduler).
  res.json({ lead: updated });
});

router.get("/", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const rows = await db
    .select()
    .from(leads)
    .where(eq(leads.partnerId, req.partner.id))
    .orderBy(desc(leads.createdAt))
    .limit(500);
  res.json({ leads: rows });
});

router.get("/:id", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid lead id" });
    return;
  }
  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, id), eq(leads.partnerId, req.partner.id)))
    .limit(1);
  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  res.json({ lead });
});

export default router;
