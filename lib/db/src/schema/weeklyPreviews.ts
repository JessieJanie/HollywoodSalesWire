import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

// One row per weekly free-edition send.
export const weeklyPreviewsTable = pgTable("weekly_previews", {
  id: serial("id").primaryKey(),
  subject: text("subject").notNull(),
  bodyText: text("body_text").notNull(),
  recipientCount: integer("recipient_count").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
});

export type WeeklyPreview = typeof weeklyPreviewsTable.$inferSelect;
