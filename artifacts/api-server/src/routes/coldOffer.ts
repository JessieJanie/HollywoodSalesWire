import { Router, type IRouter } from "express";
import { FoundingOfferResponse } from "@workspace/api-zod";
import { getColdOfferStatus } from "../lib/coldCampaigns";

const router: IRouter = Router();

/**
 * Cold-campaign recipients have no personal token (leads live in Instantly,
 * not our subscriber table) — this reports whether ANY recent cold batch's
 * 7-day Founding-rate window is still open, so the page they land on from a
 * cold email shows the same price the email promised instead of reverting
 * to the regular rate. Reuses the FoundingOfferResponse shape (active/deadline/
 * deadlineLabel) since it's the same contract with a different source.
 */
router.get("/cold-offer", async (_req, res): Promise<void> => {
  const status = await getColdOfferStatus();
  res.json(FoundingOfferResponse.parse(status));
});

export default router;
