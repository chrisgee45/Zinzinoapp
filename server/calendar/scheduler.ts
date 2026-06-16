import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "../db.js";
import { calendarEvents, leads, partners, type CalendarEvent, type Lead, type Partner } from "../../shared/schema.js";
import { sendPartnerNotification } from "../bot/email.js";
import { sendPushToPartner } from "../push/sender.js";

export type ReminderChannel = "email" | "push";
export interface EventReminder {
  minutesBefore: number;
  channel: ReminderChannel;
  sentAt: string | null;
}

// Default reminder set seeded on new events when the client doesn't specify
// its own. Matches the legacy hardcoded behavior so the upgrade is a no-op
// for existing UX.
export const DEFAULT_REMINDERS: EventReminder[] = [
  { minutesBefore: 24 * 60, channel: "email", sentAt: null },
  { minutesBefore: 24 * 60, channel: "push", sentAt: null },
  { minutesBefore: 60, channel: "email", sentAt: null },
  { minutesBefore: 60, channel: "push", sentAt: null },
  { minutesBefore: 15, channel: "push", sentAt: null },
];

const timers = new Map<string, NodeJS.Timeout>();
function ruleKey(eventId: number, idx: number): string {
  return `evt:${eventId}:${idx}`;
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
  const MAX = 2_147_000_000;
  if (delay > MAX) return;
  const handle = setTimeout(() => {
    timers.delete(key);
    void run().catch((err) => console.error(`[calendar] ${key} failed:`, err));
  }, delay);
  timers.set(key, handle);
}

export function cancelEventTimers(eventId: number): void {
  // Clear every cached key for the event (unknown idx upper bound — scan).
  for (const key of timers.keys()) {
    if (key.startsWith(`evt:${eventId}:`)) clearKey(key);
  }
}

/**
 * Schedule reminders for one event. Idempotent — clears existing timers
 * before re-arming. Skips reminders already fired (sentAt non-null).
 */
export function scheduleEventReminders(event: CalendarEvent): void {
  cancelEventTimers(event.id);
  if (event.status !== "scheduled") return;
  const start = event.startsAt.getTime();
  const reminders = (event.reminders ?? []) as EventReminder[];
  reminders.forEach((rem, idx) => {
    if (rem.sentAt) return;
    const fireAt = new Date(start - rem.minutesBefore * 60 * 1000);
    if (fireAt.getTime() < Date.now() - 60 * 1000) return; // past, drop
    scheduleAtKey(ruleKey(event.id, idx), fireAt, () => fireReminder(event.id, idx));
  });
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

async function fireReminder(eventId: number, idx: number): Promise<void> {
  const event = await loadEvent(eventId);
  if (!event) return;
  if (event.status !== "scheduled") return;
  const reminders = [...((event.reminders ?? []) as EventReminder[])];
  const rem = reminders[idx];
  if (!rem || rem.sentAt) return;

  const [partner] = await db.select().from(partners).where(eq(partners.id, event.partnerId)).limit(1);
  if (!partner) return;

  let lead: Lead | null = null;
  if (event.leadId) {
    const [l] = await db.select().from(leads).where(eq(leads.id, event.leadId)).limit(1);
    lead = l ?? null;
  }

  await deliverReminder(event, partner, lead, rem);

  reminders[idx] = { ...rem, sentAt: new Date().toISOString() };
  await db
    .update(calendarEvents)
    .set({ reminders })
    .where(eq(calendarEvents.id, event.id))
    .catch((e) =>
      console.warn(`[calendar] couldn't persist sentAt on reminder ${idx} of event ${event.id}:`, e),
    );
}

function whenLine(event: CalendarEvent): string {
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

function headlineFor(minutesBefore: number): string {
  if (minutesBefore <= 0) return "Starting now";
  if (minutesBefore < 60) return `In ${minutesBefore} minutes`;
  if (minutesBefore < 60 * 24) {
    const h = Math.round(minutesBefore / 60);
    return h === 1 ? "In about an hour" : `In about ${h} hours`;
  }
  const d = Math.round(minutesBefore / (60 * 24));
  return d === 1 ? "Tomorrow" : `In ${d} days`;
}

function leadLine(lead: Lead | null): string {
  if (!lead) return "";
  return [lead.name, lead.phone, lead.email].filter(Boolean).join(" · ");
}

async function deliverReminder(
  event: CalendarEvent,
  partner: Partner,
  lead: Lead | null,
  rem: EventReminder,
): Promise<void> {
  const when = whenLine(event);
  const ll = leadLine(lead);
  const headline = headlineFor(rem.minutesBefore);

  if (rem.channel === "email") {
    if (!partner.emailNotifications) return;
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
    await sendPartnerNotification({
      to: partner.email,
      subject: `${headline}: ${event.title}`,
      body,
    });
    return;
  }

  // push
  const title = `${headline}: ${event.title}`;
  const body = [when, event.location, ll].filter(Boolean).join(" · ");
  await sendPushToPartner(partner.id, {
    title,
    body: body || "Tap to open",
    url: event.leadId ? `/dashboard/leads/${event.leadId}` : "/calendar",
    tag: `event-${event.id}-${rem.minutesBefore}-${rem.channel}`,
  });
}

/**
 * Boot-time catchup. Loads every scheduled event in the next 25 hours and
 * schedules whichever per-event reminders are still pending.
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
      setTimeout(() => scheduleEventReminders(row), staggerMs);
      staggerMs += 50;
    }
    console.log(`[calendar] catchup scheduled reminders for ${rows.length} upcoming event(s) in the next 25h.`);
  } catch (e) {
    console.error("[calendar] catchup failed:", e);
  }
}
