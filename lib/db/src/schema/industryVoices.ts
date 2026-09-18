import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

/**
 * Queue of publisher-submitted "Industry Voices" items — named opinions from
 * industry figures (X posts, interviews, op-eds) that Karilyn wants surfaced
 * in the paid Wire as clearly attributed commentary, not treated as sourced
 * research. The Wire's editor prompt is otherwise "receipts, not commentary"
 * (subscribers pay for names/timing/receipts), so these are boxed off into
 * their own labeled section and never blended into the numbered signal items.
 *
 * A pending item (usedInWeekKey IS NULL) is offered to the next drafting run;
 * once that run reaches "ready" status the item is stamped with that week's
 * key so it is never reused in a later issue.
 */
export const industryVoicesTable = pgTable("industry_voices", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(), // e.g. "Spencer Pratt (@spencerpratt on X)"
  sourceUrl: text("source_url"),
  excerpt: text("excerpt").notNull(), // full text or key passage, verbatim
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  usedInWeekKey: text("used_in_week_key"),
});

export type IndustryVoice = typeof industryVoicesTable.$inferSelect;
