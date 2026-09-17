import { Loader2, ExternalLink, Clapperboard } from "lucide-react";
import type { PublisherProductionStagesList } from "@workspace/api-client-react";

interface ProductionStagesSectionProps {
  isLoading: boolean;
  isError: boolean;
  data: PublisherProductionStagesList | undefined;
}

/**
 * "Estimated Production Stages" panel on the publisher console. Renders
 * tracked projects (entity formations / incentive awards) with their
 * modeled hiring/vendor-buying stage. Split out from PublisherPage so it can
 * be exercised directly in tests without wiring every other console query.
 */
export function ProductionStagesSection({ isLoading, isError, data }: ProductionStagesSectionProps) {
  return (
    <div className="bg-card border border-border p-6 mb-6 shadow-sm">
      <h2 className="font-serif font-bold text-lg mb-1">Estimated Production Stages</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Tracked projects from entity formations and state incentive awards, with a
        modeled estimate of which hiring/vendor-buying window they're likely in based on
        elapsed time since their trigger date. These are internal timeline estimates, not
        confirmed hiring status — always verify before treating a project as an active
        lead.
      </p>

      {isLoading && (
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </p>
      )}

      {isError && (
        <p className="text-sm text-red-700">Could not load tracked projects — please try again.</p>
      )}

      {data && data.projects.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No tracked projects currently fall within the modeled stage window.
        </p>
      )}

      {data && data.projects.length > 0 && (
        <div className="space-y-3">
          {data.projects.map((p) => (
            <div
              key={`${p.sourceType}:${p.jurisdiction}:${p.name}`}
              className="border border-border p-4 bg-background"
              data-testid={`row-production-stage-${p.name}`}
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3">
                  <Clapperboard className="w-5 h-5 flex-shrink-0 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.jurisdiction} &middot;{" "}
                      {p.sourceType === "incentive_award" ? "Incentive award" : "Entity formation"}{" "}
                      &middot; {new Date(p.triggerDate).toLocaleDateString()} ({p.weeksSinceTrigger}w ago)
                    </p>
                  </div>
                </div>
                <a
                  href={p.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline flex-shrink-0"
                >
                  <ExternalLink className="w-3 h-3" /> Source
                </a>
              </div>
              <div className="mt-3 border-t border-border pt-3">
                <p className="text-xs font-mono-data tracking-widest text-amber-700 mb-1">
                  MODELED ESTIMATE — NOT CONFIRMED
                </p>
                <p className="text-sm">
                  Estimated stage: <span className="font-medium">{p.stage}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Likely buying window: {p.vendorWindow}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
