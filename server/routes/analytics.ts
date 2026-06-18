import { Router } from "express";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "../db.js";
import { leads, pageVisits } from "../../shared/schema.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// Reject anything that isn't a real IANA zone, then run a stricter
// character whitelist so the value is safe to inline as a SQL literal
// further down. IANA zone names are made of [A-Za-z_+/-] only; anything
// else can't be a real zone and we just fall back to UTC. Belt-and-
// braces — the SQL inlines via sql.raw so we want zero chance of an
// adversarial input slipping through.
function sanitizeTimezone(tz: string | undefined): string {
  if (!tz || typeof tz !== "string" || tz.length > 64) return "UTC";
  if (!/^[A-Za-z_+/-]+$/.test(tz)) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

// Local-midnight in the supplied IANA zone, expressed as a UTC instant.
// e.g. for America/New_York during EDT, returns the UTC moment that
// corresponds to local 00:00:00 on the partner's current calendar day.
function startOfTodayInTz(tz: string): Date {
  const now = new Date();
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(now).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]),
  );
  // Local "now" as a fake UTC instant — the numeric delta vs the real
  // UTC now is the zone offset at this moment (handles DST correctly).
  const localNowAsUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second),
  );
  const offsetMs = localNowAsUtc - now.getTime();
  const localMidnightAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  return new Date(localMidnightAsUtc - offsetMs);
}

// Range param → starting timestamp. 'all' returns null which the queries
// interpret as no lower bound. 'today' respects the partner's tz so the
// window rolls over at their local midnight, not UTC's.
function rangeStart(rangeParam: string | undefined, tz: string): Date | null {
  switch (rangeParam) {
    case "today":
      return startOfTodayInTz(tz);
    case "7d":
      return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    case "90d":
      return new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    case "all":
      return null;
    default:
      return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  }
}

/**
 * GET /api/analytics/summary?range=7d|30d|90d|all (default 30d)
 *
 * Returns counts the funnel page can render. All queries are scoped to the
 * authenticated partner. Visits + leads are independent surfaces — visit
 * counts include people who NEVER entered an email, which is exactly what
 * the partner wants to see ('how many landed even without filling out
 * contact info'). Lead counts give the conversion side of the funnel.
 */
