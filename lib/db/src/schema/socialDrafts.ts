import { pgTable, text, serial, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * One row per social-media draft pushed to Typefully (LinkedIn + X), used as
 * the idempotency claim so autoscale instances and 5-minute scheduler ticks
 * can never push the same draft twice — even if the publisher deletes the
 * draft in Typefully afterwards.
 *
 * kind: "brief" (Tuesday full Brief) | "mon" | "wed" | "fri" (highlights).
 * status: pending (claimed) → scheduled → published, or failed. Stale pending
 * is never retried because provider success may be ambiguous. Legacy pushed
 * rows briefly use confirming while an in-place `plan_at` repair is leased.
 * A failed row is NOT retried automatically — the pre-flight/notify email
 * tells the publisher, matching the paid-Wire safety-rail philosophy.
 */
export const socialDraftsTable = pgTable(
  "social_drafts",
  {
    id: serial("id").primaryKey(),
    kind: text("kind").notNull(),
    weekKey: text("week_key").notNull(),
    status: text("status").notNull().default("pending"),
    typefullyDraftId: text("typefully_draft_id"),
    /** The LinkedIn text that was pushed — kept so Friday can avoid repeating Wednesday's angle. */
    postText: text("post_text"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("social_drafts_kind_week_key_unique").on(t.kind, t.weekKey)],
);

export type SocialDraft = typeof socialDraftsTable.$inferSelect;
