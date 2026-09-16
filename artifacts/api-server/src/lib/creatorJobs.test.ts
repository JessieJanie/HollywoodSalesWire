import { describe, expect, it } from "vitest";
import {
  CREATOR_JOB_TITLES,
  formatCreatorJobSignals,
  matchesCreatorJobTitle,
  parseAmazonJobs,
  parseDisneyJobs,
  parseNbcUniversalJobs,
  parseNetflixJobs,
  parseWarnerBrosDiscoveryJobs,
  type CreatorJobTrend,
} from "./creatorJobs";

describe("creator job title taxonomy", () => {
  it("contains only the five IMDb-announced categories", () => {
    expect(CREATOR_JOB_TITLES).toEqual([
      "Digital Creator",
      "Streamer",
      "Vlogger",
      "Gaming Creator",
      "Video Essayist",
    ]);
  });

  it.each([
    ["Senior Digital Creator", "Digital Creator"],
    ["Digital-Creators, Partnerships", "Digital Creator"],
    ["Live Streamer", "Streamer"],
    ["Streamers & Community Lead", "Streamer"],
    ["Gaming/Creator", "Gaming Creator"],
    ["Video Essayists, Editorial", "Video Essayist"],
    ["VLOGGER", "Vlogger"],
  ] as const)("matches %s as %s", (jobTitle, category) => {
    expect(matchesCreatorJobTitle(jobTitle, category)).toBe(true);
  });

  it.each([
    ["Creator Content & Partnerships", "Digital Creator"],
    ["Content Creator", "Digital Creator"],
    ["Streaming Engineer", "Streamer"],
    ["Gaming Producer", "Gaming Creator"],
    ["Video Editor", "Video Essayist"],
    ["Influencer Marketing", "Vlogger"],
  ] as const)("does not misclassify %s as %s", (jobTitle, category) => {
    expect(matchesCreatorJobTitle(jobTitle, category)).toBe(false);
  });
});

describe("official ATS parsers", () => {
  it("parses Netflix positions", () => {
    expect(
      parseNetflixJobs(
        JSON.stringify({
          positions: [
            {
              posting_name: "Digital Creator",
              canonicalPositionUrl: "https://netflix.example/job/1",
              location: "Los Angeles",
            },
          ],
        }),
      ),
    ).toEqual([
      {
        title: "Digital Creator",
        url: "https://netflix.example/job/1",
        location: "Los Angeles",
        postedAt: undefined,
      },
    ]);
  });

  it("parses Amazon jobs", () => {
    expect(
      parseAmazonJobs(
        JSON.stringify({
          jobs: [
            {
              title: "Gaming Creator",
              job_path: "/en/jobs/1/gaming-creator",
            },
          ],
        }),
      )[0],
    ).toMatchObject({
      title: "Gaming Creator",
      url: "https://www.amazon.jobs/en/jobs/1/gaming-creator",
    });
  });

  it("parses NBCUniversal postings", () => {
    expect(
      parseNbcUniversalJobs(
        JSON.stringify({
          content: [
            {
              name: "Vlogger",
              ref: "https://jobs.smartrecruiters.com/NBCUniversal/1",
            },
          ],
        }),
      )[0],
    ).toMatchObject({ title: "Vlogger" });
  });

  it("parses the WBD embedded search payload", () => {
    const payload = {
      eagerLoadRefineSearch: {
        data: {
          jobs: [
            {
              title: "Video Essayist",
              applyUrl: "https://careers.wbd.com/job/1",
            },
          ],
        },
      },
    };
    expect(
      parseWarnerBrosDiscoveryJobs(
        `<script>phApp.ddo = ${JSON.stringify(payload)}; phApp.experimentData = {};</script>`,
      )[0],
    ).toMatchObject({ title: "Video Essayist" });
  });

  it("parses Disney search result cards", () => {
    const html = `<ul><li><a href="/en/job/1" data-job-id="1"><h2>Streamer</h2><span class="job-location">Burbank, California</span><span class="job-date-posted">Sep. 8, 2026</span></a></li></ul>`;
    expect(
      parseDisneyJobs(
        html,
        "https://www.disneycareers.com/en/search-jobs?k=Streamer",
      )[0],
    ).toMatchObject({
      title: "Streamer",
      url: "https://www.disneycareers.com/en/job/1",
    });
  });
});

