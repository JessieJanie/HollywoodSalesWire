import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

/**
 * Every email address ever uploaded to a cold-campaign batch. Checked before
 * each automated Apollo prospecting run so the same person is never
 * re-contacted across weeks — Apollo's per-company search returns the same
 * few named contacts every time, so without this guard the automation would
 * re-pitch the same handful of people every batch.
 */
export const coldProspectContactsTable = pgTable("cold_prospect_contacts", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  company: text("company"),
  contactedAt: timestamp("contacted_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ColdProspectContact = typeof coldProspectContactsTable.$inferSelect;
