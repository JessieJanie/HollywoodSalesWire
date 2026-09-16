import { describe, expect, it } from "vitest";
import {
  STAGE_SCHEDULE,
  INCENTIVE_AWARD_STAGE_SCHEDULE,
  estimateStage,
  looksLikeProductionEntity,
  formatProjectStages,
  type TrackedProjectStage,
} from "./productionStage";

function expectNoGapsOrOverlaps(schedule: { startWeek: number; endWeek: number }[]) {
  const sorted = [...schedule].sort((a, b) => a.startWeek - b.startWeek);
  expect(sorted[0]!.startWeek).toBe(0);
  for (let i = 1; i < sorted.length; i++) {
    expect(sorted[i]!.startWeek).toBe(sorted[i - 1]!.endWeek);
  }
}

describe("stage schedule", () => {
  it("covers zero weeks with no gaps or overlaps (entity_formation schedule)", () => {
    expectNoGapsOrOverlaps(STAGE_SCHEDULE);
  });

  it("covers zero weeks with no gaps or overlaps (incentive_award schedule)", () => {
    expectNoGapsOrOverlaps(INCENTIVE_AWARD_STAGE_SCHEDULE);
  });
});

describe("estimateStage", () => {
  const trigger = new Date("2026-01-01T00:00:00Z");

  it("returns the first stage at week zero", () => {
    expect(estimateStage(trigger, trigger)?.stage).toBe("Pre-production leadership");
  });

  it("advances to crew build-out after the first stage ends", () => {
    const now = new Date(trigger.getTime() + 3 * 7 * 24 * 3600 * 1000);
    expect(estimateStage(trigger, now)?.stage).toBe("Crew build-out");
  });

  it("advances to equipment & vendor sourcing in that window", () => {
    const now = new Date(trigger.getTime() + 5 * 7 * 24 * 3600 * 1000);
    expect(estimateStage(trigger, now)?.stage).toBe("Equipment & vendor sourcing");
  });

  it("reaches post-production well after the shoot", () => {
    const now = new Date(trigger.getTime() + 20 * 7 * 24 * 3600 * 1000);
    expect(estimateStage(trigger, now)?.stage).toBe("Post-production");
  });

  it("returns null once past the modeled schedule horizon", () => {
    const now = new Date(trigger.getTime() + 60 * 7 * 24 * 3600 * 1000);
    expect(estimateStage(trigger, now)).toBeNull();
  });

  it("never returns a negative elapsed time for a future-dated trigger", () => {
    const future = new Date(trigger.getTime() + 7 * 24 * 3600 * 1000);
    expect(estimateStage(future, trigger)?.weeksSinceTrigger).toBe(0);
  });

  it("times incentive-award triggers on a later clock than entity formations", () => {
    // Real spot-check: CA awarded Tracker S4 its tax credit ~15 weeks before
    // filming started. Under the entity_formation schedule that gap already
    // reads as post-production; under incentive_award it correctly reads
    // as still in production.
    const now = new Date(trigger.getTime() + 15 * 7 * 24 * 3600 * 1000);
    expect(estimateStage(trigger, now, "entity_formation")?.stage).toBe("Post-production");
    expect(estimateStage(trigger, now, "incentive_award")?.stage).toBe("Production");
  });

  it("defaults to the entity_formation schedule when sourceType is omitted", () => {
    const now = new Date(trigger.getTime() + 3 * 7 * 24 * 3600 * 1000);
    expect(estimateStage(trigger, now)?.stage).toBe("Crew build-out");
  });
});

describe("looksLikeProductionEntity", () => {
  it.each([
    "Doodle Girl S2 Productions LLC",
    "Wizard Pictures Inc",
    "Some Films Ltd",
    "Nightbird Studios LLC",
    "Riverside Post LLC",
  ])("accepts %s", (name) => {
    expect(looksLikeProductionEntity(name)).toBe(true);
  });

  it.each(["Aimcreative Ltd", "Riverside Wellness LLC", "Bright Consulting Group"])(
    "rejects %s",
    (name) => {
      expect(looksLikeProductionEntity(name)).toBe(false);
    },
  );
});

describe("formatProjectStages", () => {
  it("states the estimate caveat and never sums across projects", () => {
    const projects: TrackedProjectStage[] = [
      {
        sourceType: "entity_formation",
        name: "Doodle Girl S3 Productions LLC",
        jurisdiction: "NY",
        sourceUrl: "https://example.com/ny/1",
        triggerDate: "2026-08-01T00:00:00Z",
        stage: "Post-production",
        vendorWindow: "assistant editors, VFX, sound, ADR, color, composer/mix",
        weeksSinceTrigger: 16,
      },
    ];
    const md = formatProjectStages(projects);
    expect(md).toContain("MODELED ESTIMATE");
    expect(md).toContain("Never sum or compare counts");
    expect(md).toContain("Doodle Girl S3 Productions LLC");
    expect(md).toContain("Post-production");
  });

  it("reports no tracked projects rather than fabricating a stage", () => {
    expect(formatProjectStages([])).toContain("No tracked projects");
  });
});
