import type Anthropic from "@anthropic-ai/sdk";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { db } from "../db.js";
import { botEmails, leadReplies, leads, partners, type Lead, type Partner } from "../../shared/schema.js";
import { anthropic, botCanSend, BOT_MODEL } from "./clients.js";
import {
  firstName,
  personaSystemPrompt,
  replySystemPrompt,
  replyUserPrompt,
  stripHandoffToken,
  subjectFor,
  warmTouchUserPrompt,
  type ConversationTurn,
} from "./prompts.js";
import { sendBotEmail, sendPartnerNotification } from "./email.js";

// Warm sequence cadence, minutes from lead creation (matches REBUILD_PROMPT spec).
export const WARM_SEQUENCE_MINUTES = [15, 1710, 4440, 10200, 20280] as const;
export const WARM_TOUCH_COUNT = WARM_SEQUENCE_MINUTES.length;

const timers = new Map<string, NodeJS.Timeout>();

function timerKey(leadId: number, touch: number): string {
  return `${leadId}:${touch}`;
}

function clearTimer(leadId: number, touch: number): void {
  const key = timerKey(leadId, touch);
  const existing = timers.get(key);
  if (existing) {
    clearTimeout(existing);
    timers.delete(key);
  }
}

export function scheduleAt(leadId: number, touch: number, fireAt: Date, run: () => Promise<void>): void {
  clearTimer(leadId, touch);
  const delay = Math.max(0, fireAt.getTime() - Date.now());
  // Cap setTimeout delay; if longer than ~24 days, defer rescheduling at boot.
  const MAX = 2_147_000_000;
  if (delay > MAX) return;
  const handle = setTimeout(() => {
    timers.delete(timerKey(leadId, touch));
    void run().catch((err) => console.error(`[bot] touch ${touch} for lead ${leadId} failed:`, err));
  }, delay);
  timers.set(timerKey(leadId, touch), handle);
}

export async function startWarmSequence(leadId: number): Promise<void> {
  if (!botCanSend()) {
    console.log(`[bot] startWarmSequence(${leadId}) skipped — bot keys missing`);
    return;
  }
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead) return;
  if (lead.botPaused) return;

  const sent = await db
    .select({ touchNumber: botEmails.touchNumber })
    .from(botEmails)
    .where(eq(botEmails.leadId, leadId));
  const sentTouches = new Set(sent.map((r) => r.touchNumber));

  for (let touch = 1; touch <= WARM_TOUCH_COUNT; touch++) {
    if (sentTouches.has(touch)) continue;
    const fireAt = new Date(lead.createdAt.getTime() + WARM_SEQUENCE_MINUTES[touch - 1] * 60_000);
    scheduleAt(leadId, touch, fireAt, () => sendWarmTouch(leadId, touch));
  }
}

export async function sendWarmTouch(leadId: number, touch: number): Promise<void> {
  if (!botCanSend() || !anthropic) return;
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead || lead.botPaused) return;
  const [partner] = await db.select().from(partners).where(eq(partners.id, lead.partnerId)).limit(1);
  if (!partner) return;

  // Idempotency guard — don't double-send.
  const [existing] = await db
    .select({ id: botEmails.id })
    .from(botEmails)
    .where(and(eq(botEmails.leadId, leadId), eq(botEmails.touchNumber, touch)))
    .limit(1);
  if (existing) return;

  const body = await generateWarmTouchBody(partner, lead, touch);
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
    console.warn(`[bot] failed touch ${touch} for lead ${leadId}: ${send.error}`);
  }
}

async function generateWarmTouchBody(
  partner: Partner,
  lead: Lead,
  touch: number,
): Promise<string | null> {
  if (!anthropic) return null;
  try {
    const res = await anthropic.messages.create({
      model: BOT_MODEL,
      max_tokens: 600,
      system: personaSystemPrompt(partner),
      messages: [{ role: "user", content: warmTouchUserPrompt(touch, lead) }],
    });
    const text = res.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text)
      .join("\n")
      .trim();
    return text;
  } catch (err) {
    console.error(`[bot] anthropic error for touch ${touch} lead ${lead.id}:`, err);
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
  // Pull all qualified leads (step-3 form completed) that aren't paused.
  const rows = await db
    .select()
    .from(leads)
    .where(and(eq(leads.botPaused, false), isNotNull(leads.phone)));

  let staggerSec = 5;
  for (const lead of rows) {
    const sent = await db
      .select({ touchNumber: botEmails.touchNumber })
      .from(botEmails)
      .where(eq(botEmails.leadId, lead.id));
    const sentTouches = new Set(sent.map((r) => r.touchNumber));
    if (sentTouches.size >= WARM_TOUCH_COUNT) continue;

    for (let touch = 1; touch <= WARM_TOUCH_COUNT; touch++) {
      if (sentTouches.has(touch)) continue;
      const scheduledFor = new Date(lead.createdAt.getTime() + WARM_SEQUENCE_MINUTES[touch - 1] * 60_000);
      const fireAt = scheduledFor.getTime() < Date.now() + 5_000
        ? new Date(Date.now() + staggerSec * 1000)
        : scheduledFor;
      if (scheduledFor.getTime() < Date.now() + 5_000) staggerSec += 45;
      scheduleAt(lead.id, touch, fireAt, () => sendWarmTouch(lead.id, touch));
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
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
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
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead || lead.botPaused) return;
  const [partner] = await db.select().from(partners).where(eq(partners.id, lead.partnerId)).limit(1);
  if (!partner) return;

  const thread = await buildThread(leadId);
  if (thread.length === 0) return;

  const res = await anthropic.messages.create({
    model: BOT_MODEL,
    max_tokens: 600,
    system: replySystemPrompt(partner),
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
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead) return;
  const [partner] = await db.select().from(partners).where(eq(partners.id, lead.partnerId)).limit(1);
  if (!partner?.emailNotifications) return;
  await sendPartnerNotification({
    to: partner.email,
    subject: `New lead — ${firstName(lead.name)}`,
    body: `${firstName(lead.name)} (${lead.email}${lead.phone ? `, ${lead.phone}` : ""}) just finished your funnel.\n\nWhat they shared:\nOccupation: ${lead.currentWork ?? "—"}\n2-5 yr vision: ${lead.futureVision ?? "—"}\nBest time: ${lead.bestTime ?? "—"}\nInterest: ${lead.interest ?? "—"}\n\nOpen them in your dashboard to take it from here.`,
  }).catch(() => undefined);
}
