import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

/* ──────────────────────────── enums ──────────────────────────── */

export const eventTypeEnum = pgEnum("event_type", [
  "login",
  "page_view",
  "training_view",
  "link_click",
  "prospect_added",
  "message_sent",
  "customer_added",
  "checkout_started",
  "checkout_completed",
]);

export const toneProfileEnum = pgEnum("tone_profile", [
  "friendly",
  "direct",
  "professional",
  "faith_based",
]);

export const alertTypeEnum = pgEnum("alert_type", [
  "low_activity",
  "activation_risk",
  "follow_up_gap",
]);

export const alertStatusEnum = pgEnum("alert_status", ["open", "resolved"]);

export const reminderTypeEnum = pgEnum("reminder_type", ["push", "email", "both"]);

/* ─────────────────────────── partners ─────────────────────────── */

export const partners = pgTable(
  "partners",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    password: text("password").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    enrollmentLink: text("enrollment_link"),
    phone: text("phone"),
    bio: text("bio"),
    photoUrl: text("photo_url"),
    facebookUrl: text("facebook_url"),
    instagramUrl: text("instagram_url"),
    tiktokUrl: text("tiktok_url"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    seoKeywords: text("seo_keywords"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    subscriptionStatus: text("subscription_status").notNull().default("inactive"),
    emailNotifications: boolean("email_notifications").notNull().default(true),
    isAdmin: boolean("is_admin").notNull().default(false),
    toneProfile: toneProfileEnum("tone_profile").notNull().default("friendly"),
    rescueModeUntil: timestamp("rescue_mode_until", { withTimezone: true }),
    coachingMinimal: boolean("coaching_minimal").notNull().default(false),
    coachingPausedUntil: timestamp("coaching_paused_until", { withTimezone: true }),
    lastAiCallDate: date("last_ai_call_date"),
    dailyAiCalls: integer("daily_ai_calls").notNull().default(0),
    dailyRegenerations: integer("daily_regenerations").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailUnique: uniqueIndex("partners_email_unique").on(t.email),
    slugUnique: uniqueIndex("partners_slug_unique").on(t.slug),
  }),
);

/* ───────────────────────────── leads ───────────────────────────── */

export const leads = pgTable(
  "leads",
  {
    id: serial("id").primaryKey(),
    partnerId: integer("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    currentWork: text("current_work"),
    futureVision: text("future_vision"),
    bestTime: text("best_time"),
    status: text("status").notNull().default("new"),
    notes: text("notes").notNull().default(""),
    botPaused: boolean("bot_paused").notNull().default(false),
    interest: text("interest"), // "products" | "income" | null — partner pre-call intel
    timeline: text("timeline"), // "now" | "soon" | "researching" | null — pre-call urgency
    colorCode: text("color_code"), // "green" | "red" | "yellow" | "blue" | null — Color Code router pick from step 2
    whatPulledIn: text("what_pulled_in"), // free-text from the booking form, what the second video hooked them on
    submissionCount: integer("submission_count").notNull().default(1), // 1 on first squeeze, ++ on every return that re-enters the same email for the same partner. POST /api/leads upserts, no new lead row per resubmit.
    lastSubmissionAt: timestamp("last_submission_at", { withTimezone: true }).notNull().defaultNow(), // updated on every POST /api/leads for an existing email
    detailsSubmittedAt: timestamp("details_submitted_at", { withTimezone: true }), // when /details was PATCHed — base time for the warm sequence
    presentationSentAt: timestamp("presentation_sent_at", { withTimezone: true }), // when the partner manually sent the 20-min closing presentation (Phase F / §9B). Used to gate the CRM 'Send presentation' button so it can't double-send.
    coldStartedAt: timestamp("cold_started_at", { withTimezone: true }), // when the partner kicked off the 4-touch cold sequence for a manually-added contact. NULL until they hit 'Start cold outreach' in the CRM. Base time for cold touch scheduling.
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    partnerIdx: index("leads_partner_idx").on(t.partnerId),
    partnerCreatedIdx: index("leads_partner_created_idx").on(t.partnerId, t.createdAt),
  }),
);

/* ───────────────────────── siteContent ─────────────────────────── */

export const siteContent = pgTable(
  "site_content",
  {
    id: serial("id").primaryKey(),
    partnerId: integer("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    partnerKeyUnique: uniqueIndex("site_content_partner_key_unique").on(t.partnerId, t.key),
  }),
);

/* ──────────────────────────── settings ─────────────────────────── */

export const settings = pgTable(
  "settings",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull(),
    value: text("value").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    keyUnique: uniqueIndex("settings_key_unique").on(t.key),
  }),
);

