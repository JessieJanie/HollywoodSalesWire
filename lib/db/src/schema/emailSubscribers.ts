import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const emailSubscribersTable = pgTable("email_subscribers", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  status: text("status").notNull().default("active"), // active | unsubscribed
  unsubscribeToken: text("unsubscribe_token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const sequenceEmailsTable = pgTable("sequence_emails", {
  id: serial("id").primaryKey(),
  subscriberId: integer("subscriber_id")
    .notNull()
    .references(() => emailSubscribersTable.id),
  step: integer("step").notNull(), // 1..5
  resendEmailId: text("resend_email_id"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  // pending = waiting for the scheduler to hand it to Resend (send time was
  // beyond Resend's ~30-day window at signup); scheduling = claimed by a
  // scheduler tick (claimedAt set; stale claims are recovered after 15 min).
  status: text("status").notNull().default("scheduled"), // pending | scheduling | scheduled | sent | canceled | failed
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEmailSubscriberSchema = createInsertSchema(emailSubscribersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertEmailSubscriber = z.infer<typeof insertEmailSubscriberSchema>;
export type EmailSubscriber = typeof emailSubscribersTable.$inferSelect;
export type SequenceEmail = typeof sequenceEmailsTable.$inferSelect;
