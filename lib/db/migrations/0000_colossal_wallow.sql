-- Baseline + incremental migration (idempotent).
-- All existing tables use CREATE TABLE IF NOT EXISTS so this is safe to apply
-- against a production database that was previously managed by drizzle-kit push.
-- New elements (paid_wire_sends, special_reports, two members columns) use the
-- same IF NOT EXISTS / DO-block guards.

CREATE TABLE IF NOT EXISTS "email_subscribers" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"unsubscribe_token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_subscribers_email_unique" UNIQUE("email"),
	CONSTRAINT "email_subscribers_unsubscribe_token_unique" UNIQUE("unsubscribe_token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sequence_emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscriber_id" integer NOT NULL,
	"step" integer NOT NULL,
	"resend_email_id" text,
	"scheduled_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "weekly_previews" (
	"id" serial PRIMARY KEY NOT NULL,
	"subject" text NOT NULL,
	"body_text" text NOT NULL,
	"recipient_count" integer NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "research_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"url" text NOT NULL,
	"label" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"word_count" integer NOT NULL,
	"markdown" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wire_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"week_key" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"trigger" text DEFAULT 'schedule' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"error" text,
	"wire_markdown" text,
	"free_subject" text,
	"free_body" text,
	"sources" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "members" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"plan" text DEFAULT 'member' NOT NULL,
	"amount_cents" integer,
	"welcome_sent_at" timestamp with time zone,
	"special_reports_sent_at" timestamp with time zone,
	"special_reports_delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "members_email_unique" UNIQUE("email")
);
--> statement-breakpoint
-- New table: tracks idempotent weekly paid-Wire sends.
CREATE TABLE IF NOT EXISTS "paid_wire_sends" (
	"id" serial PRIMARY KEY NOT NULL,
	"week_key" text NOT NULL,
	"subject" text NOT NULL,
	"body_text" text NOT NULL,
	"status" text DEFAULT 'sending' NOT NULL,
	"recipient_emails" text[] NOT NULL,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- New table: tracks Special Report PDF uploads.
CREATE TABLE IF NOT EXISTS "special_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"object_path" text,
	"uploaded_at" timestamp with time zone,
	CONSTRAINT "special_reports_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
-- Add FK only if it doesn't already exist (existing dbs created via push lack journal).
DO $$ BEGIN
  ALTER TABLE "sequence_emails"
    ADD CONSTRAINT "sequence_emails_subscriber_id_email_subscribers_id_fk"
    FOREIGN KEY ("subscriber_id") REFERENCES "public"."email_subscribers"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "wire_runs_week_key_unique" ON "wire_runs" USING btree ("week_key");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "paid_wire_sends_week_key_unique" ON "paid_wire_sends" USING btree ("week_key");
--> statement-breakpoint
-- New columns on members (added in this task).
-- ALTER TABLE ... ADD COLUMN IF NOT EXISTS is PostgreSQL 9.6+.
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "special_reports_sent_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "special_reports_delivered_at" timestamp with time zone;
--> statement-breakpoint
-- Tracks each Instantly cold-campaign batch: ID, daily limit, and leads uploaded.
CREATE TABLE IF NOT EXISTS "cold_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"batch_tag" text NOT NULL,
	"deadline" text NOT NULL,
	"daily_limit" integer NOT NULL,
	"leads_uploaded" integer NOT NULL DEFAULT 0,
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	CONSTRAINT "cold_campaigns_batch_tag_unique" UNIQUE("batch_tag")
);