/* ────────────────────── pushSubscriptions ──────────────────────── */

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: serial("id").primaryKey(),
    partnerId: integer("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    endpointUnique: uniqueIndex("push_subscriptions_endpoint_unique").on(t.endpoint),
    partnerIdx: index("push_subscriptions_partner_idx").on(t.partnerId),
  }),
);

/* ──────────────────────────── pageVisits ───────────────────────── */

export const pageVisits = pgTable(
  "page_visits",
  {
    id: serial("id").primaryKey(),
    partnerId: integer("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    page: text("page").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    referrer: text("referrer"),
    country: text("country"),
    city: text("city"),
    region: text("region"),
    deviceType: text("device_type"),
    browser: text("browser"),
    os: text("os"),
  },
  (t) => ({
    partnerTsIdx: index("page_visits_partner_ts_idx").on(t.partnerId, t.timestamp),
  }),
);

/* ───────────────────────────── events ──────────────────────────── */

export const events = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),
    partnerId: integer("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    eventType: eventTypeEnum("event_type").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    partnerCreatedIdx: index("events_partner_created_idx").on(t.partnerId, t.createdAt),
    partnerTypeIdx: index("events_partner_type_idx").on(t.partnerId, t.eventType),
  }),
);

/* ──────────────────────── calendarEvents ───────────────────────── */

// Partner's calendar. Each row is a scheduled commitment (call with a lead,
// team training, personal block). Optionally linked to a lead — when present,
// the calendar surface shows the lead's name and the lead detail shows the
// scheduled event. Reminders fire via the calendar scheduler at fixed
// offsets before startsAt (24h email, 1h email, 1h push, 15min push). The
// remindersSent jsonb array records which offsets have fired so a restart
// can't double-send.

export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: serial("id").primaryKey(),
    partnerId: integer("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    leadId: integer("lead_id").references(() => leads.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    notes: text("notes").notNull().default(""),
    location: text("location"), // "Phone", "Zoom https://...", "Coffee shop on 5th", etc.
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("scheduled"), // "scheduled" | "completed" | "cancelled"
    remindersSent: jsonb("reminders_sent")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    partnerStartsIdx: index("calendar_events_partner_starts_idx").on(t.partnerId, t.startsAt),
    leadIdx: index("calendar_events_lead_idx").on(t.leadId),
  }),
);

/* ──────────────────────── aiRecommendations ────────────────────── */

export const aiRecommendations = pgTable(
  "ai_recommendations",
  {
    id: serial("id").primaryKey(),
    partnerId: integer("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    nextAction: jsonb("next_action").$type<Record<string, unknown>>().notNull(),
    messageDrafts: jsonb("message_drafts").$type<Record<string, unknown>>().notNull(),
    reasoning: jsonb("reasoning").$type<Record<string, unknown>>().notNull(),
    completed: boolean("completed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    partnerDateUnique: uniqueIndex("ai_recommendations_partner_date_unique").on(t.partnerId, t.date),
  }),
);

/* ───────────────────────── rescuePlans ─────────────────────────── */

export const rescuePlans = pgTable(
  "rescue_plans",
  {
    id: serial("id").primaryKey(),
    partnerId: integer("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    triggerSignal: text("trigger_signal").notNull(),
    steps: jsonb("steps").$type<Array<{ id: string; title: string; description?: string }>>().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    completedSteps: integer("completed_steps").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    partnerActiveIdx: index("rescue_plans_partner_active_idx").on(t.partnerId, t.isActive),
  }),
);

/* ──────────────────────── trackedLinks ─────────────────────────── */

export const trackedLinks = pgTable(
  "tracked_links",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    ownerUserId: integer("owner_user_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    prospectId: integer("prospect_id").references(() => leads.id, { onDelete: "set null" }),
    destinationUrl: text("destination_url").notNull(),
    token: text("token").notNull(),
    label: text("label"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastClickedAt: timestamp("last_clicked_at", { withTimezone: true }),
  },
  (t) => ({
    tokenUnique: uniqueIndex("tracked_links_token_unique").on(t.token),
    ownerIdx: index("tracked_links_owner_idx").on(t.ownerUserId),
  }),
);

/* ─────────────────────────── botEmails ─────────────────────────── */

export const botEmails = pgTable(
  "bot_emails",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    partnerId: integer("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    touchNumber: integer("touch_number").notNull(),
    leadType: text("lead_type").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    status: text("status").notNull().default("sent"),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    leadIdx: index("bot_emails_lead_idx").on(t.leadId),
    partnerIdx: index("bot_emails_partner_idx").on(t.partnerId),
  }),
);

/* ────────────────────────── leadReplies ────────────────────────── */

export const leadReplies = pgTable(
  "lead_replies",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    partnerId: integer("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    fromEmail: text("from_email").notNull(),
    subject: text("subject"),
    body: text("body").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    leadIdx: index("lead_replies_lead_idx").on(t.leadId),
    partnerIdx: index("lead_replies_partner_idx").on(t.partnerId),
  }),
);

