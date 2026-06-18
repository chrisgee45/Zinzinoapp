-- Phase 1 of the CRM upgrade.
-- Adds subscription/lifecycle date fields to `customers` and a new
-- `customer_products` table for tracking what each customer is on
-- (with size/flavor variant, quantity, and snapshot partner credit).
-- All operations are idempotent so this is safe to re-run.

ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "billing_date" date;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "test_date" date;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "retest_date" date;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "test_reminder_sent_at" timestamp with time zone;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "billing_reminder_sent_at" timestamp with time zone;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "retest_reminder_sent_at" timestamp with time zone;

CREATE TABLE IF NOT EXISTS "customer_products" (
  "id"                    serial PRIMARY KEY NOT NULL,
  "customer_id"           integer NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
  "partner_id"            integer NOT NULL REFERENCES "partners"("id") ON DELETE CASCADE,
  "product_name"          text NOT NULL,
  "variant"               text,
  "quantity"              integer DEFAULT 1 NOT NULL,
  "monthly_credit_cents"  integer DEFAULT 0 NOT NULL,
  "added_at"              timestamp with time zone DEFAULT now() NOT NULL,
  "removed_at"            timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "customer_products_customer_idx" ON "customer_products" ("customer_id");
CREATE INDEX IF NOT EXISTS "customer_products_partner_idx" ON "customer_products" ("partner_id");
