import type Anthropic from "@anthropic-ai/sdk";
import { and, asc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "../db.js";
import { botEmails, leadReplies, leads, partners, type Lead, type Partner } from "../../shared/schema.js";
import type { ColorCode } from "../../shared/colorCode.js";
import { anthropic, botCanSend, BOT_MODEL, PUBLIC_BASE_URL } from "./clients.js";
import {
  coldSubjectFor,
  coldTouchUserPrompt,
  firstName,
  personaSystemPrompt,
  replySystemPrompt,
  replyUserPrompt,
  stallSubjectFor,
  stallTouchUserPrompt,
  stripHandoffToken,
  subjectFor,
  warmTouchUserPrompt,
  type ConversationTurn,
} from "./prompts.js";
import { sendBotEmail, sendPartnerNotification } from "./email.js";

// Warm sequence cadence, minutes from when the details form was submitted
// (NOT from lead creation — see §9A of COLOR-CODE-PLAN.md for the rationale).
export const WARM_SEQUENCE_MINUTES = [15, 1710, 4440, 10200, 20280] as const;
export const WARM_TOUCH_COUNT = WARM_SEQUENCE_MINUTES.length;

// Stall track: fires only if the prospect entered email but never submitted
// the details form. Two soft nudges to avoid flooding.
export const STALL_TOUCH_MINUTES = [60, 60 * 48] as const;
export const STALL_TOUCH_COUNT = STALL_TOUCH_MINUTES.length;

// Cold sequence: 4 touches for manually-added contacts (the partner's phone
// book imports). Slower and gentler than warm because these people never
// went through the funnel and haven't opted in. Partner explicitly starts
// this from the CRM ('Start cold outreach' button on lead detail). Base
// time is lead.coldStartedAt.
//   Touch 1: ~15 min after start (lets the partner cancel if they misclicked)
//   Touch 2: day 4
//   Touch 3: day 10
//   Touch 4: day 21 (still under the setTimeout 24-day cap)
export const COLD_TOUCH_MINUTES = [15, 60 * 24 * 4, 60 * 24 * 10, 60 * 24 * 21] as const;
export const COLD_TOUCH_COUNT = COLD_TOUCH_MINUTES.length;

const timers = new Map<string, NodeJS.Timeout>();

function warmKey(leadId: number, touch: number): string {
  return `${leadId}:warm:${touch}`;
}
function coldKey(leadId: number, touch: number): string {
  return `${leadId}:cold:${touch}`;
}
function stallKey(leadId: number, touch: number): string {
  return `${leadId}:stall:${touch}`;
}

/**
 * Schema-drift-resistant lead loader. The default drizzle `.select().from(leads)`
 * generates an explicit column list from the in-code schema; if a column from a
 * recent migration is missing in the live DB, every send path silently 500s
 * inside a fire-and-forget timer and the partner sees 'no emails being sent'.
 *
 * Strategy: optimistic full select first, then on failure, fall back to a raw
 * SELECT of only the columns we know existed before migration 0005. Newer
 * fields fall back to safe defaults so the bot keeps sending while the
 * partner runs the pending SQL.
 */
async function loadLead(leadId: number): Promise<Lead | null> {
  try {
    const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    return lead ?? null;
  } catch (e) {
    console.warn(`[bot] loadLead(${leadId}): full select failed, falling back to raw. Run pending migrations.`, e);
    try {
      const result = await db.execute(sql`
        SELECT id, partner_id, name, email, phone, current_work, future_vision,
               best_time, status, notes, bot_paused, interest, timeline,
               color_code, what_pulled_in, details_submitted_at, created_at
        FROM leads
        WHERE id = ${leadId}
        LIMIT 1
      `);
      const rows = (result as { rows?: Record<string, unknown>[] }).rows ?? [];
      const row = rows[0];
      if (!row) return null;
      const createdAt = row.created_at as Date;
      return {
        id: row.id as number,
        partnerId: row.partner_id as number,
        name: row.name as string,
        email: row.email as string,
        phone: (row.phone as string | null) ?? null,
        currentWork: (row.current_work as string | null) ?? null,
        futureVision: (row.future_vision as string | null) ?? null,
        bestTime: (row.best_time as string | null) ?? null,
        status: row.status as string,
        notes: (row.notes as string) ?? "",
        botPaused: (row.bot_paused as boolean) ?? false,
        interest: (row.interest as string | null) ?? null,
        timeline: (row.timeline as string | null) ?? null,
        colorCode: (row.color_code as string | null) ?? null,
        whatPulledIn: (row.what_pulled_in as string | null) ?? null,
        submissionCount: 1,
        lastSubmissionAt: createdAt,
        detailsSubmittedAt: (row.details_submitted_at as Date | null) ?? null,
        createdAt,
      } as Lead;
    } catch (e2) {
      console.error(`[bot] loadLead(${leadId}): raw fallback also failed`, e2);
      return null;
    }
  }
}

function clearKey(key: string): void {
  const existing = timers.get(key);
  if (existing) {
    clearTimeout(existing);
    timers.delete(key);
  }
}

function scheduleAtKey(key: string, fireAt: Date, run: () => Promise<void>): void {
  clearKey(key);
  const delay = Math.max(0, fireAt.getTime() - Date.now());
  // Cap setTimeout delay; longer than ~24 days defers to next catchup pass.
  const MAX = 2_147_000_000;
  if (delay > MAX) return;
  const handle = setTimeout(() => {
    timers.delete(key);
    void run().catch((err) => console.error(`[bot] ${key} failed:`, err));
  }, delay);
  timers.set(key, handle);
}

export function scheduleAt(leadId: number, touch: number, fireAt: Date, run: () => Promise<void>): void {
  scheduleAtKey(warmKey(leadId, touch), fireAt, run);
}

/** Cancel every pending stall touch for a lead (called when they book). */
export function cancelStallTrack(leadId: number): void {
  for (let touch = 1; touch <= STALL_TOUCH_COUNT; touch++) {
    clearKey(stallKey(leadId, touch));
  }
}

/** Cancel every pending cold touch for a lead (used on bot pause or status change). */
export function cancelColdTrack(leadId: number): void {
  for (let touch = 1; touch <= COLD_TOUCH_COUNT; touch++) {
    clearKey(coldKey(leadId, touch));
  }
}

function warmBaseTime(lead: Lead): Date {
  // The warm campaign starts from when the prospect actually booked
  // (PATCH /api/leads/:id/details set this), NOT from when they entered
  // their email on the squeeze page. Defensive fallback to now() in case
  // a caller invokes startWarmSequence before details are set — should
  // never happen via the normal route flow.
  return lead.detailsSubmittedAt ?? new Date();
}

export async function startWarmSequence(leadId: number): Promise<void> {
  if (!botCanSend()) {
    console.log(`[bot] startWarmSequence(${leadId}) skipped — bot keys missing`);
    return;
  }
  const lead = await loadLead(leadId);
  if (!lead) return;
  if (lead.botPaused) return;
  if (!lead.detailsSubmittedAt) {
    // Only booked leads (details submitted) get the warm campaign. Email-only
    // leads stay on the stall track.
    console.log(`[bot] startWarmSequence(${leadId}) skipped — details not submitted yet`);
    return;
  }

  // Cancel any pending stall touches the moment they book.
  cancelStallTrack(leadId);

  const sent = await db
    .select({
      touchNumber: botEmails.touchNumber,
      leadType: botEmails.leadType,
      status: botEmails.status,
    })
    .from(botEmails)
    .where(eq(botEmails.leadId, leadId));
  const sentWarmTouches = new Set(
    sent
      .filter((r) => r.leadType === "warm" && r.status === "sent")
      .map((r) => r.touchNumber),
  );

  const base = warmBaseTime(lead).getTime();
  for (let touch = 1; touch <= WARM_TOUCH_COUNT; touch++) {
    if (sentWarmTouches.has(touch)) continue;
    const fireAt = new Date(base + WARM_SEQUENCE_MINUTES[touch - 1] * 60_000);
    scheduleAt(leadId, touch, fireAt, () => sendWarmTouch(leadId, touch));
  }
}

/**
 * Stall track — fires only if the prospect entered email but never booked.
 * Two soft nudges (T+1h, T+48h). Each touch no-ops at fire time if the lead
 * has since submitted details.
 */
export async function startStallTrack(leadId: number): Promise<void> {
  if (!botCanSend()) {
    console.log(`[bot] startStallTrack(${leadId}) skipped — bot keys missing`);
    return;
  }
  const lead = await loadLead(leadId);
  if (!lead) return;
  if (lead.botPaused) return;
  if (lead.detailsSubmittedAt) return; // Already booked, no stall track needed

  const sent = await db
    .select({
      touchNumber: botEmails.touchNumber,
      leadType: botEmails.leadType,
      status: botEmails.status,
    })
    .from(botEmails)
    .where(eq(botEmails.leadId, leadId));
  const sentStallTouches = new Set(
    sent
      .filter((r) => r.leadType === "stall" && r.status === "sent")
      .map((r) => r.touchNumber),
  );

  const base = lead.createdAt.getTime();
  for (let touch = 1; touch <= STALL_TOUCH_COUNT; touch++) {
    if (sentStallTouches.has(touch)) continue;
    const fireAt = new Date(base + STALL_TOUCH_MINUTES[touch - 1] * 60_000);
    scheduleAtKey(stallKey(leadId, touch), fireAt, () => sendStallTouch(leadId, touch));
  }
}

/**
 * Cold sequence — for manually-added contacts the partner explicitly opts in
 * to outreach for. Slower cadence than warm (4 touches over 21 days). Base
 * time is lead.coldStartedAt, which is stamped by the start-cold endpoint
 * when the partner clicks the CRM button.
 */
export async function startColdSequence(leadId: number): Promise<void> {
  if (!botCanSend()) {
    console.log(`[bot] startColdSequence(${leadId}) skipped — bot keys missing`);
    return;
  }
  const lead = await loadLead(leadId);
  if (!lead) return;
  if (lead.botPaused) return;
  if (!lead.coldStartedAt) {
    console.log(`[bot] startColdSequence(${leadId}) skipped — coldStartedAt not stamped`);
    return;
  }

  const sent = await db
    .select({
      touchNumber: botEmails.touchNumber,
      leadType: botEmails.leadType,
      status: botEmails.status,
    })
    .from(botEmails)
    .where(eq(botEmails.leadId, leadId));
  const sentColdTouches = new Set(
    sent
      .filter((r) => r.leadType === "cold" && r.status === "sent")
      .map((r) => r.touchNumber),
  );

  const base = lead.coldStartedAt.getTime();
  for (let touch = 1; touch <= COLD_TOUCH_COUNT; touch++) {
    if (sentColdTouches.has(touch)) continue;
    const fireAt = new Date(base + COLD_TOUCH_MINUTES[touch - 1] * 60_000);
    scheduleAtKey(coldKey(leadId, touch), fireAt, () => sendColdTouch(leadId, touch));
  }
}

export async function sendWarmTouch(leadId: number, touch: number): Promise<void> {
  if (!botCanSend() || !anthropic) return;
  const lead = await loadLead(leadId);
  if (!lead || lead.botPaused) return;
  const [partner] = await db.select().from(partners).where(eq(partners.id, lead.partnerId)).limit(1);
  if (!partner) return;

  // Idempotency guard scoped to warm — stall touches share touch numbers
  // but live under their own leadType so this filter must be specific.
  // Error rows get cleared so a retry can replace them.
  const [existing] = await db
    .select({ id: botEmails.id, status: botEmails.status })
    .from(botEmails)
    .where(
      and(
        eq(botEmails.leadId, leadId),
        eq(botEmails.touchNumber, touch),
        eq(botEmails.leadType, "warm"),
      ),
    )
    .limit(1);
  if (existing && existing.status === "sent") return;
  if (existing) {
    await db.delete(botEmails).where(eq(botEmails.id, existing.id));
  }

  // If a stall email already fired for this lead, touch 1 acknowledges the
  // booking instead of reintroducing.
  const [stallSent] = await db
    .select({ id: botEmails.id })
    .from(botEmails)
    .where(and(eq(botEmails.leadId, leadId), eq(botEmails.leadType, "stall")))
    .limit(1);
  const stalledFirst = touch === 1 && Boolean(stallSent);

  const body = await generateWarmTouchBody(partner, lead, touch, stalledFirst);
  if (!body) return;
  const subject = subjectFor(touch, lead);

  const send = await sendBotEmail({
    partner: { name: partner.name, slug: partner.slug },
    to: lead.email,
    subject,
    body,
  });

  await db.insert(botEmails).values({
    leadId,
    partnerId: partner.id,
    touchNumber: touch,
    leadType: "warm",
    subject,
    body,
    status: send.ok ? "sent" : `error:${send.error?.slice(0, 200) ?? "unknown"}`,
  });

  if (!send.ok) {
    console.warn(`[bot] failed warm touch ${touch} for lead ${leadId}: ${send.error}`);
  }
}

export async function sendStallTouch(leadId: number, touch: number): Promise<void> {
  if (!botCanSend() || !anthropic) return;
  const lead = await loadLead(leadId);
  if (!lead || lead.botPaused) return;
  // The whole point of the stall track: if they've booked, do nothing.
  if (lead.detailsSubmittedAt) return;
  const [partner] = await db.select().from(partners).where(eq(partners.id, lead.partnerId)).limit(1);
  if (!partner) return;

  // Idempotency: don't re-send a stall touch we already sent.
  const [existing] = await db
    .select({ id: botEmails.id, status: botEmails.status })
    .from(botEmails)
    .where(
      and(
        eq(botEmails.leadId, leadId),
        eq(botEmails.touchNumber, touch),
        eq(botEmails.leadType, "stall"),
      ),
    )
    .limit(1);
  if (existing && existing.status === "sent") return;
  if (existing) {
    await db.delete(botEmails).where(eq(botEmails.id, existing.id));
  }

  const body = await generateStallTouchBody(partner, lead, touch);
  if (!body) return;
  const subject = stallSubjectFor(touch, lead);

  const send = await sendBotEmail({
    partner: { name: partner.name, slug: partner.slug },
    to: lead.email,
    subject,
    body,
  });

  await db.insert(botEmails).values({
    leadId,
    partnerId: partner.id,
    touchNumber: touch,
    leadType: "stall",
    subject,
    body,
    status: send.ok ? "sent" : `error:${send.error?.slice(0, 200) ?? "unknown"}`,
  });

  if (!send.ok) {
    console.warn(`[bot] failed stall touch ${touch} for lead ${leadId}: ${send.error}`);
  }
}

export async function sendColdTouch(leadId: number, touch: number): Promise<void> {
  if (!botCanSend() || !anthropic) return;
  const lead = await loadLead(leadId);
  if (!lead || lead.botPaused) return;
  // Defensive: cold is for manually-added contacts, but a partner could
  // theoretically kick it off on a funnel lead. Allow it — partner's call.
  // What we DON'T want: sending if they've since become a customer or lost.
  if (lead.status === "customer" || lead.status === "lost") return;

  const [partner] = await db.select().from(partners).where(eq(partners.id, lead.partnerId)).limit(1);
  if (!partner) return;

  // Only block on rows that genuinely landed. A prior 'error:...' row
  // (e.g. a Resend rate-limit casualty from an import burst) should
  // not stop a retry — we delete it first so the new attempt can
  // insert cleanly without violating any future uniqueness constraint
  // and so the lead detail thread only shows the final outcome.
  const [existing] = await db
    .select({ id: botEmails.id, status: botEmails.status })
    .from(botEmails)
    .where(
      and(
        eq(botEmails.leadId, leadId),
        eq(botEmails.touchNumber, touch),
        eq(botEmails.leadType, "cold"),
      ),
    )
    .limit(1);
  if (existing && existing.status === "sent") return;
  if (existing) {
    await db.delete(botEmails).where(eq(botEmails.id, existing.id));
  }

  const body = await generateColdTouchBody(partner, lead, touch);
  if (!body) return;
  const subject = coldSubjectFor(touch, lead);

  const send = await sendBotEmail({
    partner: { name: partner.name, slug: partner.slug },
    to: lead.email,
    subject,
    body,
  });

  await db.insert(botEmails).values({
    leadId,
    partnerId: partner.id,
    touchNumber: touch,
    leadType: "cold",
    subject,
    body,
    status: send.ok ? "sent" : `error:${send.error?.slice(0, 200) ?? "unknown"}`,
  });

  if (!send.ok) {
    console.warn(`[bot] failed cold touch ${touch} for lead ${leadId}: ${send.error}`);
  }
}

async function generateColdTouchBody(
  partner: Partner,
  lead: Lead,
  touch: number,
): Promise<string | null> {
  if (!anthropic) return null;
  try {
    const res = await anthropic.messages.create({
      model: BOT_MODEL,
      max_tokens: 500,
      system: personaSystemPrompt(partner, lead.colorCode as ColorCode | null),
      messages: [{ role: "user", content: coldTouchUserPrompt(touch, lead, `${PUBLIC_BASE_URL}/${partner.slug}`) }],
    });
    const text = res.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text)
      .join("\n")
      .trim();
    return text;
  } catch (err) {
    console.error(`[bot] anthropic error for cold touch ${touch} lead ${lead.id}:`, err);
    return null;
  }
}

