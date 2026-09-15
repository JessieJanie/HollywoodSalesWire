const FETCH_TIMEOUT_MS = 20_000;

export const CREATOR_JOB_TITLES = [
  "Digital Creator",
  "Streamer",
  "Vlogger",
  "Gaming Creator",
  "Video Essayist",
] as const;

export type CreatorJobTitle = (typeof CREATOR_JOB_TITLES)[number];

export interface CreatorJobMatch {
  title: string;
  url: string;
  location?: string;
  postedAt?: string;
}

export interface CreatorJobSignal {
  studio: string;
  category: CreatorJobTitle;
  searchUrl: string;
  status: "ok" | "failed";
  matches: CreatorJobMatch[];
  detail?: string;
}

interface RawJob {
  title: string;
  url: string;
  location?: string;
  postedAt?: string;
}

interface Source {
  studio: string;
  searchUrl: (title: CreatorJobTitle) => string;
  parse: (body: string, searchUrl: string) => RawJob[];
}

function normalizeTitle(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const CATEGORY_PATTERNS: Record<CreatorJobTitle, RegExp> = {
  "Digital Creator": /\bdigital creators?\b/,
  Streamer: /\bstreamers?\b/,
  Vlogger: /\bvloggers?\b/,
  "Gaming Creator": /\bgaming creators?\b/,
  "Video Essayist": /\bvideo essayists?\b/,
};

/** Match only IMDb's verified creator categories, not broad uses of “creator.” */
export function matchesCreatorJobTitle(
  jobTitle: string,
  category: CreatorJobTitle,
): boolean {
  return CATEGORY_PATTERNS[category].test(normalizeTitle(jobTitle));
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(path: string, base: string): string {
  try {
    return new URL(path, base).toString();
  } catch {
    return base;
  }
}

export function parseNetflixJobs(body: string): RawJob[] {
  const data = JSON.parse(body) as {
    positions?: Array<{
      name?: string;
      posting_name?: string;
      canonicalPositionUrl?: string;
      location?: string;
      t_create?: number;
    }>;
  };
  return (data.positions ?? []).map((job) => ({
    title: job.posting_name ?? job.name ?? "",
    url: job.canonicalPositionUrl ?? "https://explore.jobs.netflix.net/careers",
    location: job.location,
    postedAt: job.t_create
      ? new Date(job.t_create * 1_000).toISOString()
      : undefined,
  }));
}

export function parseAmazonJobs(body: string): RawJob[] {
  const data = JSON.parse(body) as {
    jobs?: Array<{
      title?: string;
      job_path?: string;
      location?: string;
      posted_date?: string;
    }>;
  };
  return (data.jobs ?? []).map((job) => ({
    title: job.title ?? "",
    url: absoluteUrl(job.job_path ?? "", "https://www.amazon.jobs"),
    location: job.location,
    postedAt: job.posted_date,
  }));
}

export function parseNbcUniversalJobs(body: string): RawJob[] {
  const data = JSON.parse(body) as {
    content?: Array<{
      name?: string;
      ref?: string;
      location?: { city?: string; region?: string; country?: string };
      releasedDate?: string;
    }>;
  };
  return (data.content ?? []).map((job) => ({
    title: job.name ?? "",
    url: job.ref ?? "https://careers.smartrecruiters.com/NBCUniversal",
    location: [
      job.location?.city,
      job.location?.region,
      job.location?.country,
    ]
      .filter(Boolean)
      .join(", "),
    postedAt: job.releasedDate,
  }));
}

export function parseWarnerBrosDiscoveryJobs(body: string): RawJob[] {
  const startMarker = "phApp.ddo = ";
  const endMarker = "; phApp.experimentData";
  const start = body.indexOf(startMarker);
  const end = body.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) {
    throw new Error("WBD search payload was not present");
  }
  const data = JSON.parse(
    body.slice(start + startMarker.length, end),
  ) as {
    eagerLoadRefineSearch?: {
      data?: {
        jobs?: Array<{
          title?: string;
          applyUrl?: string;
          imApplyUrl?: string;
          location?: string;
          postedDate?: string;
        }>;
      };
    };
  };
  return (data.eagerLoadRefineSearch?.data?.jobs ?? []).map((job) => ({
    title: job.title ?? "",
    url:
      job.applyUrl ??
      job.imApplyUrl ??
      "https://careers.wbd.com/global/en/search-results",
    location: job.location,
    postedAt: job.postedDate,
  }));
}

export function parseDisneyJobs(body: string, searchUrl: string): RawJob[] {
  const jobs: RawJob[] = [];
  const pattern =
    /<a\s+href="([^"]+)"[^>]*data-job-id="[^"]+"[^>]*>[\s\S]*?<h2>([\s\S]*?)<\/h2>[\s\S]*?(?:<span class="job-location">([\s\S]*?)<\/span>)?[\s\S]*?(?:<span class="job-date-posted">([\s\S]*?)<\/span>)?[\s\S]*?<\/a>/gi;
  for (const match of body.matchAll(pattern)) {
    jobs.push({
      title: decodeHtml(match[2] ?? ""),
      url: absoluteUrl(match[1] ?? "", searchUrl),
      location: decodeHtml(match[3] ?? "") || undefined,
      postedAt: decodeHtml(match[4] ?? "") || undefined,
    });
  }
  return jobs;
}

