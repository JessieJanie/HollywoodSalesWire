---
name: Production-stage timing model calibration
description: Why productionStage.ts uses two different STAGE_SCHEDULEs (entity_formation vs incentive_award) instead of one shared schedule.
---

Spot-checked Sept 15, 2026 against real evidence (research, not HSW project data — actual formation/award data hadn't resumed flowing yet):

- **Entity formation → production**: entertainment-law guidance describes forming the single-purpose production LLC as a hard requirement immediately before pre-production (payroll, insurance, locations, cast deals all require the entity to exist). So a trigger-date-of-formation schedule where week 0 ≈ start of pre-production hiring is realistic. Left unchanged.
- **Incentive award → production**: this runs on a materially later clock than formation. California's tax-credit regulation (10 CCR §5521(o)) allows up to 180 days (~26 weeks) after the Credit Allocation Letter before principal photography must start ($100M+ productions get up to 240 days/~34 weeks). A real example (CBS's "Tracker" S4: CA tax credit awarded March 9, 2026, filming began late June 2026) showed ~15 weeks between award and shoot start — not the ~6 weeks a single shared schedule assumed.

**Why:** awards are typically granted once a production already has financing and a target start date lined up, so the hiring/shoot sequence trails the award far more than it trails the entity's own formation date. A single shared schedule for both trigger types was systematically too fast for incentive-award-triggered projects.

**How to apply:** `estimateStage()` in `artifacts/api-server/src/lib/productionStage.ts` takes the trigger's `sourceType` and picks between `STAGE_SCHEDULE` (entity_formation) and `INCENTIVE_AWARD_STAGE_SCHEDULE` (incentive_award) accordingly. If real HSW project outcomes later show either schedule is still off, tighten the specific schedule rather than re-merging them — the two trigger types are not interchangeable.
