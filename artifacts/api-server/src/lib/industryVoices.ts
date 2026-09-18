/**
 * "Industry Voices" queue — named opinions from industry figures that
 * Karilyn wants surfaced in the paid Wire as clearly attributed commentary.
 * See lib/db/src/schema/industryVoices.ts for the design rationale.
 */

import { and, eq, isNull, inArray } from "drizzle-orm";
import { db, industryVoicesTable } from "@workspace/db";

export async function queueIndustryVoice(input: {
  source: string;
  sourceUrl?: string;
  excerpt: string;
}): Promise<void> {
  await db.insert(industryVoicesTable).values({
    source: input.source,
    sourceUrl: input.sourceUrl ?? null,
    excerpt: input.excerpt,
  });
}

export async function getPendingIndustryVoices() {
  return db
    .select()
    .from(industryVoicesTable)
    .where(isNull(industryVoicesTable.usedInWeekKey));
}

export async function markIndustryVoicesUsed(ids: number[], weekKey: string): Promise<void> {
  if (ids.length === 0) return;
  await db
    .update(industryVoicesTable)
    .set({ usedInWeekKey: weekKey })
    .where(and(inArray(industryVoicesTable.id, ids), isNull(industryVoicesTable.usedInWeekKey)));
}

export function formatIndustryVoicesForPrompt(
  voices: Array<{ source: string; sourceUrl: string | null; excerpt: string }>,
): string {
  if (voices.length === 0) return "";
  return (
    `\n\nINDUSTRY VOICES QUEUE (attributed opinion the publisher wants shared this issue — NOT verified research; ` +
    `see the INDUSTRY VOICES section rule below for how to use these):\n\n` +
    voices
      .map(
        (v, i) =>
          `--- VOICE ${i + 1} ---\nSOURCE: ${v.source}${v.sourceUrl ? `\nURL: ${v.sourceUrl}` : ""}\nTEXT:\n${v.excerpt}`,
      )
      .join("\n\n")
  );
}
