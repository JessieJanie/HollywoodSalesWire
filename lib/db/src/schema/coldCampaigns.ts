import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

/**
 * One row per Instantly campaign batch created by the cold-campaign scheduler.
 * Tracks the historical mailbox ceiling and how many prospect leads have been
 * uploaded so far. The API derives each campaign's contact cap from its launch
 * week so the gradual ramp remains consistent across Tuesday–Thursday.
 */
export const coldCampaignsTable = pgTable("cold_campaigns", {
  id: serial("id").primaryKey(),
  /** Instantly campaign UUID returned by POST /campaigns. */
  campaignId: text("campaign_id").notNull(),
  /** Date-stamped tag, e.g. hsw-cold-08172026. Unique per batch. */
  batchTag: text("batch_tag").notNull().unique(),
  /** Human-readable deadline date string baked into email copy, e.g. "Tuesday, August 25". */
  deadline: text("deadline").notNull(),
  /** Historical mailbox daily ceiling; retained for backward-compatible records. */
  dailyLimit: integer("daily_limit").notNull(),
  /** Count of prospect leads uploaded so far (excludes the monitor address). */
  leadsUploaded: integer("leads_uploaded").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ColdCampaign = typeof coldCampaignsTable.$inferSelect;
