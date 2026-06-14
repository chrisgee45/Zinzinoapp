import { Router } from "express";
import { z } from "zod";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "../db.js";
import {
  calendarEvents,
  createCalendarEventSchema,
  leads,
  updateCalendarEventSchema,
} from "../../shared/schema.js";
import { authenticate } from "../middleware/auth.js";
import { cancelEventTimers, scheduleEventReminders } from "../calendar/scheduler.js";

const router = Router();

const DEFAULT_DURATION_MIN = 30;

function computeEndsAt(startsAtIso: string, endsAtIso: string | undefined, durationMinutes: number | undefined): Date {
  const start = new Date(startsAtIso);
  if (endsAtIso) return new Date(endsAtIso);
  if (durationMinutes) return new Date(start.getTime() + durationMinutes * 60 * 1000);
  return new Date(start.getTime() + DEFAULT_DURATION_MIN * 60 * 1000);
}

// GET /api/calendar/events?from=ISO&to=ISO  (defaults: now → +30 days)
router.get("/events", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const fromQ = typeof req.query.from === "string" ? req.query.from : null;
  const toQ = typeof req.query.to === "string" ? req.query.to : null;
  const from = fromQ ? new Date(fromQ) : new Date(Date.now() - 12 * 60 * 60 * 1000);
  const to = toQ ? new Date(toQ) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    res.status(400).json({ error: "Invalid from/to" });
    return;
  }

  const rows = await db
    .select({
      id: calendarEvents.id,
      title: calendarEvents.title,
      notes: calendarEvents.notes,
      location: calendarEvents.location,
      startsAt: calendarEvents.startsAt,
      endsAt: calendarEvents.endsAt,
      status: calendarEvents.status,
      leadId: calendarEvents.leadId,
      leadName: leads.name,
      leadEmail: leads.email,
      leadPhone: leads.phone,
      leadColorCode: leads.colorCode,
    })
    .from(calendarEvents)
    .leftJoin(leads, eq(calendarEvents.leadId, leads.id))
    .where(
      and(
        eq(calendarEvents.partnerId, req.partner.id),
        gte(calendarEvents.startsAt, from),
        lte(calendarEvents.startsAt, to),
      ),
    )
    .orderBy(asc(calendarEvents.startsAt));

  res.json({ events: rows });
});

// GET /api/calendar/events/upcoming  — quick widget query, next 7 days
router.get("/events/upcoming", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const now = new Date();
  const week = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      id: calendarEvents.id,
      title: calendarEvents.title,
      startsAt: calendarEvents.startsAt,
      endsAt: calendarEvents.endsAt,
      location: calendarEvents.location,
      status: calendarEvents.status,
      leadId: calendarEvents.leadId,
      leadName: leads.name,
      leadColorCode: leads.colorCode,
    })
    .from(calendarEvents)
    .leftJoin(leads, eq(calendarEvents.leadId, leads.id))
    .where(
      and(
        eq(calendarEvents.partnerId, req.partner.id),
        eq(calendarEvents.status, "scheduled"),
        gte(calendarEvents.startsAt, now),
        lte(calendarEvents.startsAt, week),
      ),
    )
    .orderBy(asc(calendarEvents.startsAt))
    .limit(20);

  res.json({ events: rows });
});

router.post("/events", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const parsed = createCalendarEventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.flatten() });
    return;
  }

  // If leadId is set, confirm partner owns the lead.
  if (parsed.data.leadId) {
    const [lead] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.id, parsed.data.leadId), eq(leads.partnerId, req.partner.id)))
      .limit(1);
    if (!lead) {
      res.status(400).json({ error: "Lead not found" });
      return;
    }
  }

  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = computeEndsAt(parsed.data.startsAt, parsed.data.endsAt, parsed.data.durationMinutes);
  if (endsAt.getTime() <= startsAt.getTime()) {
    res.status(400).json({ error: "End time must be after start time" });
    return;
  }

  const [created] = await db
    .insert(calendarEvents)
    .values({
      partnerId: req.partner.id,
      leadId: parsed.data.leadId ?? null,
      title: parsed.data.title,
      notes: parsed.data.notes ?? "",
      location: parsed.data.location ?? null,
      startsAt,
      endsAt,
      status: "scheduled",
    })
    .returning();

  scheduleEventReminders(created);

  res.status(201).json({ event: created });
});

