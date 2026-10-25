import { desc, eq, and, ne, sql } from "drizzle-orm";
import { db, wireRunsTable, researchPagesTable, socialDraftsTable } from "@workspace/db";
import { skimRead, skimReadJs, skimFilmIncentives, skimStudioJobs, skimEntityFormations } from "./skim";
import { draftFreeEdition } from "./freeEdition";
import { normalizeWireDateline, wirePublicationDate } from "./wireDateline";
import { pushBriefToTypefully } from "./typefully";
import { claimSocialDraft } from "./socialDrafts";
import { resendRequest } from "./resend";
import { FROM_ADDRESS, SITE_URL } from "./emailSequence";
import { logger } from "./logger";
import {
  collectCreatorJobSignals,
  formatCreatorJobSignals,
  loadCreatorJobTrend,
  recordCreatorJobSnapshot,
} from "./creatorJobs";
import {
  recordProjectSignal,
  pruneExpiredProjectSignals,
  listTrackedProjectStages,
  formatProjectStages,
  looksLikeProductionEntity,
} from "./productionStage";
import {
  getPendingIndustryVoices,
  markIndustryVoicesUsed,
  formatIndustryVoicesForPrompt,
} from "./industryVoices";

const NOTIFY_EMAIL = "hello@hollywoodsaleswire.com";

/** The weekly research beat. URLs verified working with Skim July 2026. */
export const RESEARCH_BEAT: { url: string; label: string }[] = [
  {
    url: "https://film.ca.gov/film-and-television-tax-credit-program-approved-projects-list/",
    label: "California Film Commission — approved projects (all award rounds)",
  },
  {
    // California SOS directed the publisher to BizFile after declining a
    // records request. Its official portal/help materials describe Business
    // Entity bulk orders and free weekly data unloads. Keep these access pages
    // in the beat so exploration can discover and test the current download
    // route without assuming a CALICO publication account is the only option.
    url: "https://www.sos.ca.gov/business-programs/bizfile",
    label: "California SOS — BizFile business-entity data access (research source; not a lead)",
  },
  {
    url: "https://www.sos.ca.gov/administration/public-records-act-requests/business-entity-records",
    label: "California SOS — official business-entity records access routes (research source; not a lead)",
  },
  {
    url: "https://www.esd.ny.gov/esd-media-center/reports/film-tax-credit-2025-quarterly-reports",
    label: "New York ESD — film tax credit quarterly reports index",
  },
  { url: "https://deadline.com/", label: "Deadline — front page" },
  { url: "https://variety.com/v/film/", label: "Variety — film news" },
  { url: "https://www.hollywoodreporter.com/business/", label: "The Hollywood Reporter — business" },
  { url: "https://nmfilm.com/", label: "New Mexico Film Office" },
  {
    url: "https://gov.texas.gov/film/page/tmiiip",
    label: "Texas TMIIIP incentive program",
  },
  {
    // georgia.org (the official state film office site) bot-blocks all reads,
    // so we use Georgia Entertainment's news page — it covers Georgia film
    // office announcements, direct-spend updates, and production news.
    url: "https://www.georgiaentertainment.com/news/",
    label: "Georgia Entertainment — Georgia film/production news",
  },
  {
    // Added Sept 18, 2026 at Karilyn's request — Hollywood production is
    // actively migrating to states competing for it on incentives and cost;
    // Tennessee is the most active mover right now (Paramount-Skydance
    // relocation reporting cites it directly). Track its incentive program
    // and announcements the same way TX/GA/NM already are.
    url: "https://www.tnentertainment.com/film/incentives",
    label: "Tennessee Entertainment Commission — production incentives",
  },
  {
    // Added Sept 18, 2026 — additional states actively courting production
    // away from California, chosen for active momentum (new/expanding
    // incentive programs or reported production relocation), not just any
    // state with a film office.
    url: "https://www.okfilmmusic.org/",
    label: "Oklahoma Film + Music Office — incentives and production news",
  },
  {
    // Netflix has been reported shifting production toward New Jersey;
    // NJ's 30-35% credit is among the most aggressive in the country.
    url: "https://www.njeda.gov/film",
    label: "New Jersey Economic Development Authority — Film & Digital Media Tax Credit",
  },
  {
    url: "https://www.louisianaentertainment.gov/film/motion-picture-production-program",
    label: "Louisiana Entertainment — Motion Picture Production Program",
  },
  {
    // Nevada passed AB 238 in 2025, a major incentive expansion aimed
    // squarely at pulling production (and studio construction) from CA.
    url: "https://film.nv.gov/",
    label: "Nevada Film Office — permits, locations, and tax incentives",
  },
  {
    url: "https://dceo.illinois.gov/whyillinois/film/filmtaxcredit.html",
    label: "Illinois Dept. of Commerce — Film Production Tax Credit",
  },
];

const MAX_EXPLORE_URLS = 8;
const PAGE_CHARS_IN_PROMPT = 14000;
const PREV_PAGE_CHARS = 4000;

