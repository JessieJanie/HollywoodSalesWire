import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  confirmPlannedTypefullyDraft,
  normalizeTypefullyDraftStatus,
  pushBriefToTypefully,
  pushHighlightToTypefully,
  type TypefullyDraftInspection,
} from "./typefully";

vi.mock("@workspace/integrations-anthropic-ai", () => ({
  anthropic: {
    messages: {
      create: vi.fn(async () => ({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              linkedin: "A useful LinkedIn post with enough detail to pass the minimum length requirement for publishing.",
              x: "A useful X post with enough detail to pass the minimum length requirement for publishing. https://hollywoodsaleswire.com bit.ly/brief example.ai",
            }),
          },
        ],
      })),
    },
  },
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function inspection(overrides: Partial<TypefullyDraftInspection>): TypefullyDraftInspection {
  return {
    status: "draft",
    publishState: null,
    scheduledDate: null,
    publishedAt: null,
    ...overrides,
  };
}

describe("normalizeTypefullyDraftStatus", () => {
  it("recognizes future schedules", () => {
    expect(normalizeTypefullyDraftStatus(inspection({ status: "scheduled" }))).toBe("scheduled");
  });

  it("recognizes asynchronous immediate publishing even while status is draft", () => {
    expect(
      normalizeTypefullyDraftStatus(inspection({ status: "draft", publishState: "in_progress" })),
    ).toBe("publishing");
  });

  it("treats a publication timestamp as terminal published state", () => {
    expect(
      normalizeTypefullyDraftStatus(
        inspection({ status: "draft", publishState: "finished", publishedAt: "2026-08-27T12:00:00Z" }),
      ),
    ).toBe("published");
  });

  it("preserves inert and failed states for scheduler handling", () => {
    expect(normalizeTypefullyDraftStatus(inspection({ status: "planned" }))).toBe("planned");
    expect(normalizeTypefullyDraftStatus(inspection({ status: "error" }))).toBe("error");
  });
});

