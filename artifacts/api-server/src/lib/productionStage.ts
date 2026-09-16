import { eq, and, lt } from "drizzle-orm";
import { db, projectSignalsTable } from "@workspace/db";

const WEEK_MS = 7 * 24 * 3600 * 1000;

export type ProjectSignalSourceType = "entity_formation" | "incentive_award";

export interface ProductionStage {
  stage: string;
  vendorWindow: string;
  startWeek: number;
  /** Exclusive — the next stage takes over at this week. */
  endWeek: number;
}

/**
 * Approximate industry-standard hiring/vendor sequence after a project's
 * ENTITY-FORMATION date. Production attorneys treat forming the single-purpose
 * LLC as a hard requirement right before pre-production — it has to exist
 * before payroll, insurance, location, and cast deals can be signed — so
 * week 0 lining up with the start of pre-production hiring matches how
 * formations are actually timed in practice. These are modeled estimates
 * from typical production timelines, not verified per-project facts — every
 * consumer of `estimateStage` must present them as an estimated window, never
 * as confirmed current hiring status for a named project.
 *
 * Spot-checked Sept 15, 2026 against industry guidance on LLC-formation
 * timing (entertainment-law sources describe formation as immediately
 * preceding pre-production, not weeks ahead of it) — left unchanged for
 * entity_formation triggers. See INCENTIVE_AWARD_STAGE_SCHEDULE below: the
 * same weeks-from-trigger numbers do NOT hold for incentive-award triggers,
 * which run on a materially later clock.
 */
export const STAGE_SCHEDULE: ProductionStage[] = [
  { stage: "Pre-production leadership", vendorWindow: "line producer, UPM, 1st AD, location manager, production designer, casting", startWeek: 0, endWeek: 2 },
  { stage: "Crew build-out", vendorWindow: "DP, gaffer, grip, camera, wardrobe, art department", startWeek: 2, endWeek: 4 },
  { stage: "Equipment & vendor sourcing", vendorWindow: "camera packages, grip/lighting rental, stages, generators", startWeek: 4, endWeek: 6 },
  { stage: "Production", vendorWindow: "full crew, background talent; editor typically attaches near wrap", startWeek: 6, endWeek: 14 },
  { stage: "Post-production", vendorWindow: "assistant editors, VFX, sound, ADR, color, composer/mix", startWeek: 14, endWeek: 30 },
  { stage: "Distribution & marketing", vendorWindow: "delivery, marketing/publicity vendors", startWeek: 30, endWeek: 52 },
];

/**
 * Same stage sequence, re-timed for an INCENTIVE-AWARD trigger date.
 *
 * Spot-check findings (Sept 15, 2026) that justified shifting this schedule
 * later than STAGE_SCHEDULE:
 * - California's tax-credit regulation (10 CCR §5521(o)) gives an approved
 *   production up to 180 calendar days (~26 weeks) after its Credit
 *   Allocation Letter — the incentive-award trigger — before principal
 *   photography must start; $100M+ productions get up to 240 days (~34
 *   weeks). That alone rules out a shoot starting by week 6, which is what
 *   the shared STAGE_SCHEDULE assumed for every trigger type.
 * - Real example: CBS's "Tracker" season 4 was awarded a $48M California tax
 *   credit on March 9, 2026, and began filming in Los Angeles in late June
 *   2026 (Deadline, May 5 2026; corroborated by TV Insider/IMDb coverage of
 *   the CBS upfronts announcement) — about 15 weeks after the award, not
 *   the ~6 weeks previously modeled.
 * Awards are granted once a production already has financing and a target
 * start date lined up, so the hiring/shoot sequence trails the award by
 * more than it trails an entity's own formation. This schedule stretches
 * every stage out to land inside the observed ~15–26 week award-to-shoot
 * range; re-check and tighten it as more real award→shoot date pairs turn
 * up once entity-formation/incentive-award data resumes flowing.
 */
export const INCENTIVE_AWARD_STAGE_SCHEDULE: ProductionStage[] = [
  { stage: "Pre-production leadership", vendorWindow: "line producer, UPM, 1st AD, location manager, production designer, casting", startWeek: 0, endWeek: 4 },
  { stage: "Crew build-out", vendorWindow: "DP, gaffer, grip, camera, wardrobe, art department", startWeek: 4, endWeek: 8 },
  { stage: "Equipment & vendor sourcing", vendorWindow: "camera packages, grip/lighting rental, stages, generators", startWeek: 8, endWeek: 13 },
  { stage: "Production", vendorWindow: "full crew, background talent; editor typically attaches near wrap", startWeek: 13, endWeek: 24 },
  { stage: "Post-production", vendorWindow: "assistant editors, VFX, sound, ADR, color, composer/mix", startWeek: 24, endWeek: 40 },
  { stage: "Distribution & marketing", vendorWindow: "delivery, marketing/publicity vendors", startWeek: 40, endWeek: 60 },
];

function scheduleForSourceType(sourceType: ProjectSignalSourceType): ProductionStage[] {
  return sourceType === "incentive_award" ? INCENTIVE_AWARD_STAGE_SCHEDULE : STAGE_SCHEDULE;
}