const EXPLORE_PROMPT = `You are the research lead for "Hollywood Sales Wire," a paid weekly sales-intelligence briefing for vendors selling into the entertainment industry (cameras, stages, software, localization, post, payroll, insurance).

You are given this week's fetched source pages (markdown, with URLs). Propose up to ${MAX_EXPLORE_URLS} ADDITIONAL absolute URLs worth fetching right now to turn these signals into named, dated, sellable leads. Rules:
- CALIFORNIA ENTITY-FORMATION PRIORITY: make a special effort to follow official California SOS/BizFile links that could expose free weekly Business Entity data unloads, bulk-order downloads, formation/registration records, initial filing dates, or stable public query/download endpoints. California SOS directed the publisher to BizFile after declining a records request, and its official help materials state that weekly Business Entity data unloads are free. Test that route before assuming a CALICO publication account is required.
- A California entity source is usable for the recurring weekly beat only if it is lawful, repeatably accessible, identifies newly formed entities for a bounded recent date range, and includes an initial filing/formation date plus a stable entity identifier or official detail/document URL. Prefer official state or local government data. A public third-party index may be used only to discover candidates that can be verified against an official record.
- Reject agent/registered-agent exports, static master lists with no formation date, pages requiring manual one-name-at-a-time guessing, and sources that cannot distinguish newly formed entities from later amendments or foreign registrations. The prior BizFile Agents export is specifically unsuitable.
- If BizFile's weekly unload requires a free account or manual download, still follow any public documentation or sample/schema links that establish the file contents and cadence; propose only public fetchable URLs here, and do not invent a download URL.
- Treat BizFile access/help pages as research instructions, never as lead items for the Wire. Only actual recent entity records that pass the above checks can become leads.
- Prefer links that actually appear in the provided pages (award-round PDFs, press releases, quarterly report PDFs, named-production announcements).
- Prefer primary sources over coverage of them. State film offices, official press pages, and PDFs read best.
- Avoid: paywalled pages, login walls, search pages, JavaScript app pages (job-board searches rarely work), and anything already provided.
- Public sources only. Companies and roles, never personal data about individuals.

Respond with ONLY a valid JSON array of URL strings, e.g. ["https://...", "https://..."]. Empty array if nothing is worth a read.`;

