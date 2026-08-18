import { logger } from "./logger";
import { SITE_URL } from "./emailSequence";

/**
 * Typefully integration: push weekly social drafts (LinkedIn + X) into the
 * publisher's Typefully account, auto-scheduled to publish automatically.
 *
 * Schedule:
 * - Monday ~5 pm PT: short highlight post, auto-publishes ~5 min after creation.
 * - Tuesday ~9 am PT: full Weekly Brief with masthead image, scheduled from
 *   Monday when the wire run completes (~now + 15 h).
 * - Wednesday ~8 am PT: short highlight, auto-publishes ~5 min after creation.
 * - Friday ~8 am PT: short highlight, auto-publishes ~5 min after creation.
 *
 * - Entirely optional and best-effort: if TYPEFULLY_API_KEY is missing or any
 *   call fails or hangs, the weekly run and scheduler are unaffected.
 * - Same information boundary as the free Brief: shape of signals only —
 *   no buyer names, no per-deal figures, no dated windows, no methods.
 */

const TYPEFULLY_API = "https://api.typefully.com";

/** Per-request timeout for all Typefully calls. */
const REQUEST_TIMEOUT_MS = 30_000;
/** Hard ceiling for one whole best-effort push (AI rewrite + API calls). */
const OVERALL_TIMEOUT_MS = 120_000;

const VOICE_RULES = `- Voice: plain-spoken, direct, a working salesperson's respect for the reader's time. No hype words, no exclamation marks, no emojis, no hashtag pileups (at most 2 hashtags on LinkedIn, none on X).
- Same information boundary as the Brief: shape of the signals only. Never add buyer company names, contact names, per-deal dollar figures, or dated windows. Never mention research tools, vendors, feeds, or methods.`;

const BRIEF_POSTS_PROMPT = `You are the editor of "Hollywood Sales Wire," a paid weekly sales-intelligence briefing for vendors selling into the entertainment industry. You are given this week's Weekly Brief (the free teaser email already written for warm prospects).

Write TWO social posts from the publisher's personal accounts:

1. "linkedin": the Brief as a LinkedIn post. A first line that earns the "see more" click (under 200 characters, specific and curiosity-driving); short paragraphs of 1-2 sentences with white space between them; 120-200 words; close with one low-pressure line pointing readers to ${SITE_URL} for the full weekly briefing.
2. "x": the same week as a full-length X post (the account has X Premium, so long posts are fine — readers tap "Show more"). Same substance and length as the LinkedIn version, but no hashtags. Make the FIRST sentence the sharpest hook, since only the first ~3 lines show before the fold. One post, no thread. Include ${SITE_URL}.

${VOICE_RULES}

Respond with ONLY valid JSON: {"linkedin": "...", "x": "..."}`;

const HIGHLIGHT_POSTS_PROMPT = (slot: "Wednesday" | "Friday", avoidAngle: string | null) => `You are the editor of "Hollywood Sales Wire," a paid weekly sales-intelligence briefing for vendors selling into the entertainment industry. You are given this week's Weekly Brief (the free teaser already sent to warm prospects).

Write a SHORT ${slot} follow-up for the publisher's personal accounts: pick the SINGLE most interesting signal from the Brief and go one thought deeper on why it matters for vendors — a fresh angle, not a summary of the whole week.${avoidAngle ? `\n\nEarlier this week the publisher already posted about the angle below — pick a DIFFERENT signal or a clearly different angle:\n---\n${avoidAngle.slice(0, 1500)}\n---` : ""}

Write TWO versions:
1. "linkedin": 60-110 words. Strong first line under 150 characters. Short paragraphs. End with one low-pressure line pointing to ${SITE_URL}.
2. "x": the same write-up as a full-length X post (the account has X Premium, so long posts are fine). Same substance as the LinkedIn version, no hashtags, sharpest sentence first (only the first ~3 lines show before the fold). One post, no thread. Include ${SITE_URL}.

${VOICE_RULES}

Respond with ONLY valid JSON: {"linkedin": "...", "x": "..."}`;

interface TypefullySocialSet {
  id: number;
  name: string;
  platforms?: {
    linkedin?: { username?: string } | null;
    x?: { username?: string } | null;
  };
}

