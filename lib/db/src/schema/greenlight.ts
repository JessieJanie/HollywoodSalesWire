import { sql } from "drizzle-orm";
import { integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * One row per production, deduped on normalized title + company.
 * firstSeenAt never moves. sources keeps every public URL and the status
 * we saw there. Numbers are stored as published text, not recalculated.
 */
export const productionsTable = pgTable(
  "productions",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    company: text("company").notNull(),
    titleKey: text("title_key").notNull(),
    companyKey: text("company_key").notNull(),
    jurisdictions: jsonb("jurisdictions").notNull().default(sql`'[]'::jsonb`),
    projectType: text("project_type"),
    credit: text("credit"),
    qualifiedSpend: text("qualified_spend"),
    filmingDays: text("filming_days"),
    jobs: text("jobs"),
    status: text("status").notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
    sources: jsonb("sources").notNull().default(sql`'[]'::jsonb`),
  },
  (t) => [uniqueIndex("productions_title_company_unique").on(t.titleKey, t.companyKey)],
);

export const subscriberPreferencesTable = pgTable("subscriber_preferences", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  states: jsonb("states").notNull().default(sql`'[]'::jsonb`),
  projectTypes: jsonb("project_types").notNull().default(sql`'[]'::jsonb`),
  budgetBands: jsonb("budget_bands").notNull().default(sql`'[]'::jsonb`),
  vendorCategories: jsonb("vendor_categories").notNull().default(sql`'[]'::jsonb`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const watchlistTable = pgTable(
  "production_watchlist",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    titleKey: text("title_key"),
    companyKey: text("company_key"),
    label: text("label").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("watchlist_email_target_unique").on(t.email, t.titleKey, t.companyKey)],
);

export const watchEventsTable = pgTable("production_watch_events", {
  id: serial("id").primaryKey(),
  watchId: integer("watch_id").notNull(),
  kind: text("kind").notNull(), // permit | registry | hiring | trade
  detail: text("detail").notNull(),
  sourceUrl: text("source_url"),
  seenAt: timestamp("seen_at", { withTimezone: true }).notNull().defaultNow(),
});

export const spendReportDraftsTable = pgTable("spend_report_drafts", {
  id: serial("id").primaryKey(),
  monthKey: text("month_key").notNull(),
  markdown: text("markdown").notNull(),
  /** draft until a human publishes it. A draft must not be promised on the site. */
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const checkoutEventsTable = pgTable("checkout_events", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(), // offer_view | plan_click | session_completed | session_expired
  path: text("path"),
  plan: text("plan"),
  deadlineParam: text("deadline_param"),
  sessionId: text("session_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ProductionRow = typeof productionsTable.$inferSelect;
