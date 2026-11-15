import { db, checkoutEventsTable } from "@workspace/db";
import { logger } from "./logger";

/** Records a Stripe Checkout outcome. Does not change prices, links, or the session. */
export async function recordStripeCheckout(event: {
  type?: string;
  data?: { object?: { id?: string } };
}): Promise<void> {
  const type = event.type;
  if (type !== "checkout.session.completed" && type !== "checkout.session.expired") return;
  try {
    await db.insert(checkoutEventsTable).values({
      kind: type === "checkout.session.completed" ? "session_completed" : "session_expired",
      sessionId: event.data?.object?.id ?? null,
    });
  } catch (err) {
    logger.error({ err, type }, "checkout event was not recorded");
  }
}
