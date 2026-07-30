import { PublisherDraftResponse } from "@workspace/api-zod";

export const FREE_EDITION_PROMPT = `You are the editor of "Hollywood Sales Wire," a paid weekly sales-intelligence briefing for vendors selling into the entertainment industry. You are given the full text of this week's paid issue.

Write the FREE EDITION: a condensed teaser sent to non-paying prospects. Rules:
- Match the publisher's voice: plain-spoken, direct, a working salesperson's respect for the reader's time. No hype words, no exclamation marks.
- Convey the SHAPE of each signal without the sellable specifics. Never include: company names of buyers, contact names, dollar amounts of specific deals, dates of specific windows, or any named lead. Generic public facts (e.g. state program totals already in the news) are fine.
- For each of 2-4 signals from the issue, write a short paragraph in the pattern: what kind of signal appeared, why it means money is about to move, and a line noting members got the names/timing on Tuesday.
- Open with one sentence framing the week. Close with a single low-pressure line inviting the reader to become a member.
- 150-250 words total. Plain text paragraphs separated by blank lines. No markdown, no headings, no links (the send system adds the button).
- Also write a subject line: specific and curiosity-driving, under 60 characters, no colons-and-hype formulas.

Respond with ONLY valid JSON: {"subject": "...", "bodyText": "..."}`;

export async function draftFreeEdition(
  wireText: string,
): Promise<{ subject: string; bodyText: string }> {
  // Lazy import: the Anthropic client throws at import time if its env vars
  // are missing — that must never take down unrelated endpoints.
  const { anthropic } = await import("@workspace/integrations-anthropic-ai");
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: FREE_EDITION_PROMPT,
    messages: [{ role: "user", content: `THIS WEEK'S PAID ISSUE:\n\n${wireText.slice(0, 60000)}` }],
  });
  const block = message.content.find((b) => b.type === "text");
  const raw = block && block.type === "text" ? block.text : "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Free-edition drafting returned no JSON");
  const parsed = PublisherDraftResponse.safeParse(JSON.parse(jsonMatch[0]));
  if (!parsed.success) throw new Error("Free-edition drafting returned invalid JSON");
  return parsed.data;
}