export interface PushResult {
  /** Human-readable status line for the publisher's notify email. */
  status: string;
  ok: boolean;
  draftId?: string;
  /** The LinkedIn text pushed (for Friday's avoid-repeat logic). */
  linkedinText?: string;
}

async function typefullyFetch(path: string, init?: RequestInit, outer?: AbortSignal): Promise<unknown> {
  const key = process.env.TYPEFULLY_API_KEY;
  if (!key) throw new Error("TYPEFULLY_API_KEY is not set");
  const perRequest = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const res = await fetch(`${TYPEFULLY_API}${path}`, {
    ...init,
    signal: outer ? AbortSignal.any([perRequest, outer]) : perRequest,
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

/** Find the publisher's social set and which platforms it has connected. */
async function findSocialSet(signal?: AbortSignal): Promise<{ id: number; hasLinkedIn: boolean; hasX: boolean }> {
  const data = (await typefullyFetch("/v2/social-sets?limit=50", undefined, signal)) as { results: TypefullySocialSet[] };
  for (const set of data.results ?? []) {
    const detail = (await typefullyFetch(`/v2/social-sets/${set.id}/`, undefined, signal)) as TypefullySocialSet;
    const hasLinkedIn = Boolean(detail.platforms?.linkedin);
    const hasX = Boolean(detail.platforms?.x);
    if (hasLinkedIn || hasX) return { id: set.id, hasLinkedIn, hasX };
  }
  throw new Error("No Typefully social set has LinkedIn or X connected");
}

async function draftPosts(systemPrompt: string, briefBody: string, signal?: AbortSignal): Promise<{ linkedin: string; x: string }> {
  const { anthropic } = await import("@workspace/integrations-anthropic-ai");
  const message = await anthropic.messages.create(
    {
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: `THIS WEEK'S BRIEF:\n\n${briefBody.slice(0, 20000)}` }],
    },
    { timeout: 90_000, maxRetries: 1, signal },
  );
  const block = message.content.find((b) => b.type === "text");
  const raw = (block && block.type === "text" ? block.text : "").trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("post rewrite returned no JSON");
  const parsed = JSON.parse(jsonMatch[0]) as { linkedin?: unknown; x?: unknown };
  const linkedin = typeof parsed.linkedin === "string" ? parsed.linkedin.trim() : "";
  let x = typeof parsed.x === "string" ? parsed.x.trim() : "";
  if (linkedin.length < 60) throw new Error("LinkedIn rewrite came back too short to be usable");
  // Full-length X posts are allowed (X Premium). If the X version is missing
  // or unusably short, fall back to the LinkedIn text rather than dropping X.
  if (x.length < 60) x = linkedin;
  return { linkedin, x };
}

async function createDraft(
  title: string,
  posts: { linkedin: string; x: string },
  opts: { planAt?: string; mastheadUrl?: string; signal?: AbortSignal },
): Promise<{ draftId?: string }> {
  const { planAt, mastheadUrl, signal } = opts;
  const set = await findSocialSet(signal);
  const platforms: Record<string, unknown> = {};
  const mediaArr = mastheadUrl ? [{ url: mastheadUrl }] : undefined;
  if (set.hasLinkedIn)
    platforms.linkedin = {
      enabled: true,
      posts: [{ text: posts.linkedin, ...(mediaArr ? { media_urls: [mastheadUrl] } : {}) }],
    };
  if (set.hasX && posts.x.length > 0)
    platforms.x = {
      enabled: true,
      posts: [{ text: posts.x, ...(mediaArr ? { media_urls: [mastheadUrl] } : {}) }],
    };
  if (Object.keys(platforms).length === 0) throw new Error("No Typefully social set has LinkedIn or X connected");
  const payload: Record<string, unknown> = { draft_title: title, platforms };
  if (planAt) payload.plan_at = planAt;
  const draft = (await typefullyFetch(
    `/v2/social-sets/${set.id}/drafts`,
    { method: "POST", body: JSON.stringify(payload) },
    signal,
  )) as { id?: number | string };
  return { draftId: draft.id === undefined ? undefined : String(draft.id) };
}

/** ISO timestamp approximately N hours from now — used to schedule posts. */
function hoursFromNow(h: number): string {
  return new Date(Date.now() + h * 60 * 60 * 1000).toISOString();
}

/** ISO timestamp approximately N minutes from now. */
function minutesFromNow(m: number): string {
  return new Date(Date.now() + m * 60 * 1000).toISOString();
}

/**
 * Run `work` with a real cancellation deadline: the signal is propagated into
 * every network call (Anthropic + Typefully), so when the ceiling passes the
 * underlying requests are aborted — no orphaned work can create a draft after
 * the caller has already recorded a failure.
 */
async function withOverallDeadline<T>(work: (signal: AbortSignal) => Promise<T>): Promise<T> {
  return work(AbortSignal.timeout(OVERALL_TIMEOUT_MS));
}

/** Map any error to a short, safe, stable category string. */
function summarizeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : "";
  if (
    msg.includes("timed out") ||
    (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError"))
  )
    return "timed out";
  if (msg.startsWith("Typefully ")) return msg; // our own status-only message
  if (msg.includes("TYPEFULLY_API_KEY")) return "API key missing";
  if (msg.includes("No Typefully social set")) return "no LinkedIn/X account connected in Typefully";
  if (msg.includes("too short") || msg.includes("no JSON")) return "draft rewrite unusable";
  return "unexpected error (see server logs)";
}

/**
 * Tuesday brief: push the full Weekly Brief into Typefully, scheduled ~15 h
 * from now (fires Monday ~5 pm PT → publishes Tuesday ~8–9 am PT), with the
 * HSW masthead image attached. Returns a status line for the pre-flight email.
 * Never throws.
 */
export async function pushBriefToTypefully(
  weekKey: string,
  briefBody: string,
  mastheadUrl: string,
): Promise<PushResult> {
  if (!process.env.TYPEFULLY_API_KEY) {
    return { ok: false, status: "Social drafts: skipped (Typefully not configured in this environment)." };
  }
  try {
    return await withOverallDeadline(
      async (signal): Promise<PushResult> => {
        const posts = await draftPosts(BRIEF_POSTS_PROMPT, briefBody, signal);
        const planAt = hoursFromNow(15); // Monday 5 pm → Tuesday ~8 am PT
        const { draftId } = await createDraft(
          `HSW Weekly Brief — week of ${weekKey}`,
          posts,
          { planAt, mastheadUrl, signal },
        );
        logger.info({ weekKey, draftId, planAt }, "typefully: weekly Brief scheduled for Tuesday");
        return {
          ok: true,
          draftId,
          linkedinText: posts.linkedin,
          status: `Social drafts: the Tuesday Brief is scheduled in Typefully (LinkedIn${posts.x ? " + X" : ""}) and will auto-post ~9 am PT.`,
        };
      },
    );
  } catch (err) {
    const reason = summarizeError(err);
    logger.warn({ weekKey, reason }, "typefully: weekly Brief draft push failed (run unaffected)");
    return {
      ok: false,
      status: `Social drafts: could not be pushed to Typefully this week (${reason}). The Wire and Brief are unaffected — you can still post manually.`,
    };
  }
}

/**
 * Monday/Wednesday/Friday: push a short highlight draft (one signal, fresh
 * angle) into Typefully, scheduled ~5 minutes from now so it auto-publishes
 * immediately. `avoidAngle` prevents Friday from repeating Wednesday's angle.
 * Never throws.
 */
export async function pushHighlightToTypefully(
  slot: "Monday" | "Wednesday" | "Friday",
  weekKey: string,
  briefBody: string,
  avoidAngle: string | null,
): Promise<PushResult> {
  if (!process.env.TYPEFULLY_API_KEY) {
    return { ok: false, status: "skipped (Typefully not configured)" };
  }
  try {
    return await withOverallDeadline(
      async (signal): Promise<PushResult> => {
        const posts = await draftPosts(HIGHLIGHT_POSTS_PROMPT(slot, avoidAngle), briefBody, signal);
        const planAt = minutesFromNow(5); // auto-publish ~5 min after creation
        const { draftId } = await createDraft(
          `HSW ${slot} highlight — week of ${weekKey}`,
          posts,
          { planAt, signal },
        );
        logger.info({ weekKey, slot, draftId, planAt }, "typefully: highlight scheduled");
        return { ok: true, draftId, linkedinText: posts.linkedin, status: "pushed" };
      },
    );
  } catch (err) {
    const reason = summarizeError(err);
    logger.warn({ weekKey, slot, reason }, "typefully: highlight draft push failed");
    return { ok: false, status: reason };
  }
}
