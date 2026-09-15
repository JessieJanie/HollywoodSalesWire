import { pgTable, text, serial, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * One row per tracked project trigger — a new production-entity formation or
 * an official state incentive award. `triggerDate` is the zero point the
 * production-stage estimate model counts elapsed weeks from (see
 * lib/productionStage.ts). Rows outside the model's schedule window are
 * pruned weekly since they no longer produce an informative stage estimate.
 */
export const projectSignalsTable = pgTable(
  "project_signals",
  {
    id: serial("id").primaryKey(),
    /** "entity_formation" | "incentive_award" */
    sourceType: text("source_type").notNull(),
    /** Display name — entity name or incentive/announcement title. */
    name: text("name").notNull(),
    /** State/jurisdiction code or name, as reported by the source feed. */
    jurisdiction: text("jurisdiction").notNull(),
    /** The date this trigger is anchored to (publishedAt from the source feed). */
    triggerDate: timestamp("trigger_date", { withTimezone: true }).notNull(),
    /** Official source/registry URL, shown alongside the stage estimate. */
    sourceUrl: text("source_url").notNull(),
    /** weekKey of the wire run that first recorded this signal. */
    firstSeenWeekKey: text("first_seen_week_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Same project seen again in a later crawl updates in place rather than duplicating.
    uniqueIndex("project_signals_source_key_unique").on(t.sourceType, t.jurisdiction, t.name),
  ],
);

export type ProjectSignal = typeof projectSignalsTable.$inferSelect;
