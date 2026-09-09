import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  insert: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: dbMock,
  coldCampaignsTable: {
    batchTag: "batchTag",
    campaignId: "campaignId",
    createdAt: "createdAt",
  },
}));

import {
  createColdBatch,
  getColdCampaignContactCap,
  validateColdLead,
} from "./coldCampaigns";

describe("createColdBatch idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reconciles and completes the durable provider campaign after a restart", async () => {
    dbMock.insert.mockReturnValue({
      values: () => ({
        onConflictDoNothing: () => ({
          returning: async () => [],
        }),
      }),
    });
    dbMock.select.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: async () => [{ campaignId: "existing-provider-campaign" }],
        }),
      }),
    });
    dbMock.update.mockReturnValue({
      set: () => ({
        where: async () => undefined,
      }),
    });
    process.env.INSTANTLY_API_KEY = "test-key";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input, init) => {
        const url = String(input);
        const body =
          url.includes("?limit=100")
            ? { items: [{ id: "existing-provider-campaign", name: "HSW Founding Offer — Cold (starts Sep 8, deadline Tuesday, September 15)" }] }
            : init?.method === "GET"
              ? { status: 1 }
              : {};
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    );

    await expect(
      createColdBatch(new Date("2026-09-08T16:00:00Z")),
    ).resolves.toMatchObject({
      campaignId: "existing-provider-campaign",
      batchTag: "hsw-cold-09082026",
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/campaigns/existing-provider-campaign"),
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/campaigns/existing-provider-campaign"),
      expect.objectContaining({ method: "GET" }),
    );
  });
});

describe("validateColdLead", () => {
  it("accepts a named person at a person-specific address", () => {
    expect(
      validateColdLead({
        email: "jane.doe@studio.example",
        first_name: "Jane",
        last_name: "Doe",
      }),
    ).toBeNull();
  });

  it.each([
    "info@studio.example",
    "sales@studio.example",
    "contact@studio.example",
    "no-reply@studio.example",
    "production2@studio.example",
  ])("rejects generic role address %s", (email) => {
    expect(validateColdLead({ email, first_name: "Jane" })).toContain(
      "generic role address",
    );
  });

  it.each(["", "Unknown", "Team", "N/A"])(
    "rejects missing or non-person first name %j",
    (first_name) => {
      expect(
        validateColdLead({
          email: "jane.doe@studio.example",
          first_name,
        }),
      ).toContain("missing or non-person first name");
    },
  );
});

describe("getColdCampaignContactCap", () => {
  it.each([
    ["2026-09-08T15:00:00Z", 10],
    ["2026-09-10T15:00:00Z", 10],
    ["2026-09-15T15:00:00Z", 15],
    ["2026-09-22T15:00:00Z", 20],
    ["2026-09-29T15:00:00Z", 25],
    ["2026-10-06T15:00:00Z", 30],
    ["2027-01-05T16:00:00Z", 30],
  ])("caps campaign date %s at %i contacts", (date, expected) => {
    expect(getColdCampaignContactCap(new Date(date))).toBe(expected);
  });

  it.each([
    "2026-09-07T15:00:00Z",
    "2026-09-11T15:00:00Z",
    "2026-09-12T15:00:00Z",
    "2026-09-13T15:00:00Z",
  ])("refuses non-Tuesday-through-Thursday date %s", (date) => {
    expect(() => getColdCampaignContactCap(new Date(date))).toThrow(
      "may only start Tuesday, Wednesday, or Thursday",
    );
  });
});