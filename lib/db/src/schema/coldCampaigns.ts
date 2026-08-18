import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

/**
 * One row per Instantly campaign batch created by the cold-campaign scheduler.
 * Tracks the daily send limit (auto-ramped per batch) and how many prospect
 * leads have been uploaded so far, so the API can enforce the plan cap.
 */
export const coldCampaignsTable = pgTable("cold_campaigns", {
  id: serial("id").primaryKey(),
  /** Instantly campaign UUID returned by POST /campaigns. */
  campaignId: text("campaign_id").notNull(),
  /** Date-stamped tag, e.g. hsw-cold-08172026. Unique per batch. */
  batchTag: text("batch_tag").notNull().unique(),
  /** Human-readable deadline date string baked into email copy, e.g. "Tuesday, August 25". */
  deadline: text("deadline").notNull(),
  /** Emails per day cap set on this campaign (auto-ramped: 2 → 5 → 10 → 20 → 30). */
  dailyLimit: integer("daily_limit").notNull(),
  /** Count of prospect leads uploaded so far (excludes the monitor address). */
  leadsUploaded: integer("leads_uploaded").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ColdCampaign = typeof coldCampaignsTable.$inferSelect;
