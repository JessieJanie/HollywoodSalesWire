import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

/**
 * Paid members — created automatically by the Stripe webhook when a checkout
 * completes on one of the live payment links. Stripe itself (synced into the
 * `stripe` schema by stripe-replit-sync) remains the source of truth for
 * billing state; this table stores only our app-side membership record.
 */
export const membersTable = pgTable("members", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  plan: text("plan").notNull().default("member"), // founding-individual | founding-team | individual | team | member
  amountCents: integer("amount_cents"),
  welcomeSentAt: timestamp("welcome_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Member = typeof membersTable.$inferSelect;