const WIRE_PROMPT = `You are the editor and lead researcher of "Hollywood Sales Wire," a paid weekly sales-intelligence briefing ($1,150/year individual; $2,300/year Team of up to five seats) for vendors selling into the entertainment industry. Subscribers are salespeople; they pay for names, timing, and receipts — not commentary.

You are given (1) this week's fetched source pages, each with its URL and fetch date, and (2) excerpts of LAST week's pages for the same sources so you can tell what is NEW.

Write this week's full Tuesday Wire draft in markdown. Non-negotiable rules:
- ONLY claims traceable to the provided pages. If it is not in the pages, it does not exist. Never invent names, numbers, dates, or contacts.
- Every item ends with its receipt line: "Source: <public URL or plain-language description>". Never include fetch dates in receipt lines. Cite only PUBLIC primary sources a reader can open in a browser (official registry pages, state film office pages, court filings, press pages). NEVER cite internal research-feed URLs (anything on skim402.com) — readers cannot open them. When a claim comes from a structured research feed, use that feed's CITE AS line (provided with the source) as the receipt instead of a URL. A claim supported by only one source gets the tag **[SINGLE SOURCE — VERIFY]** at the start of its receipt line.
- Never reveal the publication's research tooling, vendors, or search parameters (no tool names, no query terms, no feed names). Describe what was reviewed in plain words; the reader should see the receipt, not the method.
- Numbers that are a state's own promotional figure are labeled as such.
- CLAIM DISCIPLINE — signals are signals, never guaranteed open budgets. Specifically: a job posting is never described as "the production is buying this week" unless a page explicitly supports it; an incentive-award listing is never described as "spending has started" unless a page says production is underway; a new entity formation is never described as an active production without corroboration — call it what it is (a newly formed company, an early-stage lead). Honesty beats completeness: ship fewer verified items rather than more shaky ones.
- Lead with what is NEW this week versus last week's pages. Diff against last week BEFORE calling anything "new" — if the same production/company/filing appeared last week, either skip it or say "(carried from last week: <what changed>)"; never re-present a repeat as new. If a source shows nothing new, skip it — no filler.
- When the evidence is uncertain, say so in the item ("unconfirmed", "single filing, no corroboration") — never smooth uncertainty away in confident prose.
- Structure:
  (a) A two-sentence dateline opener — the week's money picture in plain English.
  (b) A "This Issue at a Glance" section: 4–6 tight bullet points, one per signal item, each starting with a relevant emoji and naming the key action (e.g. "🏴󠁧󠁢󠁥󠁮󠁧󠁬󠁩󠁿 Three UK production companies incorporated — *Ticket to Ride* film entity is the named lead").
  (c) 4–8 numbered signal items in this ORDER — strictly observed every issue:
      TIER 1 (always first): California exclusives — items that are BOTH about California AND sourced from HSW's own primary research or proprietary data. This includes: HSW's weekly studio job-posting counts (the major studios are California companies), California Film Commission approved-project data pulled directly from film.ca.gov (not from trade coverage of the same data), and any other California-specific item whose source is an official state body or HSW's own tracking. Label these *(HSW exclusive — California, [source type])* in the header.
      TIER 2: Non-California exclusives — items sourced from primary registries or HSW's own research that are not California-specific (e.g. UK Companies House entity formations, other state registries). Label *(HSW exclusive — [source type])*.
      TIER 3: California items sourced from official primary sources (state film offices, governor press releases) but also covered by trades.
      TIER 4: All other items, including any items sourced primarily from trade publications (Deadline, Variety, THR). These are valid but always appear last.
  (d) Each numbered item uses bold markdown for the number: **1.** **2.** etc. — not ### heading syntax.
  (e) Each item: WHO (named production/company), WHAT HAPPENED (award, filing, report, announcement — with figures), WHY MONEY MOVES (what they now must buy and roughly when the window is), WHO SHOULD CALL (which vendor categories this is a live prospect for). Keep each field tight — one short paragraph maximum. No meta-commentary about the research process (never mention "last week's feed flagged this" or internal notes about fetch attempts).
  (f) An "Industry Voices" section — ONLY when an INDUSTRY VOICES QUEUE is provided below the pages. Placed after the numbered signal items, before the Watch List. Rules for this section only:
      - This is attributed opinion the publisher chose to share, not sourced research — keep it clearly boxed off from the numbered signal items above and never let it influence their claim discipline.
      - One short entry per voice: name the person/source up front (e.g. "**Industry voice: Spencer Pratt**"), then 2-4 sentences in your own words describing what they argued and why it matters to a vendor reading this Wire. Do not reproduce inflammatory or partisan language verbatim — describe the substance of the argument plainly.
      - Any specific dollar figure, jobs number, or study the voice cites gets "(unverified — single source, publisher-shared opinion)" appended the first time it's mentioned.
      - End each entry with "Source: <name/handle>, <where>" — never a skim402.com or internal URL.
  (g) A "Watch List — Check Next Week" section: tight one-liner bullets only.
- The Wire's promise to subscribers is all three signal families every week where the evidence supports them: (a) production SPENDING signals (incentive awards, budgets, buildouts), (b) new ENTITY FORMATIONS (production companies/LLCs just created — early-stage leads), and (c) HIRING tells (job-posting patterns that reveal spend before it is announced). Draw items from each family the pages support; never fabricate one to fill a category. Entity formations and proprietary hiring data are HSW exclusives — always lead with them.
- Scannability rules: short paragraphs, no dense walls of text. WHO SHOULD CALL is a list of vendor types, not an essay. If a WHO field lists more than five productions, name the top three by budget and summarize the rest in one line.
- Voice: plain-spoken, direct, a working salesperson's respect for the reader's time. No hype words, no exclamation marks.
- If the week's fetches are too thin to support a full issue, say so plainly at the top and draft what the evidence supports — never pad.

Output ONLY the markdown draft.`;

interface FetchedPage {
  url: string;
  label: string;
  markdown: string;
  wordCount: number;
  status: string; // "ok" | error text
  fetchedAt: string; // ISO timestamp of this pull
}

/** Health of a structured Skim Signal feed for the pre-flight report. */
interface FeedHealth {
  name: string;
  status: "ok" | "empty" | "failed";
  itemCount: number;
  detail?: string;
}

/** Record a feed's health exactly once — a later entry for the same feed replaces the earlier one. */
function recordFeed(feedHealth: FeedHealth[], entry: FeedHealth): void {
  const idx = feedHealth.findIndex((f) => f.name === entry.name);
  if (idx >= 0) feedHealth[idx] = entry;
  else feedHealth.push(entry);
}