router.patch("/events/:id", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid event id" });
    return;
  }
  const parsed = updateCalendarEventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.flatten() });
    return;
  }

  const [existing] = await db
    .select()
    .from(calendarEvents)
    .where(and(eq(calendarEvents.id, id), eq(calendarEvents.partnerId, req.partner.id)))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const update: Partial<typeof calendarEvents.$inferInsert> = {};
  if (parsed.data.title !== undefined) update.title = parsed.data.title;
  if (parsed.data.notes !== undefined) update.notes = parsed.data.notes;
  if (parsed.data.location !== undefined) update.location = parsed.data.location || null;
  if (parsed.data.status !== undefined) update.status = parsed.data.status;
  if (parsed.data.leadId !== undefined) update.leadId = parsed.data.leadId || null;

  // Time changes recompute remindersSent — we wipe the array so a moved
  // event can re-fire its reminders against the new time.
  const timeChanged = parsed.data.startsAt !== undefined || parsed.data.endsAt !== undefined || parsed.data.durationMinutes !== undefined;
  let newStart = existing.startsAt;
  let newEnd = existing.endsAt;
  if (parsed.data.startsAt) {
    newStart = new Date(parsed.data.startsAt);
    update.startsAt = newStart;
  }
  if (parsed.data.endsAt) {
    newEnd = new Date(parsed.data.endsAt);
    update.endsAt = newEnd;
  } else if (parsed.data.startsAt && parsed.data.durationMinutes) {
    newEnd = new Date(newStart.getTime() + parsed.data.durationMinutes * 60 * 1000);
    update.endsAt = newEnd;
  } else if (parsed.data.startsAt && !parsed.data.endsAt) {
    // Preserve duration when only startsAt moves.
    const durMs = existing.endsAt.getTime() - existing.startsAt.getTime();
    newEnd = new Date(newStart.getTime() + durMs);
    update.endsAt = newEnd;
  }
  if (timeChanged) update.remindersSent = [];
  if (newEnd.getTime() <= newStart.getTime()) {
    res.status(400).json({ error: "End time must be after start time" });
    return;
  }

  const [updated] = await db
    .update(calendarEvents)
    .set(update)
    .where(eq(calendarEvents.id, id))
    .returning();

  // Re-schedule timers if still scheduled, otherwise wipe them.
  if (updated.status === "scheduled") {
    scheduleEventReminders(updated);
  } else {
    cancelEventTimers(updated.id);
  }

  res.json({ event: updated });
});

router.delete("/events/:id", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid event id" });
    return;
  }
  const [existing] = await db
    .select({ id: calendarEvents.id })
    .from(calendarEvents)
    .where(and(eq(calendarEvents.id, id), eq(calendarEvents.partnerId, req.partner.id)))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  cancelEventTimers(id);
  await db.delete(calendarEvents).where(eq(calendarEvents.id, id));
  res.json({ ok: true });
});

// ICS export for a single event — partner downloads and adds to their own
// calendar app. Server-side renders the actual UTC times so the partner's
// calendar app handles timezone display.
router.get("/events/:id/ics", authenticate, async (req, res) => {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid event id" });
    return;
  }
  const [event] = await db
    .select()
    .from(calendarEvents)
    .leftJoin(leads, eq(calendarEvents.leadId, leads.id))
    .where(and(eq(calendarEvents.id, id), eq(calendarEvents.partnerId, req.partner.id)))
    .limit(1);
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  const ev = event.calendar_events;
  const lead = event.leads;

  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}T${String(d.getUTCHours()).padStart(2, "0")}${String(d.getUTCMinutes()).padStart(2, "0")}00Z`;
  const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
  const description = [ev.notes, lead ? `Lead: ${lead.name} (${lead.email})` : null]
    .filter((line): line is string => Boolean(line))
    .join("\n\n");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Build From Anywhere//Calendar//EN",
    "BEGIN:VEVENT",
    `UID:bfa-evt-${ev.id}@buildfromanywhere`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(ev.startsAt)}`,
    `DTEND:${fmt(ev.endsAt)}`,
    `SUMMARY:${escape(ev.title)}`,
    ev.location ? `LOCATION:${escape(ev.location)}` : null,
    description ? `DESCRIPTION:${escape(description)}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter((line): line is string => line !== null)
    .join("\r\n");

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="event-${ev.id}.ics"`);
  res.send(ics);
});

export default router;
