import { describe, expect, it } from "vitest";
import {
  getColdCampaignContactCap,
  validateColdLead,
} from "./coldCampaigns";

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