router.get("/summary", authenticate, async (req, res, next) => {
  try {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const partnerId = req.partner.id;
  const tz = sanitizeTimezone(typeof req.query.tz === "string" ? req.query.tz : undefined);
  // Inlined as a SQL literal below — safe because sanitizeTimezone
  // restricted tz to IANA-shaped characters. Sidesteps any question
  // about whether the driver binds `AT TIME ZONE $N` correctly.
  const tzLiteral = sql.raw(`'${tz}'`);
  const start = rangeStart(typeof req.query.range === "string" ? req.query.range : undefined, tz);

  // Helper to apply the range gate consistently across the queries below.
  const visitsWhere = start
    ? and(eq(pageVisits.partnerId, partnerId), gte(pageVisits.timestamp, start))
    : eq(pageVisits.partnerId, partnerId);
  const leadsWhere = start
    ? and(eq(leads.partnerId, partnerId), gte(leads.createdAt, start))
    : eq(leads.partnerId, partnerId);

  // ── Visit totals ─────────────────────────────────────────────────────
  const [totals] = await db
    .select({
      visits: sql<number>`COUNT(*)::int`,
      uniqueVisitors: sql<number>`COUNT(DISTINCT ${pageVisits.ipHash})::int`,
    })
    .from(pageVisits)
    .where(visitsWhere);

  // ── Per-page breakdown ───────────────────────────────────────────────
  const perPage = await db
    .select({
      page: pageVisits.page,
      visits: sql<number>`COUNT(*)::int`,
      uniques: sql<number>`COUNT(DISTINCT ${pageVisits.ipHash})::int`,
    })
    .from(pageVisits)
    .where(visitsWhere)
    .groupBy(pageVisits.page);

  // ── Series for the chart. 'today' buckets by hour so the chart reads as
  //    a 24-bar intraday view; everything else buckets by day. The 'day'
  //    label column carries the bucket key in both cases so the client
  //    renderer doesn't need to know which one is which.
  const rangeKind = typeof req.query.range === "string" ? req.query.range : "30d";
  const bucketByHour = rangeKind === "today";
  // Bucket in the partner's local timezone so the hours of the day
  // and the date boundaries line up with how they think of "today"
  // and "yesterday". `tzLiteral` is the sanitised tz inlined as a
  // SQL literal (safe via the IANA-character whitelist above).
  const daily = bucketByHour
    ? await db
        .select({
          day: sql<string>`to_char(date_trunc('hour', ${pageVisits.timestamp} AT TIME ZONE ${tzLiteral}), 'YYYY-MM-DD"T"HH24":00"')`,
          visits: sql<number>`COUNT(*)::int`,
          uniques: sql<number>`COUNT(DISTINCT ${pageVisits.ipHash})::int`,
        })
        .from(pageVisits)
        .where(visitsWhere)
        .groupBy(sql`date_trunc('hour', ${pageVisits.timestamp} AT TIME ZONE ${tzLiteral})`)
        .orderBy(sql`date_trunc('hour', ${pageVisits.timestamp} AT TIME ZONE ${tzLiteral})`)
    : await db
        .select({
          day: sql<string>`to_char(date_trunc('day', ${pageVisits.timestamp} AT TIME ZONE ${tzLiteral}), 'YYYY-MM-DD')`,
          visits: sql<number>`COUNT(*)::int`,
          uniques: sql<number>`COUNT(DISTINCT ${pageVisits.ipHash})::int`,
        })
        .from(pageVisits)
        .where(visitsWhere)
        .groupBy(sql`date_trunc('day', ${pageVisits.timestamp} AT TIME ZONE ${tzLiteral})`)
        .orderBy(sql`date_trunc('day', ${pageVisits.timestamp} AT TIME ZONE ${tzLiteral})`);

  // ── Top referrers (top 5, drop in-app self-referrals) ────────────────
  const topReferrers = await db
    .select({
      referrer: pageVisits.referrer,
      visits: sql<number>`COUNT(*)::int`,
    })
    .from(pageVisits)
    .where(visitsWhere)
    .groupBy(pageVisits.referrer)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(8);

  // ── Lead funnel counts ───────────────────────────────────────────────
  const [funnel] = await db
    .select({
      leadsCreated: sql<number>`COUNT(*)::int`,
      booked: sql<number>`COUNT(${leads.detailsSubmittedAt})::int`,
      colorTagged: sql<number>`COUNT(${leads.colorCode})::int`,
      presentationsSent: sql<number>`COUNT(${leads.presentationSentAt})::int`,
      customers: sql<number>`SUM(CASE WHEN ${leads.status} = 'customer' THEN 1 ELSE 0 END)::int`,
    })
    .from(leads)
    .where(leadsWhere);

  res.json({
    tz,
    range: typeof req.query.range === "string" ? req.query.range : "30d",
    visits: {
      total: totals?.visits ?? 0,
      unique: totals?.uniqueVisitors ?? 0,
      perPage,
      daily,
      topReferrers: topReferrers.filter((r) => r.referrer),
    },
    funnel: {
      leadsCreated: funnel?.leadsCreated ?? 0,
      booked: funnel?.booked ?? 0,
      colorTagged: funnel?.colorTagged ?? 0,
      presentationsSent: funnel?.presentationsSent ?? 0,
      customers: funnel?.customers ?? 0,
    },
  });
  } catch (err) {
    // Express 4 doesn't auto-forward async throws to the error
    // middleware — without next(err) the response just hangs and the
    // client spins forever. Forward explicitly so /api/analytics
    // always returns something the client can react to.
    next(err);
  }
});

export default router;
