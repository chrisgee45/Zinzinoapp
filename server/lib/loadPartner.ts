import { eq, sql } from "drizzle-orm";
import { db } from "../db.js";
import { partners, type Partner } from "../../shared/schema.js";

// Schema-drift-resistant partner loaders. The default
// db.select().from(partners) generates an explicit column list from the
// in-code schema. A single column from a recent migration (most recently
// password_reset_hash + password_reset_expires_at from 0009) missing in
// the live DB takes down EVERY authenticated request, EVERY login, every
// route that needs the partner record. Fast-path tries the optimistic
// drizzle select; on failure, falls back to a raw SELECT of only columns
// known to exist before 0009 and stuffs safe defaults for the rest.

function mapRawPartner(row: Record<string, unknown>): Partner {
  return {
    id: row.id as number,
    email: row.email as string,
    password: row.password as string,
    name: row.name as string,
    slug: row.slug as string,
    stripeCustomerId: (row.stripe_customer_id as string | null) ?? null,
    stripeSubscriptionId: (row.stripe_subscription_id as string | null) ?? null,
    subscriptionStatus: (row.subscription_status as string) ?? "inactive",
    isAdmin: (row.is_admin as boolean) ?? false,
    enrollmentLink: (row.enrollment_link as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    bio: (row.bio as string | null) ?? null,
    facebookUrl: (row.facebook_url as string | null) ?? null,
    instagramUrl: (row.instagram_url as string | null) ?? null,
    tiktokUrl: (row.tiktok_url as string | null) ?? null,
    photoUrl: (row.photo_url as string | null) ?? null,
    emailNotifications: (row.email_notifications as boolean) ?? true,
    seoTitle: (row.seo_title as string | null) ?? null,
    seoDescription: (row.seo_description as string | null) ?? null,
    seoKeywords: (row.seo_keywords as string | null) ?? null,
    toneProfile: (row.tone_profile as string) ?? "friendly",
    rescueModeUntil: (row.rescue_mode_until as Date | null) ?? null,
    coachingMinimal: (row.coaching_minimal as boolean) ?? false,
    coachingPausedUntil: (row.coaching_paused_until as Date | null) ?? null,
    lastAiCallDate: (row.last_ai_call_date as string | null) ?? null,
    dailyAiCalls: (row.daily_ai_calls as number) ?? 0,
    dailyRegenerations: (row.daily_regenerations as number) ?? 0,
    passwordResetHash: null,
    passwordResetExpiresAt: null,
    createdAt: row.created_at as Date,
  } as Partner;
}

const FALLBACK_COLUMNS = `
  id, email, password, name, slug,
  stripe_customer_id, stripe_subscription_id, subscription_status, is_admin,
  enrollment_link, phone, bio,
  facebook_url, instagram_url, tiktok_url, photo_url,
  email_notifications,
  seo_title, seo_description, seo_keywords,
  tone_profile,
  rescue_mode_until, coaching_minimal, coaching_paused_until,
  last_ai_call_date, daily_ai_calls, daily_regenerations,
  created_at
`;

async function loadPartnerFallback(where: "id" | "email", value: number | string): Promise<Partner | null> {
  try {
    const result = await db.execute(
      where === "id"
        ? sql`SELECT ${sql.raw(FALLBACK_COLUMNS)} FROM partners WHERE id = ${value as number} LIMIT 1`
        : sql`SELECT ${sql.raw(FALLBACK_COLUMNS)} FROM partners WHERE email = ${value as string} LIMIT 1`,
    );
    const rows = (result as unknown as { rows?: Record<string, unknown>[] }).rows ?? [];
    const row = rows[0];
    return row ? mapRawPartner(row) : null;
  } catch (e) {
    console.error(`[auth] raw fallback partner lookup failed (by ${where}):`, e);
    return null;
  }
}

export async function loadPartnerById(id: number): Promise<Partner | null> {
  try {
    const [partner] = await db.select().from(partners).where(eq(partners.id, id)).limit(1);
    return partner ?? null;
  } catch (e) {
    console.warn(`[auth] loadPartnerById(${id}): full select failed, falling back to raw. Run pending migrations.`, e);
    return loadPartnerFallback("id", id);
  }
}

export async function loadPartnerByEmail(email: string): Promise<Partner | null> {
  try {
    const [partner] = await db.select().from(partners).where(eq(partners.email, email)).limit(1);
    return partner ?? null;
  } catch (e) {
    console.warn(`[auth] loadPartnerByEmail(${email}): full select failed, falling back to raw. Run pending migrations.`, e);
    return loadPartnerFallback("email", email);
  }
}
