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
/** Leave enough of the overall push budget to create a text-only fallback. */
const MEDIA_UPLOAD_TIMEOUT_MS = 15_000;
/** Hard ceiling for one whole best-effort push (AI rewrite + API calls). */
const OVERALL_TIMEOUT_MS = 120_000;

const VOICE_RULES = `- Voice: plain-spoken, direct, a working salesperson's respect for the reader's time. No hype words, no exclamation marks, no emojis, no hashtag pileups (at most 2 hashtags on LinkedIn, none on X).
- Same information boundary as the Brief: shape of the signals only. Never add buyer company names, contact names, per-deal dollar figures, or dated windows. Never mention research tools, vendors, feeds, or methods.`;

const BRIEF_POSTS_PROMPT = `You are the editor of "Hollywood Sales Wire," a paid weekly sales-intelligence briefing for vendors selling into the entertainment industry. You are given this week's Weekly Brief (the free teaser email already written for warm prospects).

Write TWO social posts from the publisher's personal accounts:

1. "linkedin": the Brief as a LinkedIn post. A first line that earns the "see more" click (under 200 characters, specific and curiosity-driving); short paragraphs of 1-2 sentences with white space between them; 120-200 words; close with one low-pressure line pointing readers to ${SITE_URL} for the full weekly briefing.
2. "x": the same week as a full-length X post (the account has X Premium, so long posts are fine — readers tap "Show more"). Same substance and length as the LinkedIn version, but no hashtags. Make the FIRST sentence the sharpest hook, since only the first ~3 lines show before the fold. One post, no thread. Do NOT include a URL — Typefully cannot auto-publish X posts containing URLs. Close with a natural "full briefing is linked in my profile" line instead.

${VOICE_RULES}

Respond with ONLY valid JSON: {"linkedin": "...", "x": "..."}`;

