import { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, emailSubscribersTable, sequenceEmailsTable } from "@workspace/db";
import { SubscribeBody, SubscribeResponse } from "@workspace/api-zod";
import { resendRequest } from "../lib/resend";
import { FROM_ADDRESS, SITE_URL, WELCOME_EMAIL } from "../lib/emailSequence";

const router: IRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Simple in-memory rate limiting (per instance): 5 signups / 10 min per IP,
// plus a global cap of 500 signups per day as a spam-blast circuit breaker.
const ipHits = new Map<string, number[]>();
let dailyCount = 0;
let dailyReset = Date.now() + 24 * 60 * 60 * 1000;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  if (now > dailyReset) {
    dailyCount = 0;
    dailyReset = now + 24 * 60 * 60 * 1000;
  }
  if (dailyCount >= 500) return true;
  const hits = (ipHits.get(ip) ?? []).filter((t) => now - t < 10 * 60 * 1000);
  if (hits.length >= 5) return true;
  hits.push(now);
  ipHits.set(ip, hits);
  if (ipHits.size > 10000) ipHits.clear(); // bound memory
  dailyCount++;
  return false;
}

router.post("/subscribe", async (req, res): Promise<void> => {
  // Honeypot: real users never fill the hidden "company" field. Pretend success.
  if (typeof req.body?.company === "string" && req.body.company.trim() !== "") {
    res.status(201).json(SubscribeResponse.parse({ status: "subscribed" }));
    return;
  }

  const ip = req.ip ?? "unknown";
  if (rateLimited(ip)) {
    res.status(429).json({ error: "Too many requests — please try again later." });
    return;
  }

  const parsed = SubscribeBody.safeParse(req.body);
  const email = parsed.success ? parsed.data.email.trim().toLowerCase() : "";
  if (!parsed.success || !EMAIL_RE.test(email)) {
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }

  const [existing] = await db
    .select()
    .from(emailSubscribersTable)
    .where(eq(emailSubscribersTable.email, email));

  if (existing) {
    // Already on the list (or previously unsubscribed — don't re-add them silently).
    res.status(201).json(SubscribeResponse.parse({ status: "already_subscribed" }));
    return;
  }

  const token = randomBytes(24).toString("hex");
  const [subscriber] = await db
    .insert(emailSubscribersTable)
    .values({ email, unsubscribeToken: token })
    .returning();

  // Send a single immediate welcome email; the subscriber is now on the warm
  // prospect list. Campaigns to this list are sent manually later.
  const unsubscribeUrl = `${SITE_URL}/api/unsubscribe?token=${token}`;
  try {
    const sent = await resendRequest<{ id: string }>("/emails", {
      method: "POST",
      body: {
        from: FROM_ADDRESS,
        to: [email],
        subject: WELCOME_EMAIL.subject,
        html: WELCOME_EMAIL.body({ unsubscribeUrl }),
      },
    });
    await db.insert(sequenceEmailsTable).values({
      subscriberId: subscriber.id,
      step: 0, // step 0 = welcome email
      resendEmailId: sent.id,
      scheduledAt: new Date(),
      status: "sent",
    });
  } catch (err) {
    // They're still on the list even if the welcome email fails — log and continue.
    req.log.error({ err, email }, "Failed to send welcome email");
    await db.insert(sequenceEmailsTable).values({
      subscriberId: subscriber.id,
      step: 0,
      scheduledAt: new Date(),
      status: "failed",
    });
  }

  res.status(201).json(SubscribeResponse.parse({ status: "subscribed" }));
});

router.get("/unsubscribe", async (req, res): Promise<void> => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  const page = (title: string, message: string) =>
    `<!doctype html><html><head><title>${title}</title></head><body style="font-family:Georgia,serif;max-width:480px;margin:80px auto;padding:0 24px;color:#1a1a1a;"><h1 style="font-size:24px;">${title}</h1><p>${message}</p><p><a href="${SITE_URL}" style="color:#1d5c3a;">&larr; Hollywood Sales Wire</a></p></body></html>`;

  if (!token) {
    res.status(400).send(page("Invalid link", "This unsubscribe link is missing its token."));
    return;
  }

  const [subscriber] = await db
    .select()
    .from(emailSubscribersTable)
    .where(eq(emailSubscribersTable.unsubscribeToken, token));

  if (!subscriber) {
    res.status(404).send(page("Link not found", "This unsubscribe link is invalid or expired."));
    return;
  }

  if (subscriber.status !== "unsubscribed") {
    await db
      .update(emailSubscribersTable)
      .set({ status: "unsubscribed" })
      .where(eq(emailSubscribersTable.id, subscriber.id));
  }

  // Cancel any still-scheduled emails.
  const scheduled = await db
    .select()
    .from(sequenceEmailsTable)
    .where(eq(sequenceEmailsTable.subscriberId, subscriber.id));

  for (const item of scheduled) {
    if (item.status === "scheduled" && item.resendEmailId) {
      try {
        await resendRequest(`/emails/${item.resendEmailId}/cancel`, { method: "POST" });
        await db
          .update(sequenceEmailsTable)
          .set({ status: "canceled" })
          .where(eq(sequenceEmailsTable.id, item.id));
      } catch (err) {
        // Already sent or already canceled — mark canceled anyway so we don't retry.
        req.log.warn({ err, id: item.id }, "Could not cancel scheduled email");
        await db
          .update(sequenceEmailsTable)
          .set({ status: "canceled" })
          .where(eq(sequenceEmailsTable.id, item.id));
      }
    }
  }

  res.send(
    page(
      "You're unsubscribed",
      "You won't receive any more emails from this series. Sorry to see you go.",
    ),
  );
});

export default router;
