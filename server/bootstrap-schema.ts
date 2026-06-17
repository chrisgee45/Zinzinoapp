// Lazy schema bootstrap. Some tables were introduced after the initial
// drizzle migrations and aren't always present on every database the
// app runs against (Supabase migrations are applied manually). To stop
// new features from silently 500-ing when a partner's database is one
// migration behind, this runs an idempotent CREATE TABLE IF NOT EXISTS
// against the connection at server boot.
//
// This is NOT a substitute for the real migration files under
// drizzle/* — those remain the source of truth. This just ensures the
// feature surface is usable while operators catch up.

import { sql } from "drizzle-orm";
import { db } from "./db.js";

export async function bootstrapSchema(): Promise<void> {
  try {
    // ── customers (drizzle/0012_add_customers.sql) ─────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "customers" (
        "id"                 serial PRIMARY KEY NOT NULL,
        "partner_id"         integer NOT NULL REFERENCES "partners"("id") ON DELETE CASCADE,
        "name"               text NOT NULL,
        "email"              text NOT NULL,
        "phone"              text,
        "notes"              text DEFAULT '' NOT NULL,
        "ai_paused"          boolean DEFAULT false NOT NULL,
        "email_consent"      boolean DEFAULT true NOT NULL,
        "welcome_sent_at"    timestamp with time zone,
        "last_drip_at"       timestamp with time zone,
        "introduced_products" jsonb DEFAULT '[]'::jsonb NOT NULL,
        "created_at"         timestamp with time zone DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "customers_partner_idx" ON "customers" ("partner_id")`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS "customers_partner_email_unique" ON "customers" ("partner_id", "email")`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "customer_emails" (
        "id"          serial PRIMARY KEY NOT NULL,
        "customer_id" integer NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
        "partner_id"  integer NOT NULL REFERENCES "partners"("id") ON DELETE CASCADE,
        "direction"   text NOT NULL,
        "kind"        text NOT NULL,
        "subject"     text,
        "body"        text NOT NULL,
        "status"      text DEFAULT 'sent' NOT NULL,
        "sent_at"     timestamp with time zone DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "customer_emails_customer_idx" ON "customer_emails" ("customer_id")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "customer_emails_partner_idx" ON "customer_emails" ("partner_id")`);

    console.log("[bootstrap] schema check ok");
  } catch (err) {
    console.warn("[bootstrap] schema check failed (non-fatal):", (err as Error).message);
  }
}
