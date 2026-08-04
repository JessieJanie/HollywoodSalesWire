import { pgTable, text, serial, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";

// A one-shot scheduled email send (paid Wire or Weekly Brief), executed by the
// scheduler tick once send_at passes. The unique index on (kind, week_key)
// makes seeding idempotent across autoscale instances, and the paid path is
// additionally protected by the paid_wire_sends week-key claim.
export const scheduledSendsTable = pgTable(
  "scheduled_sends",
  {
    id: serial("id").primaryKey(),
    kind: text("kind").notNull(), // "paid" | "brief"
    weekKey: text("week_key").notNull(),
    sendAt: timestamp("send_at", { withTimezone: true }).notNull(),
    subject: text("subject").notNull(),
    bodyText: text("body_text").notNull(),
    // pending → sending (leased) → sent | failed. A failed row is NOT retried
    // automatically — it surfaces in the publisher console flow instead.
    status: text("status").notNull().default("pending"),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    sentCount: integer("sent_count").notNull().default(0),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("scheduled_sends_kind_week_key_unique").on(t.kind, t.weekKey)],
);

export type ScheduledSend = typeof scheduledSendsTable.$inferSelect;
