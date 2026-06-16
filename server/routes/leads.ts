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
import { notifyNewLead, startColdSequence, startStallTrack, startWarmSequence, cancelStallTrack } from "../bot/scheduler.js";
import { PRESENTATION_VIDEO_URL } from "../bot/clients.js";
import { presentationDefault } from "../bot/prompts.js";
import { sendBotEmail } from "../bot/email.js";
import { loadLeadByIdForPartner, loadLeadsForPartner } from "../lib/loadLeads.js";

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

  // Net-new lead. Raw SQL INSERT — bypasses drizzle's schema-derived value
  // expansion so we don't take a 500 when the live DB hasn't caught up to
  // the latest column additions. Lists ONLY columns guaranteed to exist
  // before any of the recent migrations (0003 onwards). Other columns fall
  // through to DB defaults or NULL.
  const insertResult = await db.execute(sql`
    INSERT INTO leads (partner_id, name, email, phone, current_work, future_vision, best_time, status)
    VALUES (
      ${parsed.data.partnerId},
      ${parsed.data.name},
      ${normalizedEmail},
      ${parsed.data.phone ?? null},
      ${parsed.data.currentWork ?? null},
      ${parsed.data.futureVision ?? null},
      ${parsed.data.bestTime ?? null},
      ${"new"}
    )
    RETURNING id
  `);
  const insertedRows = (insertResult as unknown as { rows?: Array<{ id: number }> }).rows ?? [];
  const insertedId = insertedRows[0]?.id;
  if (!insertedId) {
    res.status(500).json({ error: "Lead creation failed" });
    return;
  }

  // Email-only leads go on the stall track (T+1h, T+48h). If they finish the
  // application form before either fires, the PATCH /details handler cancels
  // these timers and starts the warm campaign instead.
  void startStallTrack(insertedId).catch((e) => console.warn("[bot] stall track failed", e));

  res.status(201).json({ id: insertedId });
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
  const rows = await loadLeadsForPartner(req.partner.id);
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
  const lead = await loadLeadByIdForPartner(id, req.partner.id);
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
      source: "manual",
    })
    .returning();
  res.status(201).json({ lead });
});

// Bulk import for the 100-name workbook on the training page. Each row
// becomes a lead with source='hundreds_list'. Email is the natural key per
// partner so we dedupe with ON CONFLICT against the existing row (if any).
// Optional startCold:true bulk-activates the cold sequence on every newly
// imported row so the partner can fire off AI follow-up without clicking
// into each lead.
const importListSchema = z.object({
  contacts: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        email: z.string().trim().toLowerCase().email(),
        phone: z.string().trim().max(40).optional().or(z.literal("")),
        context: z.string().trim().max(500).optional().or(z.literal("")),
      }),
    )
    .min(1)
    .max(100),
  startCold: z.boolean().optional(),
});

router.post("/import-list", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const parsed = importListSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.flatten() });
    return;
  }
  const partnerId = req.partner.id;

  const inserted: number[] = [];
  const skipped: string[] = [];

  // Per-row insert with a NOT EXISTS guard. Could be done as one big
  // INSERT ... SELECT but the row-by-row form makes the response shape
  // simple to report back which were created vs deduped.
  for (const c of parsed.data.contacts) {
    const email = c.email.toLowerCase();
    const [existing] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.partnerId, partnerId), eq(leads.email, email)))
      .limit(1);
    if (existing) {
      skipped.push(email);
      continue;
    }
    const notes = c.context?.trim() ? `Where I know them: ${c.context.trim()}` : "";
    const [created] = await db
      .insert(leads)
      .values({
        partnerId,
        name: c.name,
        email,
        phone: c.phone || null,
        notes,
        status: "new",
        botPaused: true,
        source: "hundreds_list",
      })
      .returning({ id: leads.id });
    inserted.push(created.id);
  }

  // Bulk-activate the cold sequence if requested. cold_started_at gets
  // stamped on each row; scheduler picks them up immediately. Cancelable
  // per-lead via the existing pause toggle.
  if (parsed.data.startCold && inserted.length > 0) {
    for (const id of inserted) {
      await db
        .update(leads)
        .set({ coldStartedAt: new Date(), botPaused: false })
        .where(eq(leads.id, id));
      void startColdSequence(id).catch((e) => console.warn("[bot] cold kickoff failed for", id, e));
    }
  }

  res.status(201).json({
    insertedCount: inserted.length,
    skippedCount: skipped.length,
    coldStarted: parsed.data.startCold ? inserted.length : 0,
    skippedEmails: skipped,
  });
});

