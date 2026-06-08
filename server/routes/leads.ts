import { Router } from "express";
import { z } from "zod";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db.js";
import {
  botEmails,
  colorCodeSchema,
  createLeadSchema,
  leadDetailsSchema,
  leadReplies,
  leads,
  partners,
} from "../../shared/schema.js";
import { authenticate } from "../middleware/auth.js";
import { notifyNewLead, startStallTrack, startWarmSequence, cancelStallTrack } from "../bot/scheduler.js";
import { PRESENTATION_VIDEO_URL } from "../bot/clients.js";
import { presentationDefault } from "../bot/prompts.js";
import { sendBotEmail } from "../bot/email.js";

const router = Router();

const VALID_STATUSES = ["new", "qualified", "engaged", "handoff", "customer", "lost"] as const;
const statusSchema = z.object({ status: z.enum(VALID_STATUSES) });
const interestSchema = z.object({ interest: z.enum(["products", "income"]).nullable() });
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
  // Look up an existing lead for this (partner, email). If it exists, this is
  // a return visit: bump submission_count, refresh last_submission_at, return
  // the EXISTING lead.id. No new stall track is scheduled. The pending stall
  // touch (if not yet fired) is aware of submission_count and adapts its copy.
  // This is the de-duplication that prevents 'they re-entered their email
  // three times and got three initial bot emails'.
  //
  // We only SELECT { id } here, never the new submission_count column,
  // because the dedupe must keep working even if migration 0005 hasn't been
  // applied in this environment. The count bump below is wrapped in a
  // try/catch for the same reason — if the columns don't exist yet, we still
  // return the existing id, we just can't track the return until the SQL is
  // run.
  const normalizedEmail = parsed.data.email.toLowerCase();
  const [existing] = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.partnerId, parsed.data.partnerId), eq(leads.email, normalizedEmail)))
    .limit(1);

  if (existing) {
    try {
      await db
        .update(leads)
        .set({
          submissionCount: sql`COALESCE(${leads.submissionCount}, 1) + 1`,
          lastSubmissionAt: new Date(),
        })
        .where(eq(leads.id, existing.id));
    } catch (e) {
      console.warn("[leads] couldn't bump submission_count (schema drift?)", e);
    }
    res.status(200).json({ id: existing.id, returning: true });
    return;
  }

  // Net-new lead. Same pinning to .returning({ id }) as before — the explicit
  // column list from drizzle's bare .returning() would break the squeeze
  // submit on schema drift.
  const [inserted] = await db
    .insert(leads)
    .values({
      partnerId: parsed.data.partnerId,
      name: parsed.data.name,
      email: normalizedEmail,
      phone: parsed.data.phone ?? null,
      currentWork: parsed.data.currentWork ?? null,
      futureVision: parsed.data.futureVision ?? null,
      bestTime: parsed.data.bestTime ?? null,
      status: "new",
    })
    .returning({ id: leads.id });

  // Email-only leads go on the stall track (T+1h, T+48h). If they finish the
  // application form before either fires, the PATCH /details handler cancels
  // these timers and starts the warm campaign instead.
  void startStallTrack(inserted.id).catch((e) => console.warn("[bot] stall track failed", e));

  res.status(201).json({ id: inserted.id });
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
      timeline: parsed.data.timeline ?? null,
      whatPulledIn: parsed.data.whatPulledIn?.trim() || null,
      // Only stamp the booking time on the FIRST submit. Re-submits never
      // shift the warm campaign timeline.
      detailsSubmittedAt: existing.detailsSubmittedAt ?? new Date(),
      status: existing.status === "new" ? "qualified" : existing.status,
    })
    .where(eq(leads.id, id))
    .returning();

  // First-submit only: notify partner + cancel any pending stall touches +
  // kick off the warm sequence from detailsSubmittedAt. Re-submits are a
  // no-op for the bot (idempotency lives inside startWarmSequence too).
  if (!existing.detailsSubmittedAt) {
    void notifyNewLead(updated.id).catch((e) => console.warn("[bot] notify failed", e));
    void startWarmSequence(updated.id).catch((e) => console.warn("[bot] warm sequence failed", e));
  }

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