const HIGHLIGHT_POSTS_PROMPT = (slot: "Monday" | "Wednesday" | "Friday", avoidAngle: string | null) => `You are the editor of "Hollywood Sales Wire," a paid weekly sales-intelligence briefing for vendors selling into the entertainment industry. You are given this week's Weekly Brief (the free teaser already sent to warm prospects).

Write a SHORT ${slot} follow-up for the publisher's personal accounts: pick the SINGLE most interesting signal from the Brief and go one thought deeper on why it matters for vendors — a fresh angle, not a summary of the whole week.${avoidAngle ? `\n\nEarlier this week the publisher already posted about the angle below — pick a DIFFERENT signal or a clearly different angle:\n---\n${avoidAngle.slice(0, 1500)}\n---` : ""}

Write TWO versions:
1. "linkedin": 60-110 words. Strong first line under 150 characters. Short paragraphs. End with one low-pressure line pointing to ${SITE_URL}.
2. "x": the same write-up as a full-length X post (the account has X Premium, so long posts are fine). Same substance as the LinkedIn version, no hashtags, sharpest sentence first (only the first ~3 lines show before the fold). One post, no thread. Do NOT include a URL — Typefully cannot auto-publish X posts containing URLs. Close with a natural "full briefing is linked in my profile" line instead.

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
  /** The provider state confirmed immediately after creation. */
  publishState?: "scheduled" | "publishing" | "published";
}

interface TypefullyDraft {
  id?: number | string;
  status?: string;
  publish_state?: string | null;
  scheduled_date?: string | null;
  published_at?: string | null;
  platforms?: {
    x?: {
      enabled?: boolean;
      posts?: Array<{ text?: string; media_ids?: Array<string | number> }>;
    } | null;
  };
}

export interface TypefullyDraftInspection {
  status: string;
  publishState: string | null;
  scheduledDate: string | null;
  publishedAt: string | null;
}

export function isTypefullyNotFound(err: unknown): boolean {
  return err instanceof Error && err.message.includes("HTTP 404");
}

export function normalizeTypefullyDraftStatus(inspection: TypefullyDraftInspection): string {
  if (inspection.publishedAt || inspection.status === "published") return "published";
  if (inspection.publishState === "in_progress" || inspection.status === "publishing") return "publishing";
  return inspection.status;
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

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    if (!signal) return;
    if (signal.aborted) {
      clearTimeout(timer);
      reject(signal.reason ?? new Error("Request aborted"));
      return;
    }
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason ?? new Error("Request aborted"));
      },
      { once: true },
    );
  });
}

/**
 * Typefully's media API is a three-step flow: request a presigned URL, PUT the
 * bytes to that URL, then wait until Typefully has processed the upload.
 * The presigned PUT must not receive our JSON/API headers.
 */
async function uploadMasthead(socialSetId: number, mastheadUrl: string, signal?: AbortSignal): Promise<string> {
  const mediaSignal = signal
    ? AbortSignal.any([AbortSignal.timeout(MEDIA_UPLOAD_TIMEOUT_MS), signal])
    : AbortSignal.timeout(MEDIA_UPLOAD_TIMEOUT_MS);
  const mastheadResponse = await fetch(mastheadUrl, {
    signal: mediaSignal,
  });
  if (!mastheadResponse.ok) throw new Error(`masthead source HTTP ${mastheadResponse.status}`);
  const bytes = await mastheadResponse.arrayBuffer();
  if (bytes.byteLength === 0) throw new Error("masthead source was empty");

  const upload = (await typefullyFetch(
    `/v2/social-sets/${socialSetId}/media/upload`,
    {
      method: "POST",
      body: JSON.stringify({ file_name: "hsw-masthead.png" }),
    },
    mediaSignal,
  )) as { media_id?: string | number; upload_url?: string };
  if (upload.media_id === undefined || !upload.upload_url) {
    throw new Error("Typefully media upload URL was incomplete");
  }

  const putResponse = await fetch(upload.upload_url, {
    method: "PUT",
    body: bytes,
    signal: mediaSignal,
  });
  if (!putResponse.ok) throw new Error(`Typefully media upload HTTP ${putResponse.status}`);

  const mediaId = String(upload.media_id);
  for (let attempt = 0; attempt < 30; attempt++) {
    const media = (await typefullyFetch(
      `/v2/social-sets/${socialSetId}/media/${encodeURIComponent(mediaId)}`,
      undefined,
      mediaSignal,
    )) as { status?: string };
    if (media.status === "ready") return mediaId;
    if (media.status === "failed") throw new Error("Typefully media processing failed");
    await sleep(1000, mediaSignal);
  }
  throw new Error("Typefully media processing timed out");
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
  // Typefully enforces X's automation policy by rejecting direct publishing
  // whenever the X post contains a URL. Keep LinkedIn's clickable link, but
  // defensively strip URLs from X even if the model ignores the prompt.
  x = sanitizeXTextForPublishing(x);
  if (x.length < 60) throw new Error("X rewrite came back too short after removing URLs");
  return { linkedin, x };
}

function sanitizeXTextForPublishing(text: string): string {
  return text
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, "")
    .replace(/\bwww\.\S+/gi, "")
    .replace(/\b\S+@\S+\.\S+/gi, "")
    .replace(/\b(?:[a-z0-9-]+\.)+[a-z]{2,63}(?:\/\S*)?/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

async function createDraft(
  socialSet: { id: number; hasLinkedIn: boolean; hasX: boolean },
  title: string,
  posts: { linkedin: string; x: string },
  opts: { publishAt?: string; mediaId?: string; signal?: AbortSignal },
): Promise<{ draftId: string; inspection: TypefullyDraftInspection }> {
  const { publishAt, mediaId, signal } = opts;
  const platforms: Record<string, unknown> = {};
  const mediaIds = mediaId ? [mediaId] : undefined;
  if (socialSet.hasLinkedIn)
    platforms.linkedin = {
      enabled: true,
      posts: [{ text: posts.linkedin, ...(mediaIds ? { media_ids: mediaIds } : {}) }],
    };
  if (socialSet.hasX && posts.x.length > 0)
    platforms.x = {
      enabled: true,
      posts: [{ text: posts.x, ...(mediaIds ? { media_ids: mediaIds } : {}) }],
    };
  if (Object.keys(platforms).length === 0) throw new Error("No Typefully social set has LinkedIn or X connected");
  const payload: Record<string, unknown> = { draft_title: title, platforms };
  if (publishAt) payload.publish_at = publishAt;
  const draft = (await typefullyFetch(
    `/v2/social-sets/${socialSet.id}/drafts`,
    { method: "POST", body: JSON.stringify(payload) },
    signal,
  )) as TypefullyDraft;
  if (draft.id === undefined) throw new Error("Typefully create response did not include a draft ID");

  const draftId = String(draft.id);
  const inspection: TypefullyDraftInspection = {
    status: draft.status ?? "unknown",
    publishState: draft.publish_state ?? null,
    scheduledDate: draft.scheduled_date ?? null,
    publishedAt: draft.published_at ?? null,
  };
  const normalizedStatus = normalizeTypefullyDraftStatus(inspection);
  if (!["scheduled", "publishing", "published"].includes(normalizedStatus)) {
    throw new Error(`Typefully draft was created with non-publishing status: ${normalizedStatus}`);
  }
  return { draftId, inspection };
}

/** ISO timestamp approximately N hours from now — used to schedule posts. */
function hoursFromNow(h: number): string {
  return new Date(Date.now() + h * 60 * 60 * 1000).toISOString();
}

/** ISO timestamp approximately N minutes from now. */
function minutesFromNow(m: number): string {
  return new Date(Date.now() + m * 60 * 1000).toISOString();
}

async function getDraftDetail(socialSetId: number, draftId: string, signal?: AbortSignal): Promise<TypefullyDraft> {
  return (await typefullyFetch(
    `/v2/social-sets/${socialSetId}/drafts/${encodeURIComponent(draftId)}`,
    undefined,
    signal,
  )) as TypefullyDraft;
}

async function getDraft(socialSetId: number, draftId: string, signal?: AbortSignal): Promise<TypefullyDraftInspection> {
  const draft = await getDraftDetail(socialSetId, draftId, signal);
  return {
    status: draft.status ?? "unknown",
    publishState: draft.publish_state ?? null,
    scheduledDate: draft.scheduled_date ?? null,
    publishedAt: draft.published_at ?? null,
  };
}

/**
 * Inspect a draft by ID. The social set is discovered rather than persisted so
 * the database only needs to retain Typefully's draft ID.
 */
export async function inspectTypefullyDraft(draftId: string, signal?: AbortSignal): Promise<TypefullyDraftInspection> {
  const set = await findSocialSet(signal);
  return getDraft(set.id, draftId, signal);
}

/**
 * Convert an old inert `plan_at` draft into a real Typefully schedule. If its
 * planned time has already passed, publish it immediately instead.
 */
export async function confirmPlannedTypefullyDraft(
  draftId: string,
  scheduledDate: string | null,
  signal?: AbortSignal,
): Promise<TypefullyDraftInspection> {
  const set = await findSocialSet(signal);
  const existing = await getDraftDetail(set.id, draftId, signal);
  const publishAt = scheduledDate && Date.parse(scheduledDate) > Date.now() ? scheduledDate : "now";
  const payload: Record<string, unknown> = { publish_at: publishAt };
  const x = existing.platforms?.x;
  if (x?.enabled && x.posts?.length) {
    const posts = x.posts.map((post) => ({
      text: sanitizeXTextForPublishing(post.text ?? ""),
      media_ids: post.media_ids ?? [],
    }));
    if (posts.some((post) => post.text.length < 1)) {
      throw new Error("Typefully X post became empty after removing URLs");
    }
    payload.platforms = { x: { enabled: true, posts } };
  }
  await typefullyFetch(
    `/v2/social-sets/${set.id}/drafts/${encodeURIComponent(draftId)}`,
    { method: "PATCH", body: JSON.stringify(payload) },
    signal,
  );
  return getDraft(set.id, draftId, signal);
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

function summarizeMediaError(err: unknown): string {
  const msg = err instanceof Error ? err.message : "";
  if (
    msg.includes("timed out") ||
    (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError"))
  )
    return "upload timed out";
  const http = msg.match(/HTTP \d{3}/)?.[0];
  if (http) return http;
  return "upload unavailable";
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
        const set = await findSocialSet(signal);
        let mediaId: string | undefined;
        let mediaFailure: string | undefined;
        try {
          mediaId = await uploadMasthead(set.id, mastheadUrl, signal);
        } catch (err) {
          mediaFailure = summarizeMediaError(err);
          logger.warn({ weekKey, reason: mediaFailure }, "typefully: masthead upload failed — using text-only Brief");
        }
        const publishAt = hoursFromNow(15); // Monday 5 pm → Tuesday ~8 am PT
        const { draftId, inspection } = await createDraft(
          set,
          `HSW Weekly Brief — week of ${weekKey}`,
          posts,
          { publishAt, mediaId, signal },
        );
        logger.info(
          { weekKey, draftId, publishAt, mediaAttached: Boolean(mediaId) },
          "typefully: weekly Brief scheduled",
        );
        return {
          ok: true,
          draftId,
          linkedinText: posts.linkedin,
          publishState: normalizeTypefullyDraftStatus(inspection) as PushResult["publishState"],
          status: mediaFailure
            ? `Social drafts: the Tuesday Brief is scheduled text-only because the masthead could not be uploaded (${mediaFailure}).`
            : `Social drafts: the Tuesday Brief is scheduled in Typefully with its masthead (LinkedIn${posts.x ? " + X" : ""}) and will auto-post ~9 am PT.`,
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
        const set = await findSocialSet(signal);
        const publishAt = minutesFromNow(5); // auto-publish ~5 min after creation
        const { draftId, inspection } = await createDraft(
          set,
          `HSW ${slot} highlight — week of ${weekKey}`,
          posts,
          { publishAt, signal },
        );
        logger.info({ weekKey, slot, draftId, publishAt }, "typefully: highlight scheduled");
        return {
          ok: true,
          draftId,
          linkedinText: posts.linkedin,
          publishState: normalizeTypefullyDraftStatus(inspection) as PushResult["publishState"],
          status: `Social drafts: the ${slot} highlight is scheduled to auto-publish in about five minutes.`,
        };
      },
    );
  } catch (err) {
    const reason = summarizeError(err);
    logger.warn({ weekKey, slot, reason }, "typefully: highlight draft push failed");
    return { ok: false, status: reason };
  }
}