async function generateWarmTouchBody(
  partner: Partner,
  lead: Lead,
  touch: number,
  stalledFirst: boolean,
): Promise<string | null> {
  if (!anthropic) return null;
  try {
    const res = await anthropic.messages.create({
      model: BOT_MODEL,
      max_tokens: 600,
      system: personaSystemPrompt(partner, lead.colorCode as ColorCode | null),
      messages: [{ role: "user", content: warmTouchUserPrompt(touch, lead, stalledFirst) }],
    });
    const text = res.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text)
      .join("\n")
      .trim();
    return text;
  } catch (err) {
    console.error(`[bot] anthropic error for warm touch ${touch} lead ${lead.id}:`, err);
    return null;
  }
}

async function generateStallTouchBody(
  partner: Partner,
  lead: Lead,
  touch: number,
): Promise<string | null> {
  if (!anthropic) return null;
  try {
    const res = await anthropic.messages.create({
      model: BOT_MODEL,
      max_tokens: 400,
      system: personaSystemPrompt(partner, lead.colorCode as ColorCode | null),
      messages: [{ role: "user", content: stallTouchUserPrompt(touch, lead, lead.submissionCount ?? 1, `${PUBLIC_BASE_URL}/${partner.slug}`) }],
    });
    const text = res.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text)
      .join("\n")
      .trim();
    return text;
  } catch (err) {
    console.error(`[bot] anthropic error for stall touch ${touch} lead ${lead.id}:`, err);
    return null;
  }
}

