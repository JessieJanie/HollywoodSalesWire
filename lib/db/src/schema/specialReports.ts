import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

/**
 * One row per special report slot. The slug is fixed at seed time; objectPath
 * is null until the publisher uploads the PDF via the publisher console.
 */
export const specialReportsTable = pgTable("special_reports", {
  id: serial("id").primaryKey(),
  /** Stable slug: spend-map | greenlight-window | requisition-read */
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  /** Normalized GCS object path (e.g. /objects/uploads/<uuid>). Null until uploaded. */
  objectPath: text("object_path"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
});

export type SpecialReport = typeof specialReportsTable.$inferSelect;
