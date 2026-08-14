import { logger } from "./logger";
import { SITE_URL } from "./emailSequence";

/**
 * Typefully integration: push the weekly Brief into Typefully as an
 * UNSCHEDULED LinkedIn draft for the publisher to review, edit, and post.
 *
 * Safety rails (deliberate):
 * - Drafts only — publish_at is never set. Nothing ever auto-publishes.
 * - Entirely optional: if TYPEFULLY_API_KEY is missing or any call fails,
 *   the weekly run is unaffected (callers treat this as best-effort).
 */

const TYPEFULLY_API = "https://api.typefully.com";

const LINKEDIN_BRIEF_PROMPT = `You are the editor of "Hollywood Sales Wire," a paid weekly sales-intelligence briefing for vendors selling into the entertainment industry. You are given this week's Weekly Brief (the free teaser email already written for warm prospects).

Rewrite it as a single LinkedIn post from the publisher's personal account. Rules:
- Same information boundary as the Brief: shape of the signals only. Never add buyer company names, contact names, per-deal dollar figures, or dated windows. Never mention research tools, vendors, feeds, or methods.
- Voice: plain-spoken, direct, a working salesperson's respect for the reader's time. No hype words, no exclamation marks, no emojis, no hashtag pileups (at most 2 hashtags at the end, or none).
- Structure for LinkedIn: a first line that earns the "see more" click (under 200 characters, specific and curiosity-driving); short paragraphs of 1-2 sentences; white space between them.
- Close with one low-pressure line pointing readers to ${SITE_URL} for the full weekly briefing.
- 120-200 words. Plain text only.

Respond with ONLY the post text.`;

interface TypefullySocialSet {
  id: number;
  name: string;
  platforms?: { linkedin?: { username?: string } | null };
}

/** Per-request timeout for all Typefully calls. */
const REQUEST_TIMEOUT_MS = 30_000;
/** Hard ceiling for the whole best-effort push (AI rewrite + API calls). */
const OVERALL_TIMEOUT_MS = 120_000;

async function typefullyFetch(path: string, init?: RequestInit): Promise<unknown> {
  const key = process.env.TYPEFULLY_API_KEY;
  if (!key) throw new Error("TYPEFULLY_API_KEY is not set");
  const res = await fetch(`${TYPEFULLY_API}${path}`, {
    ...init,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    // Deliberately status-only: provider response bodies must not reach logs
    // or the publisher email.
    throw new Error(`Typefully ${init?.method ?? "GET"} ${path} → HTTP ${res.status}`);
  }
  return res.json();
}

/** Find the publisher's social set that has LinkedIn connected. */
async function findLinkedInSocialSetId(): Promise<number> {
  const data = (await typefullyFetch("/v2/social-sets?limit=50")) as { results: TypefullySocialSet[] };
  for (const set of data.results ?? []) {
    const detail = (await typefullyFetch(`/v2/social-sets/${set.id}/`)) as TypefullySocialSet;
    if (detail.platforms?.linkedin) return set.id;
  }
  throw new Error("No Typefully social set has LinkedIn connected");
}

/**
 * Draft a LinkedIn version of the weekly Brief and push it into Typefully as
 * an unscheduled draft. Returns a short human-readable status line for the
 * publisher's pre-flight email. Never throws.
 */
export async function pushBriefToTypefully(weekKey: string, briefBody: string): Promise<string> {
  if (!process.env.TYPEFULLY_API_KEY) {
    return "LinkedIn draft: skipped (Typefully not configured in this environment).";
  }
  try {
    return await Promise.race([
      doPush(weekKey, briefBody),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("typefully push timed out")), OVERALL_TIMEOUT_MS).unref(),
      ),
    ]);
  } catch (err) {
    // Sanitized: log/report only our own stable message, never raw provider
    // errors or response content.
    const reason = summarizeError(err);
    logger.warn({ weekKey, reason }, "typefully: LinkedIn Brief draft push failed (run unaffected)");
    return `LinkedIn draft: could not be pushed to Typefully this week (${reason}). The Wire and Brief are unaffected — you can still post manually.`;
  }
}

async function doPush(weekKey: string, briefBody: string): Promise<string> {
  const { anthropic } = await import("@workspace/integrations-anthropic-ai");
  const message = await anthropic.messages.create(
    {
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: LINKEDIN_BRIEF_PROMPT,
      messages: [{ role: "user", content: `THIS WEEK'S BRIEF:\n\n${briefBody.slice(0, 20000)}` }],
    },
    { timeout: 90_000, maxRetries: 1 },
  );
  const block = message.content.find((b) => b.type === "text");
  const postText = (block && block.type === "text" ? block.text : "").trim();
  if (postText.length < 100) throw new Error("LinkedIn rewrite came back too short to be usable");

  const socialSetId = await findLinkedInSocialSetId();
  const draft = (await typefullyFetch(`/v2/social-sets/${socialSetId}/drafts`, {
    method: "POST",
    body: JSON.stringify({
      draft_title: `HSW Weekly Brief — week of ${weekKey}`,
      platforms: {
        linkedin: { enabled: true, posts: [{ text: postText }] },
      },
      // No publish_at / plan_at: stays an unscheduled draft until she acts.
    }),
  })) as { id?: number | string };
  logger.info({ weekKey, draftId: draft.id }, "typefully: LinkedIn Brief draft pushed");
  return "LinkedIn draft: waiting in Typefully (unscheduled) — edit and post it whenever you like.";
}

/** Map any error to a short, safe, stable category string. */
function summarizeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : "";
  if (msg.includes("timed out") || (err instanceof Error && err.name === "TimeoutError")) return "timed out";
  if (msg.startsWith("Typefully ")) return msg; // our own status-only message
  if (msg.includes("TYPEFULLY_API_KEY")) return "API key missing";
  if (msg.includes("No Typefully social set")) return "no LinkedIn account connected in Typefully";
  if (msg.includes("too short")) return "draft rewrite unusable";
  return "unexpected error (see server logs)";
}