/**
 * Boot-time catchup. Loads every warm-eligible lead whose sequence is
 * incomplete and re-schedules the remaining touches with a small stagger
 * so we don't fan out a thundering herd of API calls after a redeploy.
 */
export async function runCatchup(): Promise<void> {
  if (!botCanSend()) {
    console.log("[bot] catchup skipped — bot keys missing");
    return;
  }
  console.log("[bot] catchup: scanning incomplete sequences…");
  let rows: Lead[] = [];
  try {
    rows = await db.select().from(leads).where(eq(leads.botPaused, false));
  } catch (e) {
    console.error(
      "[bot] catchup: full lead select failed (likely schema drift, run pending migrations). Falling back to per-id loads via loadLead.",
      e,
    );
    // Fallback: pull only the ids we care about via raw SQL, then loadLead
    // each one individually so it picks up the same defensive defaults.
    try {
      const result = await db.execute(sql`SELECT id FROM leads WHERE bot_paused = false`);
      const idRows = (result as { rows?: Record<string, unknown>[] }).rows ?? [];
      for (const r of idRows) {
        const loaded = await loadLead(r.id as number);
        if (loaded) rows.push(loaded);
      }
    } catch (e2) {
      console.error("[bot] catchup: id-only fallback also failed. Aborting catchup.", e2);
      return;
    }
  }

  let staggerSec = 5;
  for (const lead of rows) {
    const sent = await db
      .select({
        touchNumber: botEmails.touchNumber,
        leadType: botEmails.leadType,
        status: botEmails.status,
      })
      .from(botEmails)
      .where(eq(botEmails.leadId, lead.id));

    if (lead.detailsSubmittedAt) {
      // Booked lead → warm track. Schedule from detailsSubmittedAt.
      const sentWarm = new Set(
        sent
          .filter((r) => r.leadType === "warm" && r.status === "sent")
          .map((r) => r.touchNumber),
      );
      if (sentWarm.size >= WARM_TOUCH_COUNT) continue;
      const base = lead.detailsSubmittedAt.getTime();
      for (let touch = 1; touch <= WARM_TOUCH_COUNT; touch++) {
        if (sentWarm.has(touch)) continue;
        const scheduledFor = new Date(base + WARM_SEQUENCE_MINUTES[touch - 1] * 60_000);
        const fireAt = scheduledFor.getTime() < Date.now() + 5_000
          ? new Date(Date.now() + staggerSec * 1000)
          : scheduledFor;
        if (scheduledFor.getTime() < Date.now() + 5_000) staggerSec += 45;
        scheduleAt(lead.id, touch, fireAt, () => sendWarmTouch(lead.id, touch));
      }
    } else if (lead.coldStartedAt) {
      // Partner-initiated cold track. Schedule from coldStartedAt.
      const sentCold = new Set(
        sent
          .filter((r) => r.leadType === "cold" && r.status === "sent")
          .map((r) => r.touchNumber),
      );
      if (sentCold.size >= COLD_TOUCH_COUNT) continue;
      const base = lead.coldStartedAt.getTime();
      for (let touch = 1; touch <= COLD_TOUCH_COUNT; touch++) {
        if (sentCold.has(touch)) continue;
        const scheduledFor = new Date(base + COLD_TOUCH_MINUTES[touch - 1] * 60_000);
        const fireAt = scheduledFor.getTime() < Date.now() + 5_000
          ? new Date(Date.now() + staggerSec * 1000)
          : scheduledFor;
        if (scheduledFor.getTime() < Date.now() + 5_000) staggerSec += 45;
        scheduleAtKey(coldKey(lead.id, touch), fireAt, () => sendColdTouch(lead.id, touch));
      }
    } else {
      // Email-only funnel lead → stall track. Schedule from createdAt.
      // Guard: only schedule stall for leads created within the last 7 days
      // so a partner who unpauses an old manual contact (without starting
      // cold outreach) doesn't accidentally get hit with an immediate stall
      // email. Stall is a 'they just landed and didn't book' signal, not a
      // 'reach out to anyone we haven't talked to in a year' signal.
      const ageMs = Date.now() - lead.createdAt.getTime();
      const STALL_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
      if (ageMs > STALL_MAX_AGE_MS) continue;

      const sentStall = new Set(
        sent
          .filter((r) => r.leadType === "stall" && r.status === "sent")
          .map((r) => r.touchNumber),
      );
      if (sentStall.size >= STALL_TOUCH_COUNT) continue;
      const base = lead.createdAt.getTime();
      for (let touch = 1; touch <= STALL_TOUCH_COUNT; touch++) {
        if (sentStall.has(touch)) continue;
        const scheduledFor = new Date(base + STALL_TOUCH_MINUTES[touch - 1] * 60_000);
        const fireAt = scheduledFor.getTime() < Date.now() + 5_000
          ? new Date(Date.now() + staggerSec * 1000)
          : scheduledFor;
        if (scheduledFor.getTime() < Date.now() + 5_000) staggerSec += 45;
        scheduleAtKey(stallKey(lead.id, touch), fireAt, () => sendStallTouch(lead.id, touch));
      }
    }
  }
  console.log("[bot] catchup: done");
}

