import { and, eq, lte, sql } from "drizzle-orm";
import { db, socialDraftsTable } from "@workspace/db";

/**
 * Claim a social-draft slot (kind + week) exactly once across autoscale
 * instances, with lease semantics: a fresh claim inserts a `pending` row; a
 * `pending` row older than the lease (a crash mid-push) can be taken over.
 * `pushed`/`failed` rows are terminal — never retried automatically.
 *
 * The push itself has a hard 2-minute cancellation deadline (see typefully.ts),
 * so by the time a 30-minute lease expires no in-flight work from the previous
 * claimant can still create a duplicate Typefully draft.
 */
const CLAIM_LEASE_MS = 30 * 60 * 1000;

export async function claimSocialDraft(kind: string, weekKey: string): Promise<{ id: number } | null> {
  const [inserted] = await db
    .insert(socialDraftsTable)
    .values({ kind, weekKey })
    .onConflictDoNothing({ target: [socialDraftsTable.kind, socialDraftsTable.weekKey] })
    .returning({ id: socialDraftsTable.id });
  if (inserted) return inserted;

  // Take over a stale pending row (crashed claimant). Refreshing createdAt is
  // the fence: another concurrent takeover's WHERE clause will no longer match.
  const staleBefore = new Date(Date.now() - CLAIM_LEASE_MS);
  const [takenOver] = await db
    .update(socialDraftsTable)
    .set({ createdAt: sql`now()` })
    .where(
      and(
        eq(socialDraftsTable.kind, kind),
        eq(socialDraftsTable.weekKey, weekKey),
        eq(socialDraftsTable.status, "pending"),
        lte(socialDraftsTable.createdAt, staleBefore),
      ),
    )
    .returning({ id: socialDraftsTable.id });
  return takenOver ?? null;
}
