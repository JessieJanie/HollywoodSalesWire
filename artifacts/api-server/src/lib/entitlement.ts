import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { INACTIVE_SUB_STATUSES } from "./paidWire";

/**
 * Is this member currently entitled to NEW paid content (the latest HSW
 * Weekly Wire)? Mirrors the weekly paid-send rule: members with no Stripe
 * subscription id (comp / one-time founding purchases) stay entitled; a
 * subscription in an inactive state means no new paid content.
 *
 * NOTE: this is deliberately NOT used by the Special Report download route or
 * for historical Shelf issues — those follow the "yours to keep" policy
 * (see specialReports.test.ts guard). Only the latest-issue fallback for
 * members with no issues of their own uses this.
 */
export async function entitledToNewPaidContent(
  stripeSubscriptionId: string | null,
): Promise<boolean> {
  if (!stripeSubscriptionId) return true;
  const inactive = await db.execute(
    sql`select 1 from stripe.subscriptions where id = ${stripeSubscriptionId} and status = any(${[...INACTIVE_SUB_STATUSES]})`,
  );
  return inactive.rows.length === 0;
}