/**
 * Inbound reply handler — called by the Resend webhook when a lead replies
 * to a bot-sent email. Persists the reply, schedules a delayed bot response
 * via Claude (or hands off if the prospect asked for a call).
 */
export async function handleInboundReply({
  leadId,
  fromEmail,
  subject,
  body,
}: {
  leadId: number;
  fromEmail: string;
  subject: string | null;
  body: string;
}): Promise<void> {
  const lead = await loadLead(leadId);
  if (!lead) return;
  const [partner] = await db.select().from(partners).where(eq(partners.id, lead.partnerId)).limit(1);
  if (!partner) return;

  await db.insert(leadReplies).values({
    leadId,
    partnerId: partner.id,
    fromEmail,
    subject,
    body,
  });

  // Notify partner immediately
  if (partner.emailNotifications) {
    await sendPartnerNotification({
      to: partner.email,
      subject: `${firstName(lead.name)} just replied`,
      body: `${firstName(lead.name)} (${lead.email}) replied:\n\n${body.slice(0, 800)}${body.length > 800 ? "…" : ""}\n\nView the conversation: see your dashboard.`,
    }).catch(() => undefined);
  }

  if (lead.botPaused) return;
  if (!botCanSend()) return;

  // Delay 2-8 minutes so it feels human.
  const delayMs = (2 + Math.random() * 6) * 60_000;
  scheduleAt(leadId, 99, new Date(Date.now() + delayMs), () => sendBotReply(leadId));
}