// Public endpoint — fired by the four color buttons on partner-presentation.tsx.
// Only writes colorCode. Last choice wins (overwrite, no audit trail) so a
// prospect who reconsiders after re-watching just gets re-routed.
router.patch("/:id/color", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid lead id" });
    return;
  }
  const parsed = colorCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid color" });
    return;
  }
  const [updated] = await db
    .update(leads)
    .set({ colorCode: parsed.data.colorCode })
    .where(eq(leads.id, id))
    .returning({ id: leads.id });
  if (!updated) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  res.json({ ok: true });
});

// Public endpoint — the post-submit funnel page can tag the lead with which
// path resonated. Only writes the interest field; no other state can be moved.
router.patch("/:id/interest", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid lead id" });
    return;
  }
  const parsed = interestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const [updated] = await db
    .update(leads)
    .set({ interest: parsed.data.interest })
    .where(eq(leads.id, id))
    .returning({ id: leads.id });
  if (!updated) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  res.json({ ok: true });
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

// Send-presentation closing tool (§9B / Phase F). Gated on the lead being
// partner-owned and having completed the booking form. The send is a one-shot
// — once presentation_sent_at is stamped, this endpoint refuses to fire again
// to prevent accidental double-sends from the CRM UI.

const presentationSchema = z.object({
  subject: z.string().trim().min(1).max(200).optional(),
  body: z.string().trim().min(1).max(5000).optional(),
});

router.get("/:id/send-presentation/preview", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
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
  const draft = presentationDefault(
    { name: lead.name, colorCode: lead.colorCode },
    { name: req.partner.name, enrollmentLink: req.partner.enrollmentLink },
    PRESENTATION_VIDEO_URL,
  );
  res.json({
    subject: draft.subject,
    body: draft.body,
    alreadySentAt: lead.presentationSentAt ?? null,
    bookingComplete: Boolean(lead.detailsSubmittedAt),
  });
});

router.post("/:id/send-presentation", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid lead id" });
    return;
  }
  const parsed = presentationSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.flatten() });
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
  if (!lead.detailsSubmittedAt) {
    res.status(400).json({ error: "Lead hasn't completed the booking form yet" });
    return;
  }
  if (lead.presentationSentAt) {
    res.status(409).json({
      error: "Presentation already sent",
      alreadySentAt: lead.presentationSentAt,
    });
    return;
  }

  // Fall back to the color-aware default if the caller didn't supply edits.
  const defaults = presentationDefault(
    { name: lead.name, colorCode: lead.colorCode },
    { name: req.partner.name, enrollmentLink: req.partner.enrollmentLink },
    PRESENTATION_VIDEO_URL,
  );
  const subject = parsed.data.subject ?? defaults.subject;
  const body = parsed.data.body ?? defaults.body;

  const send = await sendBotEmail({
    partner: { name: req.partner.name, slug: req.partner.slug },
    to: lead.email,
    subject,
    body,
  });
  if (!send.ok) {
    res.status(502).json({ error: send.error ?? "Send failed" });
    return;
  }

  // Per §12.8 default: a partner-initiated send pauses the automated warm
  // bot for this lead so the bot and the partner don't talk over each other.
  // Partner can resume via the existing /bot-resume control. Also cancels
  // any pending stall touches just in case (defensive — booked leads
  // shouldn't have stall timers pending).
  cancelStallTrack(lead.id);

  await db.insert(botEmails).values({
    leadId: lead.id,
    partnerId: req.partner.id,
    touchNumber: 50,
    leadType: "presentation",
    subject,
    body,
    status: "sent",
  });

  const now = new Date();
  await db
    .update(leads)
    .set({ presentationSentAt: now, botPaused: true })
    .where(eq(leads.id, lead.id));

  res.json({
    subject,
    body,
    sentAt: now.toISOString(),
    botPaused: true,
  });
});

export default router;
