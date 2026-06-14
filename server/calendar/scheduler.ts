import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "../db.js";
import { calendarEvents, leads, partners, type CalendarEvent, type Lead, type Partner } from "../../shared/schema.js";
import { sendPartnerNotification } from "../bot/email.js";
import { sendPushToPartner } from "../push/sender.js";

// Reminder offsets, minutes before startsAt. Each pair maps to a separate
// row in the calendarEvents.remindersSent jsonb array so a reboot can't
// re-send a fired reminder. Push-only at -15 because email at that range
// reads as too late to act on.
type Channel = "email" | "push";
interface ReminderRule {
  key: string;
  minutesBefore: number;
  channel: Channel;
}
const RULES: ReminderRule[] = [
  { key: "email_24h", minutesBefore: 24 * 60, channel: "email" },
  { key: "push_24h", minutesBefore: 24 * 60, channel: "push" },
  { key: "email_1h", minutesBefore: 60, channel: "email" },
  { key: "push_1h", minutesBefore: 60, channel: "push" },
  { key: "push_15m", minutesBefore: 15, channel: "push" },
];

const timers = new Map<string, NodeJS.Timeout>();
function ruleKey(eventId: number, key: string): string {
  return `evt:${eventId}:${key}`;
}

function clearKey(key: string): void {
  const t = timers.get(key);
  if (t) {
    clearTimeout(t);
    timers.delete(key);
  }
}

function scheduleAtKey(key: string, fireAt: Date, run: () => Promise<void>): void {
  clearKey(key);
  const delay = Math.max(0, fireAt.getTime() - Date.now());
  // Cap setTimeout delay. Anything longer than ~24 days gets re-scheduled
  // by catchup at next boot.
  const MAX = 2_147_000_000;
  if (delay > MAX) return;
  const handle = setTimeout(() => {
    timers.delete(key);
    void run().catch((err) => console.error(`[calendar] ${key} failed:`, err));
  }, delay);
  timers.set(key, handle);
}

export function cancelEventTimers(eventId: number): void {
  for (const rule of RULES) clearKey(ruleKey(eventId, rule.key));
}

/**
 * Schedule reminders for one event. Idempotent — clears any existing timers
 * for the event before re-arming so an update can shift the times safely.
 * Skips rules whose key is already in remindersSent.
 */
export function scheduleEventReminders(event: CalendarEvent): void {
  cancelEventTimers(event.id);
  if (event.status !== "scheduled") return;
  const start = event.startsAt.getTime();
  const sentSet = new Set(event.remindersSent ?? []);
  for (const rule of RULES) {
    if (sentSet.has(rule.key)) continue;
    const fireAt = new Date(start - rule.minutesBefore * 60 * 1000);
    // Don't bother scheduling reminders that already passed before the
    // event itself. Catchup also drops these.
    if (fireAt.getTime() < Date.now() - 60 * 1000) continue;
    scheduleAtKey(ruleKey(event.id, rule.key), fireAt, () => fireReminder(event.id, rule));
  }
}

async function loadEvent(eventId: number): Promise<CalendarEvent | null> {
  try {
    const [row] = await db.select().from(calendarEvents).where(eq(calendarEvents.id, eventId)).limit(1);
    return row ?? null;
  } catch (e) {
    console.error(`[calendar] loadEvent(${eventId}) failed:`, e);
    return null;
  }
}

async function fireReminder(eventId: number, rule: ReminderRule): Promise<void> {
  const event = await loadEvent(eventId);
  if (!event) return;
  if (event.status !== "scheduled") return;
  const sent = new Set(event.remindersSent ?? []);
  if (sent.has(rule.key)) return;

  const [partner] = await db.select().from(partners).where(eq(partners.id, event.partnerId)).limit(1);
  if (!partner) return;

  let lead: Lead | null = null;
  if (event.leadId) {
    const [l] = await db.select().from(leads).where(eq(leads.id, event.leadId)).limit(1);
    lead = l ?? null;
  }

  const ok = await deliverReminder(event, partner, lead, rule);

  // Persist the sent flag whether or not the channel call succeeded — we
  // don't want to retry-loop a permanently bad subscription.
  sent.add(rule.key);
  await db
    .update(calendarEvents)
    .set({ remindersSent: Array.from(sent) })
    .where(eq(calendarEvents.id, event.id))
    .catch((e) => console.warn(`[calendar] couldn't mark ${rule.key} sent for event ${event.id}:`, e));
  void ok;
}

function whenLine(event: CalendarEvent): string {
  // Plain readable timestamp. Partner's email client renders in their tz
  // via the iCalendar attachment later; for the body we keep it simple.
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  };
  try {
    return new Intl.DateTimeFormat("en-US", opts).format(event.startsAt);
  } catch {
    return event.startsAt.toISOString();
  }
}

function leadLine(lead: Lead | null): string {
  if (!lead) return "";
  const parts = [lead.name, lead.phone, lead.email].filter(Boolean);
  return parts.join(" · ");
}

async function deliverReminder(
  event: CalendarEvent,
  partner: Partner,
  lead: Lead | null,
  rule: ReminderRule,
): Promise<boolean> {
  const when = whenLine(event);
  const ll = leadLine(lead);
  const minutesAhead = rule.minutesBefore;
  const headline =
    minutesAhead >= 60 * 24
      ? "Tomorrow"
      : minutesAhead >= 60
        ? "In about an hour"
        : minutesAhead >= 15
          ? "In 15 minutes"
          : "Now";

  if (rule.channel === "email") {
    if (!partner.emailNotifications) return false;
    const body = [
      `${headline}: ${event.title}`,
      "",
      `When: ${when}`,
      event.location ? `Where: ${event.location}` : null,
      ll ? `Lead: ${ll}` : null,
      event.notes ? `\nNotes:\n${event.notes}` : null,
      "",
      "Manage in your dashboard: https://buildfromanywhere.com/calendar",
    ]
      .filter((line) => line !== null)
      .join("\n");
    const send = await sendPartnerNotification({
      to: partner.email,
      subject: `${headline}: ${event.title}`,
      body,
    });
    return send.ok;
  }

  // push
  const title = `${headline}: ${event.title}`;
  const body = [when, event.location, ll].filter(Boolean).join(" · ");
  await sendPushToPartner(partner.id, {
    title,
    body: body || "Tap to open",
    url: event.leadId ? `/dashboard/leads/${event.leadId}` : "/calendar",
    tag: `event-${event.id}-${rule.key}`,
  });
  return true;
}

/**
 * Boot-time catchup. Loads every scheduled event in the next 25 hours and
 * schedules whichever reminder rules are still pending. Run from index.ts
 * alongside the bot catchup.
 */
export async function runCalendarCatchup(): Promise<void> {
  const now = new Date();
  const cutoff = new Date(now.getTime() + 25 * 60 * 60 * 1000);
  try {
    const rows = await db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.status, "scheduled"),
          gte(calendarEvents.startsAt, now),
          lte(calendarEvents.startsAt, cutoff),
        ),
      );
    let staggerMs = 0;
    for (const row of rows) {
      // Add a tiny stagger so a thundering herd of reminders at boot don't
      // all fire on the same tick.
      setTimeout(() => scheduleEventReminders(row), staggerMs);
      staggerMs += 50;
    }
    console.log(`[calendar] catchup scheduled reminders for ${rows.length} upcoming event(s) in the next 25h.`);
  } catch (e) {
    console.error("[calendar] catchup failed:", e);
  }
}
