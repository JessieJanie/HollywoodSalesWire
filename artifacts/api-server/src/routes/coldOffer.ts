import { Router, type IRouter } from "express";
import { FoundingOfferResponse } from "@workspace/api-zod";
import { getColdOfferStatus } from "../lib/coldCampaigns";

const router: IRouter = Router();

/**
 * Cold-campaign recipients have no personal token (leads live in Instantly,
 * not our subscriber table) — this reports the Founding-rate deadline as a
 * rolling weekly cutoff: the coming Monday, 23:59:59 Eastern (today's
 * Monday if viewed on a Monday). So the page they land on from a cold email
 * always shows the same deadline the email promised. Reuses the
 * FoundingOfferResponse shape (active/deadline/deadlineLabel) since it's the
 * same contract with a different source.
 */
router.get("/cold-offer", async (_req, res): Promise<void> => {
  const status = await getColdOfferStatus();
  res.json(FoundingOfferResponse.parse(status));
});

export default router;
