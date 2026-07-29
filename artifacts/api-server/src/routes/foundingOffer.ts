import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, emailSubscribersTable } from "@workspace/db";
import { FoundingOfferResponse } from "@workspace/api-zod";
import { deadlineLabel, foundingDeadline } from "../lib/foundingDeadline";

const router: IRouter = Router();

/**
 * The private founding-offer page checks here whether this subscriber's
 * offer window (14 days from signup, midnight Eastern) is still open.
 */
router.get("/founding-offer", async (req, res): Promise<void> => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!token) {
    res.status(404).json({ error: "Unknown offer link." });
    return;
  }

  const [subscriber] = await db
    .select()
    .from(emailSubscribersTable)
    .where(eq(emailSubscribersTable.unsubscribeToken, token));

  if (!subscriber) {
    res.status(404).json({ error: "Unknown offer link." });
    return;
  }

  const deadline = foundingDeadline(subscriber.createdAt);
  res.json(
    FoundingOfferResponse.parse({
      active: Date.now() <= deadline.getTime(),
      deadline: deadline.toISOString(),
      deadlineLabel: deadlineLabel(subscriber.createdAt),
    }),
  );
});

export default router;
