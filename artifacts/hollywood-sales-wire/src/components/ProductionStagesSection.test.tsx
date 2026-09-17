import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProductionStagesSection } from "./ProductionStagesSection";
import type { PublisherProductionStagesList } from "@workspace/api-client-react";

const SAMPLE_DATA: PublisherProductionStagesList = {
  projects: [
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
  ],
};

describe("ProductionStagesSection", () => {
  it("renders jurisdiction, trigger type/date, estimated stage, and the modeled-estimate disclaimer", () => {
    render(<ProductionStagesSection isLoading={false} isError={false} data={SAMPLE_DATA} />);

    expect(screen.getByText("Estimated Production Stages")).toBeInTheDocument();
    expect(screen.getByText("Doodle Girl S3 Productions LLC")).toBeInTheDocument();

    // Jurisdiction and trigger type/date render together in the project's summary line.
    const summary = screen.getByText(/NY/).closest("p");
    expect(summary).toHaveTextContent("NY");
    expect(summary).toHaveTextContent("Entity formation");
    expect(summary).toHaveTextContent(new Date("2026-08-01T00:00:00Z").toLocaleDateString());
    expect(summary).toHaveTextContent("16w ago");

    // Estimated stage.
    expect(screen.getByText("Post-production")).toBeInTheDocument();
    expect(screen.getByText(/Likely buying window:/)).toHaveTextContent(
      "assistant editors, VFX, sound, ADR, color, composer/mix",
    );

    // The disclaimer must stay visible verbatim.
    expect(screen.getByText("MODELED ESTIMATE — NOT CONFIRMED")).toBeInTheDocument();
  });

  it("renders an incentive award's source type distinctly from an entity formation", () => {
    const data: PublisherProductionStagesList = {
      projects: [
        {
          sourceType: "incentive_award",
          name: "Riverside Feature",
          jurisdiction: "GA",
          sourceUrl: "https://example.com/ga/1",
          triggerDate: "2026-07-01T00:00:00Z",
          stage: "Crew build-out",
          vendorWindow: "DP, gaffer, grip, camera, wardrobe, art department",
          weeksSinceTrigger: 3,
        },
      ],
    };
    render(<ProductionStagesSection isLoading={false} isError={false} data={data} />);
    expect(screen.getByText(/Incentive award/)).toBeInTheDocument();
  });

  it("shows its own empty-state message rather than breaking when there are no tracked projects", () => {
    render(<ProductionStagesSection isLoading={false} isError={false} data={{ projects: [] }} />);

    expect(screen.getByText("Estimated Production Stages")).toBeInTheDocument();
    expect(
      screen.getByText("No tracked projects currently fall within the modeled stage window."),
    ).toBeInTheDocument();
    expect(screen.queryByText("MODELED ESTIMATE — NOT CONFIRMED")).not.toBeInTheDocument();
  });

  it("shows a loading state without rendering stale project rows or the error message", () => {
    render(<ProductionStagesSection isLoading={true} isError={false} data={undefined} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByText(/Could not load tracked projects/)).not.toBeInTheDocument();
  });

  it("shows the error state when the request fails", () => {
    render(<ProductionStagesSection isLoading={false} isError={true} data={undefined} />);
    expect(screen.getByText("Could not load tracked projects — please try again.")).toBeInTheDocument();
  });
});
