import { Router, type IRouter } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { timingSafeEqual } from "node:crypto";
import { db, emailSubscribersTable, weeklyPreviewsTable } from "@workspace/db";
import {
  PublisherDraftResponse,
  PublisherSendResponse,
} from "@workspace/api-zod";
import { resendRequest } from "../lib/resend";
import { FROM_ADDRESS, SITE_URL } from "../lib/emailSequence";

const router: IRouter = Router();

function keyOk(key: unknown): boolean {
  const expected = process.env.PUBLISHER_KEY;
  if (typeof key !== "string" || !expected) return false;
  const a = Buffer.from(key);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const DRAFT_PROMPT = `You are the editor of "Hollywood Sales Wire," a paid weekly sales-intelligence briefing for vendors selling into the entertainment industry. You are given the full text of this week's paid issue.

Write the FREE EDITION: a condensed teaser sent to non-paying prospects. Rules:
- Match the publisher's voice: plain-spoken, direct, a working salesperson's respect for the reader's time. No hype words, no exclamation marks.
- Convey the SHAPE of each signal without the sellable specifics. Never include: company names of buyers, contact names, dollar amounts of specific deals, dates of specific windows, or any named lead. Generic public facts (e.g. state program totals already in the news) are fine.
- For each of 2-4 signals from the issue, write a short paragraph in the pattern: what kind of signal appeared, why it means money is about to move, and a line noting members got the names/timing on Tuesday.
- Open with one sentence framing the week. Close with a single low-pressure line inviting the reader to become a member.
- 150-250 words total. Plain text paragraphs separated by blank lines. No markdown, no headings, no links (the send system adds the button).
- Also write a subject line: specific and curiosity-driving, under 60 characters, no colons-and-hype formulas.

Respond with ONLY valid JSON: {"subject": "...", "bodyText": "..."}`;

router.post("/publisher/draft", async (req, res): Promise<void> => {
  if (!keyOk(req.body?.key)) {
    res.status(401).json({ error: "Invalid key" });
    return;
  }
  const wireText = typeof req.body?.wireText === "string" ? req.body.wireText.trim() : "";
  if (wireText.length < 100) {
    res.status(400).json({ error: "Paste the full issue text (at least a few paragraphs)." });
    return;
  }

  // Lazy import: the Anthropic client throws at import time if its env vars
  // are missing — that must never take down the subscribe/offer endpoints.
  const { anthropic } = await import("@workspace/integrations-anthropic-ai");
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: DRAFT_PROMPT,
    messages: [{ role: "user", content: `THIS WEEK'S PAID ISSUE:\n\n${wireText.slice(0, 60000)}` }],
  });
  const block = message.content.find((b) => b.type === "text");
  const raw = block && block.type === "text" ? block.text : "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    res.status(502).json({ error: "Drafting failed — please try again." });
    return;
  }
  const parsed = PublisherDraftResponse.safeParse(JSON.parse(jsonMatch[0]));
  if (!parsed.success) {
    res.status(502).json({ error: "Drafting failed — please try again." });
    return;
  }
  res.json(parsed.data);
});

function previewHtml(bodyText: string, unsubscribeUrl: string): string {
  const paragraphs = bodyText
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(
      (s) =>
        `<p>${s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`,
    )
    .join("\n");
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f5f2;">
    <div style="max-width:560px;margin:0 auto;padding:32px 24px;font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;font-size:17px;line-height:1.6;background:#ffffff;">
      <p style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;color:#8a8577;text-transform:uppercase;">Hollywood Sales Wire — Free Edition</p>
      ${paragraphs}
      <p style="margin:28px 0;"><a href="${SITE_URL}/order?utm_source=email&amp;utm_medium=weekly-preview&amp;utm_campaign=free-edition" style="background:#1d5c3a;color:#ffffff;padding:12px 24px;text-decoration:none;font-family:Arial,sans-serif;font-size:15px;">Become a Member</a></p>
      <hr style="border:none;border-top:1px solid #e5e2da;margin:32px 0 16px;" />
      <p style="font-size:12px;color:#8a8577;font-family:Arial,sans-serif;">
        Hollywood Sales Wire &middot; You're receiving this because you signed up at hollywoodsaleswire.com.<br />
        <a href="${unsubscribeUrl}" style="color:#8a8577;">Unsubscribe</a> at any time.
      </p>
    </div>
  </body>
</html>`;
}

router.post("/publisher/send", async (req, res): Promise<void> => {
  if (!keyOk(req.body?.key)) {
    res.status(401).json({ error: "Invalid key" });
    return;
  }
  const subject = typeof req.body?.subject === "string" ? req.body.subject.trim() : "";
  const bodyText = typeof req.body?.bodyText === "string" ? req.body.bodyText.trim() : "";
  if (subject.length < 3 || bodyText.length < 50) {
    res.status(400).json({ error: "Subject and body are required." });
    return;
  }

  const recipients = await db
    .select()
    .from(emailSubscribersTable)
    .where(eq(emailSubscribersTable.status, "active"));

  let sent = 0;
  const failures: string[] = [];
  // Resend batch endpoint accepts up to 100 emails per call.
  for (let i = 0; i < recipients.length; i += 100) {
    const chunk = recipients.slice(i, i + 100);
    try {
      await resendRequest("/emails/batch", {
        method: "POST",
        body: chunk.map((r) => ({
          from: FROM_ADDRESS,
          to: [r.email],
          subject,
          html: previewHtml(
            bodyText,
            `${SITE_URL}/api/unsubscribe?token=${r.unsubscribeToken}`,
          ),
        })),
      });
      sent += chunk.length;
    } catch (err) {
      console.error("weekly preview batch failed:", err);
      failures.push(...chunk.map((r) => r.email));
    }
  }

  if (sent === 0 && recipients.length > 0) {
    res.status(502).json({ error: "Sending failed — nothing went out. Please try again." });
    return;
  }
  await db.insert(weeklyPreviewsTable).values({ subject, bodyText, recipientCount: sent });
  const result = PublisherSendResponse.parse({ sent });
  if (failures.length > 0) {
    console.error(`weekly preview: ${failures.length} recipients failed`);
  }
  res.json(result);
});

router.get("/publisher/status", async (req, res): Promise<void> => {
  if (!keyOk(req.query.key)) {
    res.status(401).json({ error: "Invalid key" });
    return;
  }
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(emailSubscribersTable)
    .where(eq(emailSubscribersTable.status, "active"));
  const [last] = await db
    .select()
    .from(weeklyPreviewsTable)
    .orderBy(desc(weeklyPreviewsTable.sentAt))
    .limit(1);
  res.json({
    subscriberCount: count,
    ...(last ? { lastSentAt: last.sentAt.toISOString(), lastSubject: last.subject } : {}),
  });
});

export default router;