async function fetchPage(url: string, label: string): Promise<FetchedPage> {
  try {
    let { markdown, wordCount } = await skimRead(url);
    let via = "";
    if (wordCount < 60) {
      // Likely a JS-tabbed page — pay for a full browser render and keep the
      // better result (Skim agent's recommendation for pages like film.ca.gov).
      try {
        const js = await skimReadJs(url);
        if (js.wordCount > wordCount) {
          markdown = js.markdown;
          wordCount = js.wordCount;
          via = " via browser render";
        }
      } catch {
        // keep the plain result
      }
    }
    const thin = wordCount < 60;
    return {
      url,
      label,
      markdown,
      wordCount,
      status: thin ? "ok-but-thin (possible JS page — treat with suspicion)" : `ok${via}`,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    const e = err as { response?: { status?: number; data?: unknown }; message?: string };
    const detail = e.response?.status
      ? `HTTP ${e.response.status} ${JSON.stringify(e.response.data ?? "").slice(0, 120)}`
      : (e.message ?? "unknown error");
    return { url, label, markdown: "", wordCount: 0, status: `error: ${detail}`, fetchedAt: new Date().toISOString() };
  }
}

async function claude(system: string, user: string, maxTokens: number): Promise<string> {
  const { anthropic } = await import("@workspace/integrations-anthropic-ai");
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  const block = message.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
}

function pagesToPrompt(pages: FetchedPage[], cap: number): string {
  return pages
    .filter((p) => p.markdown.length > 0)
    .map(
      (p) =>
        `=== SOURCE: ${p.label}\nURL: ${p.url}\nFETCHED: ${p.fetchedAt.slice(0, 10)}\nSTATUS: ${p.status}\n---\n${p.markdown.slice(0, cap)}`,
    )
    .join("\n\n");
}

/** ISO date (YYYY-MM-DD) of the Monday of the current week in Los Angeles. */
export function currentWeekKey(now = new Date()): string {
  const la = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(now);
  const get = (t: string) => la.find((p) => p.type === t)?.value ?? "";
  const dow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday"));
  const d = new Date(Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day"))));
  d.setUTCDate(d.getUTCDate() - (dow < 0 ? 0 : dow));
  return d.toISOString().slice(0, 10);
}

/**
 * Only explore URLs that are https, point at a public host, and whose host
 * we either already trust (the beat) or actually saw in this week's fetched
 * pages — fetched web content steers the model, so unprovenanced URLs are
 * a paid-request abuse vector.
 */
function safeExploreUrl(raw: string, pages: FetchedPage[]): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^[0-9.:[\]]+$/.test(host) // IP literals (v4 or v6)
  ) {
    return false;
  }
  const beatHosts = RESEARCH_BEAT.map((s) => new URL(s.url).hostname.toLowerCase());
  const trusted =
    beatHosts.some((b) => host === b || host.endsWith(`.${b}`)) ||
    pages.some((p) => p.markdown.toLowerCase().includes(host));
  return trusted;
}

let runInFlight = false;

/** Week key for NEXT week's Monday (used to research the upcoming Wire early). */
export function nextWeekKey(now = new Date()): string {
  return currentWeekKey(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));
}

