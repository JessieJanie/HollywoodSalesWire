import { db, socialDraftsTable } from "@workspace/db";

/**
 * Claim a social-draft slot (kind + week) exactly once across autoscale
 * instances. A fresh claim inserts a `pending` row; an existing row is never
 * taken over automatically because a stale pending row may represent a
 * successful Typefully POST whose response or database update was lost.
 * `scheduled`/`published`/`failed` rows are terminal for slot claiming. The
 * scheduler separately verifies scheduled posts and repairs legacy `pushed`
 * rows that Typefully explicitly reports as planned.
 *
 * Stale pending rows are failed and notified by the scheduler for manual
 * reconciliation, which is the only duplicate-safe choice without a provider
 * idempotency key.
 */
export async function claimSocialDraft(kind: string, weekKey: string): Promise<{ id: number } | null> {
  const [inserted] = await db
    .insert(socialDraftsTable)
    .values({ kind, weekKey })
    .onConflictDoNothing({ target: [socialDraftsTable.kind, socialDraftsTable.weekKey] })
    .returning({ id: socialDraftsTable.id });
  return inserted ?? null;
}