// General-purpose CSV import — partner uploads a contact list from another
// CRM and maps columns on the client to our lead fields. Server accepts the
// already-mapped rows and runs the same dedupe-by-email pattern as the
// 100-list importer, but supports the full lead field set (status, color,
// interest, timeline, notes, etc.). Source is forced to 'manual' so the
// dashboard source filter groups them with hand-added contacts, and bot
// stays paused — imported leads shouldn't get a surprise automated email
// the moment they hit the database.
const importCsvSchema = z.object({
  rows: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        email: z.string().trim().toLowerCase().email(),
        phone: z.string().trim().max(60).optional().or(z.literal("")),
        notes: z.string().trim().max(5000).optional().or(z.literal("")),
        currentWork: z.string().trim().max(500).optional().or(z.literal("")),
        futureVision: z.string().trim().max(1000).optional().or(z.literal("")),
        bestTime: z.string().trim().max(200).optional().or(z.literal("")),
        status: z.enum(VALID_STATUSES).optional(),
        colorCode: z.enum(["green", "red", "yellow", "blue"]).optional(),
        interest: z.enum(["products", "income"]).optional(),
        timeline: z.enum(["now", "soon", "researching"]).optional(),
      }),
    )
    .min(1)
    .max(1000),
});

router.post("/import-csv", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const parsed = importCsvSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.flatten() });
    return;
  }
  const partnerId = req.partner.id;

  // Pre-load existing emails for this partner in a single query — cheaper
  // than a per-row lookup when the partner uploads a 500-row list.
  const existingEmails = new Set(
    (
      await db
        .select({ email: leads.email })
        .from(leads)
        .where(eq(leads.partnerId, partnerId))
    ).map((r) => r.email.toLowerCase()),
  );

  // Within-CSV dedupe — if the partner's file lists the same email twice
  // we only want to insert it once. First occurrence wins.
  const seenInBatch = new Set<string>();
  const insertedIds: number[] = [];
  const skippedEmails: string[] = [];

  for (const row of parsed.data.rows) {
    const email = row.email.toLowerCase();
    if (existingEmails.has(email) || seenInBatch.has(email)) {
      skippedEmails.push(email);
      continue;
    }
    seenInBatch.add(email);
    const [created] = await db
      .insert(leads)
      .values({
        partnerId,
        name: row.name,
        email,
        phone: row.phone || null,
        notes: row.notes || "",
        currentWork: row.currentWork || null,
        futureVision: row.futureVision || null,
        bestTime: row.bestTime || null,
        status: row.status ?? "new",
        colorCode: row.colorCode ?? null,
        interest: row.interest ?? null,
        timeline: row.timeline ?? null,
        botPaused: true,
        source: "manual",
      })
      .returning({ id: leads.id });
    insertedIds.push(created.id);
  }

  res.status(201).json({
    insertedCount: insertedIds.length,
    skippedCount: skippedEmails.length,
    skippedEmails: skippedEmails.slice(0, 20),
  });
});

// Cold sequence opt-in (§ Phase G / cold track). Partner explicitly enrolls
// a manually-added contact into a 4-touch gentle drip. Only meaningful on
// leads that aren't already on the warm campaign. Sets cold_started_at,
// unpauses the bot, and kicks the cold sequence. Refuses if cold has
// already started for this lead.
router.post("/:id/start-cold", authenticate, async (req, res) => {
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
  if (lead.coldStartedAt) {
    res.status(409).json({
      error: "Cold outreach already started",
      coldStartedAt: lead.coldStartedAt,
    });
    return;
  }

  const now = new Date();
  await db
    .update(leads)
    .set({ coldStartedAt: now, botPaused: false })
    .where(eq(leads.id, lead.id));

  void startColdSequence(lead.id).catch((e) => console.warn("[bot] cold sequence kickoff failed", e));

  res.json({ ok: true, coldStartedAt: now.toISOString() });
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
