import { pgTable, text, serial, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";

// One row per weekly paid-Wire send to members. The unique index on week_key
// is the double-send guard: the row is claimed atomically before sending.
export const paidWireSendsTable = pgTable(
  "paid_wire_sends",
  {
    id: serial("id").primaryKey(),
    weekKey: text("week_key").notNull(),
    subject: text("subject").notNull(),
    bodyText: text("body_text").notNull(),
    // "sending" until every batch is confirmed accepted; only then "sent".
    // A claim is never deleted on failure — retries resume it with the same
    // Resend idempotency keys, so an ambiguous failure can never double-send.
    status: text("status").notNull().default("sending"), // sending | sent
    // Snapshot of eligible member emails frozen at claim time. Retries replay
    // exactly this list in this order, so batch idempotency keys always map
    // to identical payloads even if membership changes between attempts.
    recipientEmails: text("recipient_emails").array().notNull(),
    recipientCount: integer("recipient_count").notNull().default(0),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("paid_wire_sends_week_key_unique").on(t.weekKey)],
);

export type PaidWireSend = typeof paidWireSendsTable.$inferSelect;
