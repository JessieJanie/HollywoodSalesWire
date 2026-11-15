import { pgTable, text, serial, timestamp, integer, jsonb, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * One row per Monday research run (auto or manual). Holds the drafted paid
 * Wire, the drafted free edition, and the source receipts.
 */
export const wireRunsTable = pgTable("wire_runs", {
  id: serial("id").primaryKey(),
  /** ISO date of the Monday this run belongs to, in Pacific time (e.g. "2026-08-03") */
  weekKey: text("week_key").notNull(),
  status: text("status").notNull().default("running"), // running | ready | failed
  trigger: text("trigger").notNull().default("schedule"), // schedule | manual
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  error: text("error"),
  wireMarkdown: text("wire_markdown"),
  freeSubject: text("free_subject"),
  freeBody: text("free_body"),
  /** Array of { url, label, wordCount, status } receipts for every fetch attempted */
  sources: jsonb("sources"),
  /** When the "draft is ready" email was accepted. The 24-hour auto-send clock starts here. */
  draftReadyNotifiedAt: timestamp("draft_ready_notified_at", { withTimezone: true }),
  /** Set when the publisher holds this draft. Auto-send will not touch it. */
  autoSendHoldAt: timestamp("auto_send_hold_at", { withTimezone: true }),
  /** null | auto_sent_after_24h once the unattended draft was published. */
  autoSendState: text("auto_send_state"),
}, (t) => [
  // One run per week — the DB is the distributed lock (autoscale runs many instances).
  uniqueIndex("wire_runs_week_key_unique").on(t.weekKey),
]);

/** Raw fetched page text per run — kept so next week's run can diff against it. */
export const researchPagesTable = pgTable("research_pages", {
  id: serial("id").primaryKey(),
  runId: integer("run_id").notNull(),
  url: text("url").notNull(),
  label: text("label").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  wordCount: integer("word_count").notNull(),
  markdown: text("markdown").notNull(),
});

export type WireRun = typeof wireRunsTable.$inferSelect;
export type ResearchPage = typeof researchPagesTable.$inferSelect;