describe("Typefully publish requests", () => {
  beforeEach(() => {
    process.env.TYPEFULLY_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TYPEFULLY_API_KEY;
  });

  it("uses publish_at rather than plan_at for highlights", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/v2/social-sets?limit=50")) {
        return jsonResponse({ results: [{ id: 1, name: "HSW" }] });
      }
      if (url.endsWith("/v2/social-sets/1/")) {
        return jsonResponse({ id: 1, name: "HSW", platforms: { linkedin: {}, x: {} } });
      }
      if (url.endsWith("/v2/social-sets/1/drafts") && init?.method === "POST") {
        return jsonResponse(
          { id: 99, status: "scheduled", scheduled_date: "2026-08-27T17:00:00Z" },
          201,
        );
      }
      throw new Error(`Unexpected fetch: ${init?.method ?? "GET"} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await pushHighlightToTypefully("Wednesday", "2026-08-24", "Brief body", null);

    expect(result.ok).toBe(true);
    const draftCall = fetchMock.mock.calls.find(
      ([input, init]) => String(input).endsWith("/drafts") && init?.method === "POST",
    );
    expect(draftCall).toBeDefined();
    const payload = JSON.parse(String(draftCall?.[1]?.body));
    expect(payload.publish_at).toEqual(expect.any(String));
    expect(payload).not.toHaveProperty("plan_at");
    expect(payload.platforms.linkedin.posts[0].text).toContain("LinkedIn post");
    expect(payload.platforms.x.posts[0].text).not.toMatch(/https?:\/\/|hollywoodsaleswire\.com|bit\.ly|example\.ai/i);
  });

  it("uploads the Brief masthead and attaches its media ID", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/v2/social-sets?limit=50")) {
        return jsonResponse({ results: [{ id: 1, name: "HSW" }] });
      }
      if (url.endsWith("/v2/social-sets/1/")) {
        return jsonResponse({ id: 1, name: "HSW", platforms: { linkedin: {}, x: {} } });
      }
      if (url === "https://example.com/masthead.png") return new Response(new Uint8Array([1, 2, 3]));
      if (url.endsWith("/v2/social-sets/1/media/upload") && init?.method === "POST") {
        return jsonResponse({ media_id: "media-1", upload_url: "https://uploads.example/media-1" }, 201);
      }
      if (url === "https://uploads.example/media-1" && init?.method === "PUT") return new Response(null, { status: 200 });
      if (url.endsWith("/v2/social-sets/1/media/media-1")) return jsonResponse({ status: "ready" });
      if (url.endsWith("/v2/social-sets/1/drafts") && init?.method === "POST") {
        return jsonResponse(
          { id: 100, status: "scheduled", scheduled_date: "2026-08-28T16:00:00Z" },
          201,
        );
      }
      throw new Error(`Unexpected fetch: ${init?.method ?? "GET"} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await pushBriefToTypefully("2026-08-24", "Brief body", "https://example.com/masthead.png");

    expect(result.ok).toBe(true);
    const draftCall = fetchMock.mock.calls.find(
      ([input, init]) => String(input).endsWith("/drafts") && init?.method === "POST",
    );
    const payload = JSON.parse(String(draftCall?.[1]?.body));
    expect(payload.platforms.linkedin.posts[0].media_ids).toEqual(["media-1"]);
    expect(payload.platforms.x.posts[0].media_ids).toEqual(["media-1"]);
    expect(payload).not.toHaveProperty("media_urls");
  });

  it("falls back to a text-only Brief when media upload fails", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/v2/social-sets?limit=50")) {
        return jsonResponse({ results: [{ id: 1, name: "HSW" }] });
      }
      if (url.endsWith("/v2/social-sets/1/")) {
        return jsonResponse({ id: 1, name: "HSW", platforms: { linkedin: {}, x: {} } });
      }
      if (url === "https://example.com/missing.png") return new Response(null, { status: 503 });
      if (url.endsWith("/v2/social-sets/1/drafts") && init?.method === "POST") {
        return jsonResponse(
          { id: 101, status: "scheduled", scheduled_date: "2026-08-28T16:00:00Z" },
          201,
        );
      }
      throw new Error(`Unexpected fetch: ${init?.method ?? "GET"} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await pushBriefToTypefully("2026-08-24", "Brief body", "https://example.com/missing.png");

    expect(result.ok).toBe(true);
    expect(result.status).toContain("scheduled text-only");
    const draftCall = fetchMock.mock.calls.find(
      ([input, init]) => String(input).endsWith("/drafts") && init?.method === "POST",
    );
    const payload = JSON.parse(String(draftCall?.[1]?.body));
    expect(payload.platforms.linkedin.posts[0]).not.toHaveProperty("media_ids");
    expect(payload.platforms.x.posts[0]).not.toHaveProperty("media_ids");
  });

  it("removes X URLs before confirming a legacy planned draft", async () => {
    let draftGets = 0;
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/v2/social-sets?limit=50")) {
        return jsonResponse({ results: [{ id: 1, name: "HSW" }] });
      }
      if (url.endsWith("/v2/social-sets/1/")) {
        return jsonResponse({ id: 1, name: "HSW", platforms: { linkedin: {}, x: {} } });
      }
      if (url.endsWith("/v2/social-sets/1/drafts/123") && !init?.method) {
        draftGets += 1;
        return jsonResponse(
          draftGets === 1
            ? {
                id: 123,
                status: "planned",
                scheduled_date: "2026-08-01T12:00:00Z",
                platforms: {
                  x: {
                    enabled: true,
                    posts: [{
                      text: "This legacy X post has enough useful context for publishing. https://hollywoodsaleswire.com bit.ly/brief example.tv/watch",
                    }],
                  },
                },
              }
            : { id: 123, status: "publishing", publish_state: "in_progress" },
        );
      }
      if (url.endsWith("/v2/social-sets/1/drafts/123") && init?.method === "PATCH") {
        return jsonResponse({ id: 123, status: "publishing" });
      }
      throw new Error(`Unexpected fetch: ${init?.method ?? "GET"} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await confirmPlannedTypefullyDraft("123", "2026-08-01T12:00:00Z");

    expect(normalizeTypefullyDraftStatus(result)).toBe("publishing");
    const patchCall = fetchMock.mock.calls.find(
      ([input, init]) => String(input).endsWith("/drafts/123") && init?.method === "PATCH",
    );
    const payload = JSON.parse(String(patchCall?.[1]?.body));
    expect(payload.publish_at).toBe("now");
    expect(payload.platforms.x.posts[0].text).not.toMatch(
      /https?:\/\/|hollywoodsaleswire\.com|bit\.ly|example\.tv/i,
    );
  });
});