/* ─────────────────────────── reminders ─────────────────────────── */

export const reminders = pgTable(
  "reminders",
  {
    id: serial("id").primaryKey(),
    partnerId: integer("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    leadId: integer("lead_id").references(() => leads.id, { onDelete: "set null" }),
    reminderDate: timestamp("reminder_date", { withTimezone: true }).notNull(),
    reminderType: reminderTypeEnum("reminder_type").notNull(),
    message: text("message").notNull(),
    sent: boolean("sent").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    partnerDateIdx: index("reminders_partner_date_idx").on(t.partnerId, t.reminderDate),
    pendingIdx: index("reminders_pending_idx").on(t.sent, t.reminderDate),
  }),
);

/* ─────────────────────── types + zod schemas ───────────────────── */

export type Partner = typeof partners.$inferSelect;
export type NewPartner = typeof partners.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type PageVisit = typeof pageVisits.$inferSelect;
export type Event = typeof events.$inferSelect;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type BotEmail = typeof botEmails.$inferSelect;
export type LeadReply = typeof leadReplies.$inferSelect;
export type Reminder = typeof reminders.$inferSelect;
export type RescuePlan = typeof rescuePlans.$inferSelect;
export type AiRecommendation = typeof aiRecommendations.$inferSelect;
export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type NewCalendarEvent = typeof calendarEvents.$inferInsert;
export type TrackedLink = typeof trackedLinks.$inferSelect;

const slugPattern = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

export const registerPartnerSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "At least 3 characters")
    .max(40, "Keep it under 40 characters")
    .regex(slugPattern, "Lowercase letters, numbers, and hyphens only"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const updateProfileSchema = createInsertSchema(partners)
  .pick({
    name: true,
    phone: true,
    bio: true,
    photoUrl: true,
    facebookUrl: true,
    instagramUrl: true,
    tiktokUrl: true,
    seoTitle: true,
    seoDescription: true,
    seoKeywords: true,
    enrollmentLink: true,
    emailNotifications: true,
    toneProfile: true,
    coachingMinimal: true,
  })
  .partial();

export const createLeadSchema = z.object({
  partnerId: z.number().int().positive(),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(40).optional(),
  currentWork: z.string().trim().max(500).optional(),
  futureVision: z.string().trim().max(1000).optional(),
  bestTime: z.string().trim().max(120).optional(),
});

export const leadDetailsSchema = z.object({
  phone: z.string().trim().min(1, "Required").max(40),
  currentWork: z.string().trim().min(1, "Required").max(500),
  futureVision: z.string().trim().min(1, "Required").max(1000),
  bestTime: z.string().trim().min(1, "Required").max(120),
  timeline: z.enum(["now", "soon", "researching"]).optional(),
  whatPulledIn: z.string().trim().max(2000).optional(),
});

// Color Code router — single source of truth for valid color values, used
// by the PATCH /color route and by the funnel/CRM UI.
export const COLOR_CODES = ["green", "red", "yellow", "blue"] as const;
export type ColorCode = (typeof COLOR_CODES)[number];
export const colorCodeSchema = z.object({ colorCode: z.enum(COLOR_CODES) });

// Calendar event input. startsAt and endsAt are ISO 8601 strings on the wire
// (HTML datetime-local + JS Date.toISOString()). leadId optional so partners
// can block off availability or schedule non-lead-related work.
export const CALENDAR_EVENT_STATUSES = ["scheduled", "completed", "cancelled"] as const;
export const createCalendarEventSchema = z.object({
  title: z.string().trim().min(1).max(200),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }).optional(),
  durationMinutes: z.number().int().positive().max(60 * 24).optional(),
  location: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(5000).optional(),
  leadId: z.number().int().positive().optional(),
});
export const updateCalendarEventSchema = createCalendarEventSchema.partial().extend({
  status: z.enum(CALENDAR_EVENT_STATUSES).optional(),
});

export const pushSubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export const partnerSelectSchema = createSelectSchema(partners);
export const leadSelectSchema = createSelectSchema(leads);

export type RegisterPartnerInput = z.infer<typeof registerPartnerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type LeadDetailsInput = z.infer<typeof leadDetailsSchema>;
export type PushSubscribeInput = z.infer<typeof pushSubscribeSchema>;

export type PublicPartner = Pick<
  Partner,
  | "id"
  | "name"
  | "slug"
  | "bio"
  | "photoUrl"
  | "facebookUrl"
  | "instagramUrl"
  | "tiktokUrl"
  | "enrollmentLink"
  | "seoTitle"
  | "seoDescription"
  | "seoKeywords"
>;