async function sendBotReply(leadId: number): Promise<void> {
  if (!anthropic) return;
  const lead = await loadLead(leadId);
  if (!lead || lead.botPaused) return;
  const [partner] = await db.select().from(partners).where(eq(partners.id, lead.partnerId)).limit(1);
  if (!partner) return;

  const thread = await buildThread(leadId);
  if (thread.length === 0) return;

  const res = await anthropic.messages.create({
    model: BOT_MODEL,
    max_tokens: 600,
    system: replySystemPrompt(partner, lead.colorCode as ColorCode | null),
    messages: [{ role: "user", content: replyUserPrompt(thread, lead) }],
  });
  const raw = res.content
    .filter((c): c is Anthropic.TextBlock => c.type === "text")
    .map((c) => c.text)
    .join("\n")
    .trim();
  const { body, handoff } = stripHandoffToken(raw);
  if (!body) return;

  const subject = `Re: ${subjectFor(1, lead)}`;
  const send = await sendBotEmail({
    partner: { name: partner.name, slug: partner.slug },
    to: lead.email,
    subject,
    body,
  });

  await db.insert(botEmails).values({
    leadId,
    partnerId: partner.id,
    touchNumber: 99,
    leadType: "reply",
    subject,
    body,
    status: send.ok ? "sent" : `error:${send.error?.slice(0, 200) ?? "unknown"}`,
  });

  if (handoff) {
    await db.update(leads).set({ botPaused: true, status: "handoff" }).where(eq(leads.id, leadId));
    if (partner.emailNotifications) {
      const transcript = thread
        .map((t) => `${t.from === "partner" ? "You" : firstName(lead.name)}: ${t.body}`)
        .join("\n\n");
      await sendPartnerNotification({
        to: partner.email,
        subject: `Handoff — ${firstName(lead.name)} wants to talk`,
        body: `${firstName(lead.name)} (${lead.email}${lead.phone ? `, ${lead.phone}` : ""}) just asked to chat. Bot is paused.\n\nWhole thread:\n\n${transcript}`,
      }).catch(() => undefined);
    }
  }
}