export async function runWeeklyResearch(
  trigger: "schedule" | "manual",
  weekKeyOverride?: string,
): Promise<{ started: boolean; reason?: string }> {
  if (runInFlight) return { started: false, reason: "A run is already in progress." };
  // Only the current or next week may be targeted — the override exists so a
  // manual weekend run can prepare Monday's Wire early (the unique week_key
  // then makes Monday's scheduled run a no-op; nothing is bought twice).
  const weekKey =
    weekKeyOverride && weekKeyOverride === nextWeekKey() ? weekKeyOverride : currentWeekKey();

  // Atomic claim: the unique index on week_key is the distributed lock.
  const inserted = await db
    .insert(wireRunsTable)
    .values({ weekKey, status: "running", trigger })
    .onConflictDoNothing({ target: wireRunsTable.weekKey })
    .returning();
  let run = inserted[0];
  if (!run) {
    if (trigger === "schedule") return { started: false, reason: "This week's run already exists." };
    // Manual retry may only take over a FAILED run (atomically) — a ready
    // draft is never silently re-bought.
    const took = await db
      .update(wireRunsTable)
      .set({ status: "running", trigger, startedAt: new Date(), finishedAt: null, error: null })
      .where(and(eq(wireRunsTable.weekKey, weekKey), eq(wireRunsTable.status, "failed")))
      .returning();
    if (!took[0]) {
      return {
        started: false,
        reason: "This week's draft already exists or is still being researched.",
      };
    }
    run = took[0];
    await db.delete(researchPagesTable).where(eq(researchPagesTable.runId, run.id));
  }

  // Fire-and-forget the heavy work; callers get an immediate answer.
  void (async () => {
    try {
      logger.info({ runId: run.id, weekKey, trigger }, "weekly research: starting");

      // 0. Custom Skim Signals (structured feeds). Both skip gracefully if
      // unavailable — the raw beat below still carries the issue.
      const pages: FetchedPage[] = [];
      const feedHealth: FeedHealth[] = [];
      const officialIncentiveUrls: string[] = [];
      try {
        const items = await skimFilmIncentives(50);
        const cutoff = Date.now() - 10 * 24 * 3600 * 1000;
        const fresh = items.filter((i) => Date.parse(i.payload.publishedAt) > cutoff);
        recordFeed(feedHealth, {
          name: "Incentive awards feed",
          status: fresh.length > 0 ? "ok" : "empty",
          itemCount: fresh.length,
          detail: fresh.length === 0 ? `${items.length} total items, none fresh within 10 days` : undefined,
        });
        if (fresh.length > 0) {
          const md =
            `CITE AS: each item's own public URL (official announcement or outlet page, listed under the item) — never cite this feed's URL.\n` +
            fresh
              .map(
                (i) =>
                  `- [${i.payload.state}] ${i.payload.official ? "OFFICIAL (" + i.payload.outlet + ")" : "press (" + i.payload.outlet + ")"} ${i.payload.publishedAt.slice(0, 10)}: ${i.title}\n  ${i.url}\n  ${i.summary}`,
              )
              .join("\n");
          pages.push({
            url: "https://skim402.com/api/v2/signal/film-incentives/latest",
            label: "Skim Signal — state incentive award rounds (CA/NY/GA/NM/TX)",
            markdown: md,
            wordCount: md.split(/\s+/).filter(Boolean).length,
            status: "ok (structured signal)",
            fetchedAt: new Date().toISOString(),
          });
          // Official items are award rounds by definition — deep-read them.
          for (const i of fresh.filter((f) => f.payload.official).slice(0, 5)) {
            officialIncentiveUrls.push(i.url);
          }
          // Official awards anchor the production-stage estimate model.
          for (const i of fresh.filter((f) => f.payload.official)) {
            try {
              await recordProjectSignal({
                sourceType: "incentive_award",
                name: i.title,
                jurisdiction: i.payload.state,
                triggerDate: new Date(i.payload.publishedAt),
                sourceUrl: i.url,
                weekKey,
              });
            } catch (err) {
              logger.warn({ err }, "failed to record incentive-award project signal; continuing");
            }
          }
        }
      } catch (err) {
        recordFeed(feedHealth, {
          name: "Incentive awards feed",
          status: "failed",
          itemCount: 0,
          detail: err instanceof Error ? err.message.slice(0, 120) : "unknown error",
        });
        logger.warn({ err }, "film-incentives signal unavailable; continuing without it");
      }
      try {
        const { items, crawlStatus } = await skimStudioJobs(100);
        recordFeed(feedHealth, {
          name: "Studio job-posting counts feed",
          status: items.length > 0 ? "ok" : "empty",
          itemCount: items.length,
          detail: crawlStatus && crawlStatus !== "ok" ? `crawl status: ${crawlStatus}` : undefined,
        });
        if (items.length > 0) {
          const md =
            `Weekly counts of open AI/content-ops job postings per studio (from each studio's ATS API).\n` +
            `CITE AS: "Weekly counts of AI and content-ops job postings across the major Hollywood studios (Netflix, Warner Bros. Discovery, Disney, Amazon MGM Studios, NBCUniversal), week of ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" })}" — never cite this feed's URL.\n` +
            `READING RULES: compare week-over-week PER TERM PER STUDIO — that trend is the signal. Never sum the four terms (postings overlap) and never compare absolute counts across studios (each board matches differently). Crawl status: ${crawlStatus ?? "ok"}.\n\n` +
            JSON.stringify(items, null, 1).slice(0, 20000);
          pages.push({
            url: "https://skim402.com/api/v2/signal/studio-jobs/latest",
            label: "Skim Signal — studio AI/content-ops job-posting counts (weekly)",
            markdown: md,
            wordCount: md.split(/\s+/).filter(Boolean).length,
            status: "ok (structured signal)",
            fetchedAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        recordFeed(feedHealth, {
          name: "Studio job-posting counts feed",
          status: "failed",
          itemCount: 0,
          detail: err instanceof Error ? err.message.slice(0, 120) : "unknown error",
        });
        logger.warn({ err }, "studio-jobs signal unavailable; continuing without it");
      }
      try {
        const signals = await collectCreatorJobSignals();
        const failed = signals.filter((signal) => signal.status === "failed");
        const matches = signals.flatMap((signal) => signal.matches);
        recordFeed(feedHealth, {
          name: "Digital Creator job-title search",
          status:
            failed.length === signals.length
              ? "failed"
              : matches.length > 0
                ? "ok"
                : "empty",
          itemCount: matches.length,
          detail:
            failed.length > 0
              ? `${failed.length}/${signals.length} title/source searches unavailable`
              : undefined,
        });

        // Persist this week's counts before drafting so the comparison is
        // available as soon as this run's own snapshot lands, and load the
        // most recent PRIOR week (never this one) to diff against.
        const trend = await loadCreatorJobTrend(weekKey);
        const md = formatCreatorJobSignals(signals, trend);
        await recordCreatorJobSnapshot(weekKey, signals);
        pages.push({
          url: "https://www.imdb.com/pressroom/",
          label: "HSW direct search — IMDb Digital Creator category job signals (weekly)",
          markdown: md,
          wordCount: md.split(/\s+/).filter(Boolean).length,
          status:
            failed.length > 0
              ? `partial (${failed.length}/${signals.length} searches unavailable)`
              : "ok (direct official ATS search)",
          fetchedAt: new Date().toISOString(),
        });
      } catch (err) {
        recordFeed(feedHealth, {
          name: "Digital Creator job-title search",
          status: "failed",
          itemCount: 0,
          detail: err instanceof Error ? err.message.slice(0, 120) : "unknown error",
        });
        logger.warn(
          { err },
          "digital-creator jobs search unavailable; continuing without it",
        );
      }
      try {
        // NOTE: the feed returns at most the ~100 newest items globally and
        // ignores jurisdiction filters (verified Aug 2026) — high UK volume can
        // crowd US filings out of a crawl. Per-jurisdiction quotas are an
        // upstream Skim feature request (Karilyn's call).
        const { items, crawlStatus, degradedSources } = await skimEntityFormations(100);
        const cutoff = Date.now() - 10 * 24 * 3600 * 1000;
        const fresh = items.filter((i) => Date.parse(i.payload.publishedAt) > cutoff);
        recordFeed(feedHealth, {
          name: "Entity formations feed",
          status: fresh.length > 0 ? "ok" : "empty",
          itemCount: fresh.length,
          detail:
            [
              degradedSources?.length ? `degraded sources: ${degradedSources.join(", ")}` : "",
              crawlStatus && crawlStatus !== "ok" ? `crawl status: ${crawlStatus}` : "",
              fresh.length === 0 ? `${items.length} total items, none fresh within 10 days` : "",
            ]
              .filter(Boolean)
              .join("; ") || undefined,
        });
        if (fresh.length > 0) {
          const md =
            `New business-entity formations from official registries, keyword-filtered for film/TV terms (Productions/Pictures/Films/Studios/Media/Entertainment/Post/VFX/Television).\n` +
            `CITE AS: each filing's own official registry page (the URL listed under the item) — never cite this feed's URL and never describe the keyword filter in the Wire.\n` +
            `READING RULES: coverage is US state registries (NY, TX, NM) + UK Companies House + Canada (CA and GA are known gaps — never claim national coverage). As of Sept 2026 the ~100 newest filings split roughly evenly across jurisdictions instead of one crowding out the rest, but if a covered jurisdiction still shows few or no items in a given crawl, treat that as UNKNOWN, never as "no new filings there". Expect heavy non-film noise, especially from the UK feed ("AIMCREATIVE LTD", wellness/photo/generic media) — apply second-pass relevance judgment: keep only names suggesting a production entity, project LLC, or per-series vehicle (e.g. "...S2 LTD", "...PRODUCTION(S) LTD" with a title-like name); drop the rest. The UK and Canada are both production hubs — a fresh per-project or per-series company there is the same early buy-signal as a US production LLC (banking, insurance, payroll, legal, stage/vendor spend follow), and UK/Canadian filings name incorporation dates and registered addresses on the linked official page. TX filingDate can be future-dated (declared "responsibility beginning" date) — cite publishedAt for freshness.` +
            `${degradedSources?.length ? ` DEGRADED SOURCES (live source down this crawl): ${degradedSources.join(", ")}.` : ""} Crawl status: ${crawlStatus ?? "ok"}.\n\n` +
            fresh
              .map(
                (i) =>
                  `- [${i.payload.jurisdiction}] ${i.payload.publishedAt.slice(0, 10)}: ${i.payload.entityName} (${i.payload.entityType}, filed ${i.payload.filingDate}${i.payload.registeredAgent ? `, agent: ${i.payload.registeredAgent}` : ""})\n  ${i.payload.sourceUrl}`,
              )
              .join("\n");
          pages.push({
            url: "https://skim402.com/api/v2/signal/entity-formations/latest",
            label: "Skim Signal — new film/TV entity formations (US state registries + UK Companies House + Canada)",
            markdown: md,
            wordCount: md.split(/\s+/).filter(Boolean).length,
            status: "ok (structured signal)",
            fetchedAt: new Date().toISOString(),
          });
          // Only names that pass the same production-entity heuristic anchor
          // the stage model — noisy non-production filings are excluded.
          for (const i of fresh.filter((f) => looksLikeProductionEntity(f.payload.entityName))) {
            try {
              await recordProjectSignal({
                sourceType: "entity_formation",
                name: i.payload.entityName,
                jurisdiction: i.payload.jurisdiction,
                triggerDate: new Date(i.payload.publishedAt),
                sourceUrl: i.payload.sourceUrl,
                weekKey,
              });
            } catch (err) {
              logger.warn({ err }, "failed to record entity-formation project signal; continuing");
            }
          }
        }
      } catch (err) {
        recordFeed(feedHealth, {
          name: "Entity formations feed",
          status: "failed",
          itemCount: 0,
          detail: err instanceof Error ? err.message.slice(0, 120) : "unknown error",
        });
        logger.warn({ err }, "entity-formations signal unavailable; continuing without it");
      }
      try {
        await pruneExpiredProjectSignals();
        const trackedStages = await listTrackedProjectStages();
        recordFeed(feedHealth, {
          name: "Production-stage estimate model",
          status: trackedStages.length > 0 ? "ok" : "empty",
          itemCount: trackedStages.length,
        });
        pages.push({
          url: "internal://production-stage-model",
          label: "HSW model — estimated production stage per tracked formation/award",
          markdown: formatProjectStages(trackedStages),
          wordCount: trackedStages.length * 20,
          status: "ok (internal model, not a live source)",
          fetchedAt: new Date().toISOString(),
        });
      } catch (err) {
        recordFeed(feedHealth, {
          name: "Production-stage estimate model",
          status: "failed",
          itemCount: 0,
          detail: err instanceof Error ? err.message.slice(0, 120) : "unknown error",
        });
        logger.warn({ err }, "production-stage model unavailable; continuing without it");
      }

      // 1. Fetch the beat (sequentially — be a polite payer).
      for (const s of RESEARCH_BEAT) pages.push(await fetchPage(s.url, s.label));
      for (const u of officialIncentiveUrls) {
        if (!pages.some((p) => p.url === u)) pages.push(await fetchPage(u, `Official award announcement: ${u}`));
      }

      // 2. Aggressive exploration: let the model pick follow-up URLs from what it saw.
      let exploreUrls: string[] = [];
      try {
        const raw = await claude(EXPLORE_PROMPT, pagesToPrompt(pages, 8000), 1000);
        const match = raw.match(/\[[\s\S]*\]/);
        if (match) {
          exploreUrls = (JSON.parse(match[0]) as unknown[])
            .filter((u): u is string => typeof u === "string")
            .filter((u) => !pages.some((p) => p.url === u))
            .filter((u) => safeExploreUrl(u, pages))
            .slice(0, MAX_EXPLORE_URLS);
        }
      } catch (err) {
        logger.warn({ err }, "weekly research: exploration step failed; continuing with beat only");
      }
      for (const u of exploreUrls) pages.push(await fetchPage(u, `Explored: ${u}`));

      // 3. Persist raw pages (next week's diff baseline), capped, and prune
      // anything older than 5 weeks so the table cannot grow without bound.
      await db
        .delete(researchPagesTable)
        .where(sql`${researchPagesTable.fetchedAt} < now() - interval '35 days'`);
      for (const p of pages) {
        if (p.markdown.length > 0) {
          await db.insert(researchPagesTable).values({
            runId: run.id,
            url: p.url,
            label: p.label,
            wordCount: p.wordCount,
            markdown: p.markdown.slice(0, 200_000),
          });
        }
      }

      // 4. Load last ready run's pages for the "what's new" diff.
      const [prevRun] = await db
        .select()
        .from(wireRunsTable)
        .where(and(eq(wireRunsTable.status, "ready"), ne(wireRunsTable.id, run.id)))
        .orderBy(desc(wireRunsTable.startedAt))
        .limit(1);
      const prevPages = prevRun
        ? await db.select().from(researchPagesTable).where(eq(researchPagesTable.runId, prevRun.id))
        : [];

      const okPages = pages.filter((p) => p.markdown.length > 0);
      if (okPages.length === 0) throw new Error("Every source fetch failed — no material to draft from.");

      // 5. Draft the paid Wire.
      const prevBlock =
        prevPages.length > 0
          ? `\n\nLAST WEEK'S PAGES (for comparison — find what is NEW):\n\n${prevPages
              .map((p) => `=== LAST WEEK: ${p.label}\nURL: ${p.url}\n---\n${p.markdown.slice(0, PREV_PAGE_CHARS)}`)
              .join("\n\n")}`
          : "\n\n(No previous week's pages available — this is the first run; treat everything as new but say so in the dateline.)";
      const pendingVoices = await getPendingIndustryVoices();
      const voicesBlock = formatIndustryVoicesForPrompt(pendingVoices);
      const generatedWire = await claude(
        WIRE_PROMPT,
        `PUBLICATION DATE: ${wirePublicationDate(weekKey)}. Use this exact date in the issue masthead; do not infer it from source dates.\n\nTHIS WEEK'S PAGES:\n\n${pagesToPrompt(pages, PAGE_CHARS_IN_PROMPT)}${prevBlock}${voicesBlock}`,
        16000,
      );
      if (generatedWire.trim().length < 300) throw new Error("Wire draft came back too short to be usable.");
      const wireMarkdown = normalizeWireDateline(generatedWire, weekKey);

      // 6. Draft the free edition from the paid draft.
      const free = await draftFreeEdition(wireMarkdown);

      await db
        .update(wireRunsTable)
        .set({
          status: "ready",
          finishedAt: new Date(),
          wireMarkdown,
          freeSubject: free.subject,
          freeBody: free.bodyText,
          sources: pages.map((p) => ({
            url: p.url,
            label: p.label,
            wordCount: p.wordCount,
            status: p.status,
            fetchedAt: p.fetchedAt,
          })),
        })
        .where(eq(wireRunsTable.id, run.id));

      if (pendingVoices.length > 0) {
        await markIndustryVoicesUsed(pendingVoices.map((v) => v.id), weekKey);
      }

      // Best-effort: schedule a LinkedIn + X version of the Brief in Typefully.
      // Never blocks or fails the run. The
      // social_drafts row is the idempotency claim across instances.
      // The whole social block is fenced off in its own try/catch: no DB or
      // network failure here may ever change the run's status to failed.
      let typefullyStatus = "Social drafts: skipped (already pushed for this week).";
      try {
        const briefClaim = await claimSocialDraft("brief", weekKey);
        if (briefClaim) {
          const push = await pushBriefToTypefully(weekKey, free.bodyText, `${SITE_URL}/og-card.png`);
          typefullyStatus = push.status;
          await db
            .update(socialDraftsTable)
            .set({
              status: push.ok ? (push.publishState === "published" ? "published" : "scheduled") : "failed",
              typefullyDraftId: push.draftId ?? null,
              postText: push.linkedinText ?? null,
              error: push.ok ? null : push.status,
            })
            .where(eq(socialDraftsTable.id, briefClaim.id));
        }
      } catch (socialErr) {
        logger.warn({ err: socialErr, weekKey }, "weekly research: social draft step failed (run unaffected)");
        typefullyStatus = "Social drafts: could not be pushed this week (internal error). The Wire and Brief are unaffected.";
      }

      // Pre-flight report to the publisher (sources, feed health, anomalies).
      const failedPages = pages.filter((p) => p.status.startsWith("error"));
      const thinPages = pages.filter((p) => p.status.startsWith("ok-but-thin"));
      const anomalies: string[] = [];
      for (const f of feedHealth) {
        if (f.status === "failed") anomalies.push(`${f.name} FAILED (${f.detail ?? "no detail"}) — its signal family may be missing this week.`);
        else if (f.status === "empty") anomalies.push(`${f.name} returned 0 fresh items (${f.detail ?? ""}) — unusual; treat that family as UNKNOWN, not "quiet".`);
        else if (f.detail) anomalies.push(`${f.name}: ${f.detail}`);
      }
      if (failedPages.length > 0)
        anomalies.push(`${failedPages.length} page fetch(es) failed: ${failedPages.map((p) => p.label).join("; ")}`);
      if (thinPages.length > 0)
        anomalies.push(`${thinPages.length} page(s) came back thin (possible JS/blocked page): ${thinPages.map((p) => p.label).join("; ")}`);

      const report = [
        `PRE-FLIGHT REPORT — week of ${weekKey}`,
        ``,
        `Sources: ${okPages.length - thinPages.length} read OK, ${thinPages.length} thin, ${failedPages.length} failed (${pages.length} attempted).`,
        `Signal feeds: ${feedHealth.map((f) => `${f.name} — ${f.status}${f.itemCount ? ` (${f.itemCount} fresh items)` : ""}`).join("; ") || "none polled"}.`,
        ``,
        anomalies.length > 0
          ? `NEEDS YOUR EYE BEFORE SEND:\n${anomalies.map((a) => `- ${a}`).join("\n")}`
          : `No source anomalies this run.`,
        ``,
        typefullyStatus,
        ``,
        `Spot-audit suggestion: open the receipt links on any 10 items and confirm the live page still supports the wording. Anything tagged SINGLE SOURCE — VERIFY deserves that check first. If more than one hard miss, hold the send and rerun.`,
        ``,
        `Ready to send: PENDING YOUR REVIEW — nothing goes out until you send it.`,
      ].join("\n");

      // The draft is already saved and the run is already "ready" at this
      // point. A failure sending the "it's ready" email must never flip a
      // genuinely successful run back to "failed" and hide a good draft —
      // so this is fenced off the same way the Typefully block is.
      try {
        await notify(
          "Your Tuesday Wire draft is ready",
          `Karilyn,\n\nThe Monday research run finished. This week's paid Wire draft and the Free Edition draft are waiting in your publisher console for review.\n\n${report}\n\nOpen your bookmarked publisher console link to review.\n\n— Hollywood Sales Wire research desk`,
        );
      } catch (notifyErr) {
        logger.warn(
          { err: notifyErr, runId: run.id },
          "weekly research: ready-notification failed to send (draft itself is fine and saved as ready)",
        );
      }
      logger.info({ runId: run.id }, "weekly research: ready");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err, runId: run.id }, "weekly research: failed");
      await db
        .update(wireRunsTable)
        .set({ status: "failed", finishedAt: new Date(), error: msg })
        .where(eq(wireRunsTable.id, run.id));
      await notify(
        "Monday research run FAILED — action needed",
        `Karilyn,\n\nThis week's automatic research run failed with:\n\n${msg}\n\nOpen your publisher console and press "Run research now" to retry, or reply to your agent in Replit.\n\n— Hollywood Sales Wire research desk`,
      ).catch(() => undefined);
    } finally {
      runInFlight = false;
    }
  })();

  return { started: true };
}

async function notify(subject: string, text: string): Promise<void> {
  await resendRequest("/emails", {
    method: "POST",
    body: {
      from: FROM_ADDRESS,
      to: [NOTIFY_EMAIL],
      subject,
      text: `${text}\n\n${SITE_URL}/publisher`,
    },
  });
}
