import { Router } from "express";
import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db.js";
import {
  botEmails,
  createLeadSchema,
  leadDetailsSchema,
  leadReplies,
  leads,
  partners,
} from "../../shared/schema.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

const VALID_STATUSES = ["new", "qualified", "engaged", "handoff", "customer", "lost"] as const;
const statusSchema = z.object({ status: z.enum(VALID_STATUSES) });
const notesSchema = z.object({ notes: z.string().max(5000) });
const bulkDeleteSchema = z.object({ ids: z.array(z.number().int().positive()).min(1).max(100) });
const manualContactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  currentWork: z.string().trim().max(500).optional().or(z.literal("")),
  futureVision: z.string().trim().max(1000).optional().or(z.literal("")),
  bestTime: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(5000).optional().or(z.literal("")),
});

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

router.patch("/:id/status", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const id = Number(req.params.id);
  const parsed = statusSchema.safeParse(req.body);
  if (!Number.isFinite(id) || !parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const [updated] = await db
    .update(leads)
    .set({ status: parsed.data.status })
    .where(and(eq(leads.id, id), eq(leads.partnerId, req.partner.id)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  res.json({ lead: updated });
});

router.patch("/:id/notes", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const id = Number(req.params.id);
  const parsed = notesSchema.safeParse(req.body);
  if (!Number.isFinite(id) || !parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const [updated] = await db
    .update(leads)
    .set({ notes: parsed.data.notes })
    .where(and(eq(leads.id, id), eq(leads.partnerId, req.partner.id)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  res.json({ lead: updated });
});

router.post("/:id/bot-pause", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid lead id" });
    return;
  }
  const [updated] = await db
    .update(leads)
    .set({ botPaused: true })
    .where(and(eq(leads.id, id), eq(leads.partnerId, req.partner.id)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  res.json({ lead: updated });
});

router.post("/:id/bot-resume", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid lead id" });
    return;
  }
  const [updated] = await db
    .update(leads)
    .set({ botPaused: false })
    .where(and(eq(leads.id, id), eq(leads.partnerId, req.partner.id)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  res.json({ lead: updated });
});

router.get("/:id/bot-emails", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid lead id" });
    return;
  }
  const rows = await db
    .select()
    .from(botEmails)
    .where(and(eq(botEmails.leadId, id), eq(botEmails.partnerId, req.partner.id)))
    .orderBy(desc(botEmails.sentAt));
  res.json({ emails: rows });
});

router.get("/:id/replies", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid lead id" });
    return;
  }
  const rows = await db
    .select()
    .from(leadReplies)
    .where(and(eq(leadReplies.leadId, id), eq(leadReplies.partnerId, req.partner.id)))
    .orderBy(desc(leadReplies.receivedAt));
  res.json({ replies: rows });
});

router.delete("/:id", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid lead id" });
    return;
  }
  const deleted = await db
    .delete(leads)
    .where(and(eq(leads.id, id), eq(leads.partnerId, req.partner.id)))
    .returning({ id: leads.id });
  if (deleted.length === 0) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  res.json({ ok: true });
});

router.post("/bulk-delete", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const parsed = bulkDeleteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const deleted = await db
    .delete(leads)
    .where(and(inArray(leads.id, parsed.data.ids), eq(leads.partnerId, req.partner.id)))
    .returning({ id: leads.id });
  res.json({ ok: true, deleted: deleted.length });
});

router.post("/contacts", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const parsed = manualContactSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.flatten() });
    return;
  }
  const [lead] = await db
    .insert(leads)
    .values({
      partnerId: req.partner.id,
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      currentWork: parsed.data.currentWork || null,
      futureVision: parsed.data.futureVision || null,
      bestTime: parsed.data.bestTime || null,
      notes: parsed.data.notes || "",
      status: "new",
      botPaused: true, // manual contacts don't auto-trigger the bot
    })
    .returning();
  res.status(201).json({ lead });
});

export default router;
