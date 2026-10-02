import { describe, expect, it } from "vitest";
import { SKIM_PROSPECTS } from "./skimProspects";
import { validateColdLead } from "./coldCampaigns";

describe("SKIM_PROSPECTS pool", () => {
  it("contains only valid, unique named prospects", () => {
    const emails = new Set<string>();
    for (const lead of SKIM_PROSPECTS) {
      expect(validateColdLead(lead), lead.email).toBeNull();
      expect(emails.has(lead.email)).toBe(false);
      emails.add(lead.email);
    }
  });
});
