import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db.js";
import { leads, type Lead } from "../../shared/schema.js";

// Schema-drift-resistant lead loaders for the CRM-facing routes (the GET
// /api/leads list and the GET /api/leads/:id detail). The default
// db.select().from(leads) generates an explicit column list from the in-code
// schema. A single column from a recent migration missing in the live DB
// 500s every CRM request — the dashboard never loads, the lead detail page
// spins, the user sees 'the site is just spinning'.
//
// Strategy: optimistic drizzle select first, raw SQL fallback that only
// references columns guaranteed to exist before migration 0005. Newer
// columns fall back to safe defaults so the CRM keeps working while the
// operator runs the pending SQL.

const FALLBACK_COLUMNS = `
  id, partner_id, name, email, phone,
  current_work, future_vision, best_time,
  status, notes, bot_paused,
  interest, timeline,
  color_code, what_pulled_in,
  details_submitted_at,
  created_at
`;

function mapRawLead(row: Record<string, unknown>): Lead {
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
    presentationSentAt: null,
    coldStartedAt: null,
    source: (row.source as string | undefined) ?? "funnel",
    createdAt,
  } as Lead;
}

export async function loadLeadsForPartner(partnerId: number, limit = 500): Promise<Lead[]> {
  try {
    return await db
      .select()
      .from(leads)
      .where(eq(leads.partnerId, partnerId))
      .orderBy(desc(leads.createdAt))
      .limit(limit);
  } catch (e) {
    console.warn(`[leads] loadLeadsForPartner(${partnerId}): full select failed, falling back to raw. Run pending migrations.`, e);
    try {
      const result = await db.execute(sql`
        SELECT ${sql.raw(FALLBACK_COLUMNS)} FROM leads
        WHERE partner_id = ${partnerId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `);
      const rows = (result as unknown as { rows?: Record<string, unknown>[] }).rows ?? [];
      return rows.map(mapRawLead);
    } catch (e2) {
      console.error(`[leads] raw fallback for partner ${partnerId} also failed:`, e2);
      return [];
    }
  }
}

export async function loadLeadByIdForPartner(id: number, partnerId: number): Promise<Lead | null> {
  try {
    const [row] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, id), eq(leads.partnerId, partnerId)))
      .limit(1);
    return row ?? null;
  } catch (e) {
    console.warn(`[leads] loadLeadByIdForPartner(${id},${partnerId}): full select failed, falling back to raw.`, e);
    try {
      const result = await db.execute(sql`
        SELECT ${sql.raw(FALLBACK_COLUMNS)} FROM leads
        WHERE id = ${id} AND partner_id = ${partnerId}
        LIMIT 1
      `);
      const rows = (result as unknown as { rows?: Record<string, unknown>[] }).rows ?? [];
      const row = rows[0];
      return row ? mapRawLead(row) : null;
    } catch (e2) {
      console.error(`[leads] raw fallback for lead ${id} also failed:`, e2);
      return null;
    }
  }
}
