import { describe, expect, it } from "vitest";
import { validateColdLead } from "./coldCampaigns";

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