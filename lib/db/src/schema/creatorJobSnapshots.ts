import { pgTable, text, serial, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * One row per (week, studio, exact IMDb category) from the weekly Digital
 * Creator job-title search. Lets the Wire compare hiring counts week over
 * week per title per company instead of only reporting the current count.
 *
 * status "failed" means that studio/category search did not run this week —
 * its coverage is UNKNOWN, never a 0 count. Comparisons must skip failed
 * rows on either side rather than treating them as zero.
 */
export const creatorJobSnapshotsTable = pgTable(
  "creator_job_snapshots",
  {
    id: serial("id").primaryKey(),
    /** ISO date of the Monday this snapshot belongs to, in Pacific time. */
    weekKey: text("week_key").notNull(),
    studio: text("studio").notNull(),
    /** Exact IMDb category, e.g. "Digital Creator" — never a summed total. */
    category: text("category").notNull(),
    status: text("status").notNull(), // ok | failed
    /** Exact-title match count. Meaningless (0) when status is "failed". */
    matchCount: integer("match_count").notNull().default(0),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Upsert target: a manual retry within the same week replaces its own
    // snapshot rather than appending a duplicate.
    uniqueIndex("creator_job_snapshots_week_studio_category_unique").on(
      t.weekKey,
      t.studio,
      t.category,
    ),
  ],
);

export type CreatorJobSnapshot = typeof creatorJobSnapshotsTable.$inferSelect;
