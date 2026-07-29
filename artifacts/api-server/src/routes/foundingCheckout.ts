import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, emailSubscribersTable } from "@workspace/db";
import { foundingDeadline } from "../lib/foundingDeadline";
import { SITE_URL } from "../lib/emailSequence";

const router: IRouter = Router();

/**
 * Founding-rate checkout links are NEVER shipped in the client bundle.
 * The private offer page sends buyers here; we verify the subscriber's
 * personal deadline is still open, then redirect to Stripe. Expired or
 * unknown tokens land on the public (regular-rate) order page.
 */
const FOUNDING_CHECKOUT = {
  individual: "https://buy.stripe.com/7sYeV70l5bT5bDz47t1VK04",
  team: "https://buy.stripe.com/5kQfZb2td4qD373dI31VK05",
} as const;

router.get("/founding-checkout", async (req, res): Promise<void> => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  const plan = req.query.plan === "team" ? "team" : "individual";

  if (token) {
    const [subscriber] = await db
      .select()
      .from(emailSubscribersTable)
      .where(eq(emailSubscribersTable.unsubscribeToken, token));
    if (subscriber && Date.now() <= foundingDeadline(subscriber.createdAt).getTime()) {
      res.redirect(302, FOUNDING_CHECKOUT[plan]);
      return;
    }
  }
  res.redirect(302, `${SITE_URL}/order`);
});

export default router;