const SOURCES: Source[] = [
  {
    studio: "Netflix",
    searchUrl: (title) =>
      `https://netflix.eightfold.ai/api/apply/v2/jobs?domain=netflix.com&query=${encodeURIComponent(title)}`,
    parse: (body) => parseNetflixJobs(body),
  },
  {
    studio: "Warner Bros. Discovery",
    searchUrl: (title) =>
      `https://careers.wbd.com/global/en/search-results?keywords=${encodeURIComponent(title)}`,
    parse: (body) => parseWarnerBrosDiscoveryJobs(body),
  },
  {
    studio: "Disney",
    searchUrl: (title) =>
      `https://www.disneycareers.com/en/search-jobs?k=${encodeURIComponent(title)}`,
    parse: parseDisneyJobs,
  },
  {
    studio: "Amazon",
    searchUrl: (title) =>
      `https://www.amazon.jobs/en/search.json?base_query=${encodeURIComponent(title)}&offset=0&result_limit=100`,
    parse: (body) => parseAmazonJobs(body),
  },
  {
    studio: "NBCUniversal",
    searchUrl: (title) =>
      `https://api.smartrecruiters.com/v1/companies/NBCUniversal/postings?q=${encodeURIComponent(title)}&limit=100`,
    parse: (body) => parseNbcUniversalJobs(body),
  },
];

async function fetchSearch(source: Source, category: CreatorJobTitle): Promise<CreatorJobSignal> {
  const searchUrl = source.searchUrl(category);
  try {
    const response = await fetch(searchUrl, {
      headers: {
        Accept: "application/json,text/html",
        "User-Agent": "HollywoodSalesWire/1.0 (+https://hollywoodsaleswire.com)",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const parsed = source
      .parse(await response.text(), searchUrl)
      .filter((job) => matchesCreatorJobTitle(job.title, category));
    const unique = Array.from(
      new Map(
        parsed.map((job) => [
          `${normalizeTitle(job.title)}|${job.url}`,
          job,
        ]),
      ).values(),
    );
    return {
      studio: source.studio,
      category,
      searchUrl,
      status: "ok",
      matches: unique,
    };
  } catch (error) {
    return {
      studio: source.studio,
      category,
      searchUrl,
      status: "failed",
      matches: [],
      detail: error instanceof Error ? error.message.slice(0, 160) : "unknown error",
    };
  }
}

/** Run the five verified creator-title searches across all supported studio ATS sources. */
export async function collectCreatorJobSignals(): Promise<CreatorJobSignal[]> {
  return Promise.all(
    SOURCES.flatMap((source) =>
      CREATOR_JOB_TITLES.map((title) => fetchSearch(source, title)),
    ),
  );
}

/** Build the evidence block handed to the weekly Wire drafting prompt. */
export function formatCreatorJobSignals(signals: CreatorJobSignal[]): string {
  return (
    `Weekly search of official studio ATS sources for IMDb's Digital Creator professional categories.\n` +
    `SEARCHED TITLES: ${CREATOR_JOB_TITLES.join(", ")}.\n` +
    `SOURCES: Netflix, Warner Bros. Discovery, Disney, Amazon, and NBCUniversal.\n` +
    `READING RULES: Treat each title at each company as a separate hiring signal. Never sum categories or claim the matches are unique jobs across categories because one posting can overlap. A posting is not proof of an approved production budget or immediate purchase. Zero matches means only that this exact-title search found none; a failed search means coverage is unavailable, never zero. Do not treat individual creators as prospects merely because IMDb recognizes the category.\n\n` +
    signals
      .map((signal) => {
        if (signal.status === "failed") {
          return `- ${signal.studio} / ${signal.category}: COVERAGE UNAVAILABLE (${signal.detail ?? "search failed"})`;
        }
        if (signal.matches.length === 0) {
          return `- ${signal.studio} / ${signal.category}: 0 exact-title matches`;
        }
        return (
          `- ${signal.studio} / ${signal.category}: ${signal.matches.length} exact-title match(es)\n` +
          signal.matches
            .map(
              (job) =>
                `  - ${job.title}${job.location ? ` — ${job.location}` : ""}${job.postedAt ? ` — ${job.postedAt}` : ""}\n    ${job.url}`,
            )
            .join("\n")
        );
      })
      .join("\n")
  );
}