export interface StageEstimate {
  stage: string;
  vendorWindow: string;
  weeksSinceTrigger: number;
}

/**
 * Estimate which buying window a project is likely in, given its trigger date.
 * `sourceType` picks which schedule applies (entity formations and incentive
 * awards run on different clocks — see INCENTIVE_AWARD_STAGE_SCHEDULE above);
 * defaults to the entity-formation schedule for backward compatibility.
 * Null once past the modeled schedule.
 */
export function estimateStage(
  triggerDate: Date,
  now: Date = new Date(),
  sourceType: ProjectSignalSourceType = "entity_formation",
): StageEstimate | null {
  const weeksSinceTrigger = Math.max(0, (now.getTime() - triggerDate.getTime()) / WEEK_MS);
  const schedule = scheduleForSourceType(sourceType);
  const stage = schedule.find((s) => weeksSinceTrigger >= s.startWeek && weeksSinceTrigger < s.endWeek);
  if (!stage) return null;
  return { stage: stage.stage, vendorWindow: stage.vendorWindow, weeksSinceTrigger };
}

const SCHEDULE_HORIZON_WEEKS = Math.max(
  STAGE_SCHEDULE[STAGE_SCHEDULE.length - 1]!.endWeek,
  INCENTIVE_AWARD_STAGE_SCHEDULE[INCENTIVE_AWARD_STAGE_SCHEDULE.length - 1]!.endWeek,
);

/** Heuristic second-pass filter — keep only names that read like a production entity, not incidental noise. */
export function looksLikeProductionEntity(name: string): boolean {
  return /\b(productions?|pictures?|films?|studios?|media|entertainment|post|vfx|television|tv)\b/i.test(name);
}

interface RecordSignalInput {
  sourceType: ProjectSignalSourceType;
  name: string;
  jurisdiction: string;
  triggerDate: Date;
  sourceUrl: string;
  weekKey: string;
}

/** Upsert a project trigger so later weeks can compute its elapsed-time stage. */
export async function recordProjectSignal(input: RecordSignalInput): Promise<void> {
  await db
    .insert(projectSignalsTable)
    .values({
      sourceType: input.sourceType,
      name: input.name,
      jurisdiction: input.jurisdiction,
      triggerDate: input.triggerDate,
      sourceUrl: input.sourceUrl,
      firstSeenWeekKey: input.weekKey,
    })
    .onConflictDoUpdate({
      target: [projectSignalsTable.sourceType, projectSignalsTable.jurisdiction, projectSignalsTable.name],
      set: { sourceUrl: input.sourceUrl },
    });
}

/** Drop signals too old to produce a meaningful stage estimate. */
export async function pruneExpiredProjectSignals(now: Date = new Date()): Promise<void> {
  const cutoff = new Date(now.getTime() - SCHEDULE_HORIZON_WEEKS * WEEK_MS);
  await db.delete(projectSignalsTable).where(lt(projectSignalsTable.triggerDate, cutoff));
}

export interface TrackedProjectStage {
  sourceType: ProjectSignalSourceType;
  name: string;
  jurisdiction: string;
  sourceUrl: string;
  triggerDate: string;
  stage: string;
  vendorWindow: string;
  weeksSinceTrigger: number;
}

/** All currently tracked projects with their estimated stage, for the weekly digest. */
export async function listTrackedProjectStages(now: Date = new Date()): Promise<TrackedProjectStage[]> {
  const rows = await db.select().from(projectSignalsTable);
  const results: TrackedProjectStage[] = [];
  for (const row of rows) {
    const estimate = estimateStage(row.triggerDate, now, row.sourceType as ProjectSignalSourceType);
    if (!estimate) continue;
    results.push({
      sourceType: row.sourceType as ProjectSignalSourceType,
      name: row.name,
      jurisdiction: row.jurisdiction,
      sourceUrl: row.sourceUrl,
      triggerDate: row.triggerDate.toISOString(),
      stage: estimate.stage,
      vendorWindow: estimate.vendorWindow,
      weeksSinceTrigger: Math.round(estimate.weeksSinceTrigger * 10) / 10,
    });
  }
  return results.sort((a, b) => a.weeksSinceTrigger - b.weeksSinceTrigger);
}

/** Build the markdown block handed to the weekly Wire drafting prompt. */
export function formatProjectStages(projects: TrackedProjectStage[]): string {
  const header =
    `MODELED ESTIMATE — this is an internal timeline model applied to formation/award dates, not a confirmed hiring status for any named project. ` +
    `Report each line as "a project at this stage would typically be entering its <window> window" — never as a confirmed current job opening or guaranteed budget. ` +
    `Never sum or compare counts across stages or jurisdictions; each project's estimate stands alone.\n\n`;
  if (projects.length === 0) return `${header}No tracked projects currently fall within the modeled stage window.`;
  return (
    header +
    projects
      .map(
        (p) =>
          `- [${p.jurisdiction}] ${p.name} (${p.sourceType === "incentive_award" ? "incentive award" : "entity formation"}, ${p.triggerDate.slice(0, 10)}, ${p.weeksSinceTrigger}w ago) → estimated stage: ${p.stage} — likely buying window: ${p.vendorWindow}\n  ${p.sourceUrl}`,
      )
      .join("\n")
  );
}
