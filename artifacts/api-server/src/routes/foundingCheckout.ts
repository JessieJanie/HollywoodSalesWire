import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, emailSubscribersTable } from "@workspace/db";
import { foundingDeadline } from "../lib/foundingDeadline";
import { getColdOfferStatus } from "../lib/coldCampaigns";
import { SITE_URL } from "../lib/emailSequence";

const router: IRouter = Router();

/**
 * Founding-rate checkout links are NEVER shipped in the client bundle.
 * The private offer page sends buyers here; we verify the offer is
 * genuinely still open, then redirect to Stripe. Expired or unknown
 * tokens/sources land on the public (regular-rate) order page.
 */
const FOUNDING_CHECKOUT = {
  individual: "https://buy.stripe.com/aFa9AScCF163d3h5Db3ks06",
  team: "https://buy.stripe.com/bJe00i7ilaGD8N1e9H3ks08",
} as const;

router.get("/founding-checkout", async (req, res): Promise<void> => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  const source = typeof req.query.source === "string" ? req.query.source : "";
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
  } else if (source === "cold") {
    // No per-lead token exists for cold-campaign prospects — verify server-side
    // that a cold batch's 7-day Founding window is still open before honoring it.
    const status = await getColdOfferStatus();
    if (status.active) {
      res.redirect(302, FOUNDING_CHECKOUT[plan]);
      return;
    }
  }
  res.redirect(302, `${SITE_URL}/order`);
});

export default router;