describe("weekly research handoff", () => {
  it("preserves title coverage, unavailable-source handling, and claim discipline", () => {
    const markdown = formatCreatorJobSignals([
      {
        studio: "Netflix",
        category: "Digital Creator",
        searchUrl: "https://example.com/search",
        status: "failed",
        matches: [],
        detail: "HTTP 503",
      },
      {
        studio: "Disney",
        category: "Vlogger",
        searchUrl: "https://example.com/search",
        status: "ok",
        matches: [],
      },
    ]);

    for (const title of CREATOR_JOB_TITLES) {
      expect(markdown).toContain(title);
    }
    expect(markdown).toContain("COVERAGE UNAVAILABLE");
    expect(markdown).toContain("Never sum categories");
    expect(markdown).toContain("not proof of an approved production budget");
    expect(markdown).toContain("0 exact-title matches");
  });

  it("says no trend is available before a second week's snapshot exists", () => {
    const markdown = formatCreatorJobSignals(
      [
        {
          studio: "Netflix",
          category: "Digital Creator",
          searchUrl: "https://example.com/search",
          status: "ok",
          matches: [{ title: "Digital Creator", url: "https://example.com/job/1" }],
        },
      ],
      null,
    );
    expect(markdown).toContain("not yet available");
    expect(markdown).not.toMatch(/vs\. \d{4}-\d{2}-\d{2}/);
  });

  it("reports a per-title-per-company delta against the prior week, never a summed total", () => {
    const trend: CreatorJobTrend = {
      priorWeekKey: "2026-09-07",
      byKey: new Map([
        ["Netflix|Digital Creator", { status: "ok", matchCount: 2 }],
        ["Netflix|Streamer", { status: "ok", matchCount: 0 }],
      ]),
    };
    const markdown = formatCreatorJobSignals(
      [
        {
          studio: "Netflix",
          category: "Digital Creator",
          searchUrl: "https://example.com/search",
          status: "ok",
          matches: [{ title: "Digital Creator", url: "https://example.com/job/1" }],
        },
        {
          studio: "Netflix",
          category: "Streamer",
          searchUrl: "https://example.com/search",
          status: "ok",
          matches: [{ title: "Streamer", url: "https://example.com/job/2" }],
        },
      ],
      trend,
    );
    // Digital Creator dropped 2 -> 1 (-1); Streamer rose 0 -> 1 (+1). Each
    // title/company pair is diffed on its own — never summed into one number.
    expect(markdown).toContain("vs. 2026-09-07: -1");
    expect(markdown).toContain("vs. 2026-09-07: +1");
  });

  it("never fabricates a delta when this title/company pair has no prior snapshot", () => {
    const trend: CreatorJobTrend = { priorWeekKey: "2026-09-07", byKey: new Map() };
    const markdown = formatCreatorJobSignals(
      [
        {
          studio: "Amazon",
          category: "Vlogger",
          searchUrl: "https://example.com/search",
          status: "ok",
          matches: [],
        },
      ],
      trend,
    );
    expect(markdown).toContain("no prior data");
  });

  it("treats a prior week's failed search as unknown coverage, never a flat/zero comparison", () => {
    const trend: CreatorJobTrend = {
      priorWeekKey: "2026-09-07",
      byKey: new Map([["Disney|Vlogger", { status: "failed", matchCount: 0 }]]),
    };
    const markdown = formatCreatorJobSignals(
      [
        {
          studio: "Disney",
          category: "Vlogger",
          searchUrl: "https://example.com/search",
          status: "ok",
          matches: [{ title: "Vlogger", url: "https://example.com/job/3" }],
        },
      ],
      trend,
    );
    expect(markdown).toContain("prior coverage unavailable");
    expect(markdown).not.toContain("vs. 2026-09-07: +1");
  });

  it("keeps a failed current-week search labeled unavailable rather than a comparable zero", () => {
    const trend: CreatorJobTrend = {
      priorWeekKey: "2026-09-07",
      byKey: new Map([["NBCUniversal|Gaming Creator", { status: "ok", matchCount: 3 }]]),
    };
    const markdown = formatCreatorJobSignals(
      [
        {
          studio: "NBCUniversal",
          category: "Gaming Creator",
          searchUrl: "https://example.com/search",
          status: "failed",
          matches: [],
          detail: "timeout",
        },
      ],
      trend,
    );
    expect(markdown).toContain("COVERAGE UNAVAILABLE");
    expect(markdown).toContain("last known count 2026-09-07: 3");
  });
});