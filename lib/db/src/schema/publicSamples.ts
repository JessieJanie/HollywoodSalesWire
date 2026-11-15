import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/** The one paid issue the publisher has chosen to show at /sample. */
export const publicSamplesTable = pgTable("public_samples", {
  id: serial("id").primaryKey(),
  weekKey: text("week_key").notNull().unique(),
  selectedAt: timestamp("selected_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PublicSample = typeof publicSamplesTable.$inferSelect;
