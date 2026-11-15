import { pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Once-per-key publisher notices (missed draft, missed send, one stale-run
 * retry). The unique alert_key is the claim: a second scheduler tick cannot
 * send the same notice or buy a second automatic research retry.
 */
export const publisherAlertsTable = pgTable(
  "publisher_alerts",
  {
    id: serial("id").primaryKey(),
    alertKey: text("alert_key").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("publisher_alerts_alert_key_unique").on(t.alertKey)],
);

export type PublisherAlert = typeof publisherAlertsTable.$inferSelect;