async function buildThread(leadId: number): Promise<ConversationTurn[]> {
  const outbound = await db
    .select()
    .from(botEmails)
    .where(eq(botEmails.leadId, leadId))
    .orderBy(asc(botEmails.sentAt));
  const inbound = await db
    .select()
    .from(leadReplies)
    .where(eq(leadReplies.leadId, leadId))
    .orderBy(asc(leadReplies.receivedAt));

  const turns: ConversationTurn[] = [];
  for (const o of outbound) turns.push({ from: "partner", subject: o.subject, body: o.body, at: o.sentAt });
  for (const i of inbound) turns.push({ from: "lead", subject: i.subject, body: i.body, at: i.receivedAt });
  turns.sort((a, b) => a.at.getTime() - b.at.getTime());
  return turns;
}

export async function notifyNewLead(leadId: number): Promise<void> {
  const lead = await loadLead(leadId);
  if (!lead) return;
  const [partner] = await db.select().from(partners).where(eq(partners.id, lead.partnerId)).limit(1);
  if (!partner?.emailNotifications) return;
  await sendPartnerNotification({
    to: partner.email,
    subject: `New lead — ${firstName(lead.name)}`,
    body: `${firstName(lead.name)} (${lead.email}${lead.phone ? `, ${lead.phone}` : ""}) just finished your funnel.\n\nWhat they shared:\nOccupation: ${lead.currentWork ?? "—"}\n2-5 yr vision: ${lead.futureVision ?? "—"}\nBest time: ${lead.bestTime ?? "—"}\nInterest: ${lead.interest ?? "—"}\n\nOpen them in your dashboard to take it from here.`,
  }).catch(() => undefined);
}
