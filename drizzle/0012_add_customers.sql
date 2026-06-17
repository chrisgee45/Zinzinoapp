-- Adds customers + customer_emails tables for the Customer-Care AI Robot
-- (Z Force build spec Feature A). Idempotent — safe to re-run in Supabase.

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
);

CREATE INDEX IF NOT EXISTS "customers_partner_idx" ON "customers" ("partner_id");
CREATE UNIQUE INDEX IF NOT EXISTS "customers_partner_email_unique" ON "customers" ("partner_id", "email");

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
);

CREATE INDEX IF NOT EXISTS "customer_emails_customer_idx" ON "customer_emails" ("customer_id");
CREATE INDEX IF NOT EXISTS "customer_emails_partner_idx" ON "customer_emails" ("partner_id");
