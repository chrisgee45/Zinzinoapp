CREATE TYPE "public"."alert_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."alert_type" AS ENUM('low_activity', 'activation_risk', 'follow_up_gap');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('login', 'page_view', 'training_view', 'link_click', 'prospect_added', 'message_sent', 'customer_added', 'checkout_started', 'checkout_completed');--> statement-breakpoint
CREATE TYPE "public"."reminder_type" AS ENUM('push', 'email', 'both');--> statement-breakpoint
CREATE TYPE "public"."tone_profile" AS ENUM('friendly', 'direct', 'professional', 'faith_based');--> statement-breakpoint
CREATE TABLE "ai_recommendations" (
	"id" serial PRIMARY KEY NOT NULL,
	"partner_id" integer NOT NULL,
	"date" date NOT NULL,
	"next_action" jsonb NOT NULL,
	"message_drafts" jsonb NOT NULL,
	"reasoning" jsonb NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bot_emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"partner_id" integer NOT NULL,
	"touch_number" integer NOT NULL,
	"lead_type" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"partner_id" integer NOT NULL,
	"event_type" "event_type" NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_replies" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"partner_id" integer NOT NULL,
	"from_email" text NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"partner_id" integer NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"current_work" text,
	"future_vision" text,
	"best_time" text,
	"status" text DEFAULT 'new' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"bot_paused" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_visits" (
	"id" serial PRIMARY KEY NOT NULL,
	"partner_id" integer NOT NULL,
	"page" text NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_hash" text,
	"user_agent" text,
	"referrer" text,
	"country" text,
	"city" text,
	"region" text,
	"device_type" text,
	"browser" text,
	"os" text
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"enrollment_link" text,
	"phone" text,
	"bio" text,
	"photo_url" text,
	"facebook_url" text,
	"instagram_url" text,
	"tiktok_url" text,
	"seo_title" text,
	"seo_description" text,
	"seo_keywords" text,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"subscription_status" text DEFAULT 'inactive' NOT NULL,
	"email_notifications" boolean DEFAULT true NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"tone_profile" "tone_profile" DEFAULT 'friendly' NOT NULL,
	"rescue_mode_until" timestamp with time zone,
	"coaching_minimal" boolean DEFAULT false NOT NULL,
	"coaching_paused_until" timestamp with time zone,
	"last_ai_call_date" date,
	"daily_ai_calls" integer DEFAULT 0 NOT NULL,
	"daily_regenerations" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"partner_id" integer NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"partner_id" integer NOT NULL,
	"lead_id" integer,
	"reminder_date" timestamp with time zone NOT NULL,
	"reminder_type" "reminder_type" NOT NULL,
	"message" text NOT NULL,
	"sent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rescue_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"partner_id" integer NOT NULL,
	"trigger_signal" text NOT NULL,
	"steps" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_steps" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_content" (
	"id" serial PRIMARY KEY NOT NULL,
	"partner_id" integer NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracked_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" integer NOT NULL,
	"prospect_id" integer,
	"destination_url" text NOT NULL,
	"token" text NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_clicked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_emails" ADD CONSTRAINT "bot_emails_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_emails" ADD CONSTRAINT "bot_emails_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_replies" ADD CONSTRAINT "lead_replies_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_replies" ADD CONSTRAINT "lead_replies_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_visits" ADD CONSTRAINT "page_visits_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rescue_plans" ADD CONSTRAINT "rescue_plans_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_content" ADD CONSTRAINT "site_content_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracked_links" ADD CONSTRAINT "tracked_links_owner_user_id_partners_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracked_links" ADD CONSTRAINT "tracked_links_prospect_id_leads_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_recommendations_partner_date_unique" ON "ai_recommendations" USING btree ("partner_id","date");--> statement-breakpoint
CREATE INDEX "bot_emails_lead_idx" ON "bot_emails" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "bot_emails_partner_idx" ON "bot_emails" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "events_partner_created_idx" ON "events" USING btree ("partner_id","created_at");--> statement-breakpoint
CREATE INDEX "events_partner_type_idx" ON "events" USING btree ("partner_id","event_type");--> statement-breakpoint
CREATE INDEX "lead_replies_lead_idx" ON "lead_replies" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_replies_partner_idx" ON "lead_replies" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "leads_partner_idx" ON "leads" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "leads_partner_created_idx" ON "leads" USING btree ("partner_id","created_at");--> statement-breakpoint
CREATE INDEX "page_visits_partner_ts_idx" ON "page_visits" USING btree ("partner_id","timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX "partners_email_unique" ON "partners" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "partners_slug_unique" ON "partners" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscriptions_endpoint_unique" ON "push_subscriptions" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "push_subscriptions_partner_idx" ON "push_subscriptions" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "reminders_partner_date_idx" ON "reminders" USING btree ("partner_id","reminder_date");--> statement-breakpoint
CREATE INDEX "reminders_pending_idx" ON "reminders" USING btree ("sent","reminder_date");--> statement-breakpoint
CREATE INDEX "rescue_plans_partner_active_idx" ON "rescue_plans" USING btree ("partner_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "settings_key_unique" ON "settings" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "site_content_partner_key_unique" ON "site_content" USING btree ("partner_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "tracked_links_token_unique" ON "tracked_links" USING btree ("token");--> statement-breakpoint
CREATE INDEX "tracked_links_owner_idx" ON "tracked_links" USING btree ("owner_user_id");