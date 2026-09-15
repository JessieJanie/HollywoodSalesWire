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
});