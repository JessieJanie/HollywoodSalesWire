import { describe, expect, it } from "vitest";
import { resolveFoundingDeadline } from "./foundingDeadline";
import { publicOfferBanner } from "./publicOfferBanner";

const NOW = new Date("2026-11-15T18:00:00.000Z");

describe("publicOfferBanner", () => {
  it("stays neutral when ?d= is missing, malformed, or already past", () => {
    expect(publicOfferBanner(null)).toBe("loading");
    expect(publicOfferBanner(resolveFoundingDeadline(NOW, null))).toBe("neutral");
    expect(publicOfferBanner(resolveFoundingDeadline(NOW, "nope"))).toBe("neutral");
    expect(publicOfferBanner(resolveFoundingDeadline(NOW, "2026-11-01"))).toBe("neutral");
  });

  it("shows the founding banner only for a valid open link", () => {
    expect(publicOfferBanner(resolveFoundingDeadline(NOW, "2026-11-20"))).toBe("founding");
  });
});
