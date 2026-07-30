import { desc, eq, and, ne, sql } from "drizzle-orm";
import { db, wireRunsTable, researchPagesTable } from "@workspace/db";
import { skimRead, skimReadJs } from "./skim";
import { draftFreeEdition } from "./freeEdition";
import { resendRequest } from "./resend";
import { FROM_ADDRESS, SITE_URL } from "./emailSequence";
import { logger } from "./logger";

const NOTIFY_EMAIL = "hello@hollywoodsaleswire.com";

/** The weekly research beat. URLs verified working with Skim July 2026. */
export const RESEARCH_BEAT: { url: string; label: string }[] = [
  {
    url: "https://film.ca.gov/film-and-television-tax-credit-program-approved-projects-list/",
    label: "California Film Commission — approved projects (all award rounds)",
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
];

const MAX_EXPLORE_URLS = 8;
const PAGE_CHARS_IN_PROMPT = 14000;
const PREV_PAGE_CHARS = 4000;

const EXPLORE_PROMPT = `You are the research lead for "Hollywood Sales Wire," a paid weekly sales-intelligence briefing for vendors selling into the entertainment industry (cameras, stages, software, localization, post, payroll, insurance).

You are given this week's fetched source pages (markdown, with URLs). Propose up to ${MAX_EXPLORE_URLS} ADDITIONAL absolute URLs worth fetching right now to turn these signals into named, dated, sellable leads. Rules:
- Prefer links that actually appear in the provided pages (award-round PDFs, press releases, quarterly report PDFs, named-production announcements).
- Prefer primary sources over coverage of them. State film offices, official press pages, and PDFs read best.
- Avoid: paywalled pages, login walls, search pages, JavaScript app pages (job-board searches rarely work), and anything already provided.
- Public sources only. Companies and roles, never personal data about individuals.

Respond with ONLY a valid JSON array of URL strings, e.g. ["https://...", "https://..."]. Empty array if nothing is worth a read.`;

const WIRE_PROMPT = `You are the editor and lead researcher of "Hollywood Sales Wire," a paid weekly sales-intelligence briefing ($3,995/yr) for vendors selling into the entertainment industry. Subscribers are salespeople; they pay for names, timing, and receipts — not commentary.

You are given (1) this week's fetched source pages, each with its URL and fetch date, and (2) excerpts of LAST week's pages for the same sources so you can tell what is NEW.

Write this week's full Tuesday Wire draft in markdown. Non-negotiable rules:
- ONLY claims traceable to the provided pages. If it is not in the pages, it does not exist. Never invent names, numbers, dates, or contacts.
- Every item ends with its receipt line: "Source: <URL> (fetched <date>)". A claim supported by only one source gets the tag **[SINGLE SOURCE — VERIFY]** at the start of its receipt line.
- Numbers that are a state's own promotional figure are labeled as such.
- Lead with what is NEW this week versus last week's pages. If a source shows nothing new, skip it — no filler.
- Structure: a two-sentence dateline opener on the week's money picture; then 4-8 numbered signal items. Each item: WHO (named production/company), WHAT HAPPENED (award, filing, report, announcement — with figures), WHY MONEY MOVES (what they now must buy and roughly when the window is), WHO SHOULD CALL (which vendor categories this is a live prospect for). Then a short "Watch list" of developing signals worth a look next week.
- Voice: plain-spoken, direct, a working salesperson's respect for the reader's time. No hype words, no exclamation marks.
- If the week's fetches are too thin to support a full issue, say so plainly at the top and draft what the evidence supports — never pad.

Output ONLY the markdown draft.`;

interface FetchedPage {
  url: string;
  label: string;
  markdown: string;
  wordCount: number;
  status: string; // "ok" | error text
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
    };
  } catch (err) {
    const e = err as { response?: { status?: number; data?: unknown }; message?: string };
    const detail = e.response?.status
      ? `HTTP ${e.response.status} ${JSON.stringify(e.response.data ?? "").slice(0, 120)}`
      : (e.message ?? "unknown error");
    return { url, label, markdown: "", wordCount: 0, status: `error: ${detail}` };
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
        `=== SOURCE: ${p.label}\nURL: ${p.url}\nFETCHED: ${new Date().toISOString().slice(0, 10)}\nSTATUS: ${p.status}\n---\n${p.markdown.slice(0, cap)}`,
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

export async function runWeeklyResearch(trigger: "schedule" | "manual"): Promise<{ started: boolean; reason?: string }> {
  if (runInFlight) return { started: false, reason: "A run is already in progress." };
  const weekKey = currentWeekKey();

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

      // 1. Fetch the beat (sequentially — be a polite payer).
      const pages: FetchedPage[] = [];
      for (const s of RESEARCH_BEAT) pages.push(await fetchPage(s.url, s.label));

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
      const wireMarkdown = await claude(
        WIRE_PROMPT,
        `THIS WEEK'S PAGES:\n\n${pagesToPrompt(pages, PAGE_CHARS_IN_PROMPT)}${prevBlock}`,
        16000,
      );
      if (wireMarkdown.trim().length < 300) throw new Error("Wire draft came back too short to be usable.");

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
          sources: pages.map((p) => ({ url: p.url, label: p.label, wordCount: p.wordCount, status: p.status })),
        })
        .where(eq(wireRunsTable.id, run.id));

      await notify(
        "Your Tuesday Wire draft is ready",
        `Karilyn,\n\nThe Monday research run finished. This week's paid Wire draft and the Free Edition draft are waiting in your publisher console for review.\n\n${okPages.length} sources read; every item carries its receipt. Anything tagged SINGLE SOURCE — VERIFY deserves your eye before it ships.\n\nOpen your bookmarked publisher console link to review.\n\n— Hollywood Sales Wire research desk`,
      );
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
