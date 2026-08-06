# Agora Style Guidelines — Hollywood Sales Wire ("The Agora Bible")

Karilyn's collected Agora-model writing guidelines. Each set governs a different
email/publication. The drafting prompts in the code must stay consistent with
these; when a guideline and a prompt disagree, fix the prompt.

Where each set is applied today:
- **Free HSW Weekly Brief** → `artifacts/api-server/src/lib/freeEdition.ts` (FREE_EDITION_PROMPT)
- **Paid HSW Weekly Wire issue** → `artifacts/api-server/src/lib/wireResearch.ts` (WIRE_PROMPT)
- **Founding-Offer sales series** → publisher-locked copy in the evergreen email sequence
- **Paid delivery email (this document, section below)** → `artifacts/api-server/src/lib/sendWire.ts` (paidWireHtml cover note)

---

## Set: Free brief for non-subscribers (added Aug 6, 2026)

Provided by Karilyn. Written originally for RIA Wire's free monthly brief;
applies to the free HSW Weekly Brief sent to prospects. Goal: convert prospects
into paid subscribers without turning the free issue into a hard-sell flyer.
Agora's model worked because the free letter felt like a real publication, not
a lead magnet — readers stayed for the voice and insight; the paid offer felt
like the natural next step.

### 1. Treat the free brief as a real product
Give real value every issue; if it's thin or purely promotional, people
unsubscribe and never buy. The free brief should prove: "these people read the
public record the way a salesperson needs it read." Do not give away the full
paid method (named buying centers, full prospect lists). Give the frame, a few
concrete examples, and the feeling that more exists behind the wall.
**Agora rule:** the free letter makes the reader smarter; the paid product
makes them dangerous.

### 2. Lead with the world, not with your offer
Open like a letter from someone who watches the industry, not like a SaaS
onboarding email. Good openers: a specific filing or pattern noticed, a quiet
absurdity in how industry data is sold or used, a small story implying a
larger sales truth. Weak openers: "This month's top trends…", "Don't miss our
special offer…", "As a valued subscriber…". The reader should feel they're
reading intelligence, not being processed.

### 3. One clear idea per issue
Agora free letters rarely covered everything — they drove one insight hard.
Pick one (e.g. why most lists are already decaying; why timing beats a bigger
list; why public filings are fresher than vendor directories; why the "easy"
data is the late data), then illustrate with 2–4 concrete, filing-based
examples. Specificity sells; a general industry overview does not.

### 4. Teach the category, not the full system
The free brief should repeatedly install this belief: the useful information
is public; most people don't read it the right way; reading it late is almost
the same as not reading it. Once that belief is in place, the paid
subscription becomes the tool that keeps the reading current.

### 5. Soft-sell structure (classic Agora rhythm)
Observation/story (the hook) → what it means for someone selling into the
market → a few concrete examples (filings, patterns, timing) → the implication
(why the casual approach fails) → quiet commercial turn (one short paragraph)
→ clean close + single CTA. The pitch should feel like a logical conclusion,
not an interruption. Example soft turn: "The filings keep coming. The useful
window stays short. The free brief can show you the shape of the thing. The
wire is how you stay inside the window." One CTA. Not four.

### 6. Voice rules (Bonner lane)
Sound like a person, not a brand committee. Prefer concrete over abstract. A
little skepticism toward conventional "lists" and "databases." No hype
adjectives ("revolutionary," "game-changing," "unlock"). Occasional dry humor
is an asset; forced jokes are not. Short paragraphs, readable on a phone. The
free brief should feel like a lighter cousin of the editorial articles, not a
corporate digest.

### 7. Conversion mechanics
- Cadence: reliable beats frequent — missed issues kill trust.
- CTA frequency: one primary CTA near the end; optional second soft mention
  mid-issue if natural.
- CTA style: invitation, not urgency theater. "If you want the ongoing read…"
  beats "LAST CHANCE."
- Proof: public-record specificity. Agora sold with stories and examples more
  than feature grids.
- Segment lightly: opens-but-never-clicks → keep educating; clicked the paid
  link twice → warm, let the sales page do the rest.
- No fake scarcity: B2B sales intel converts better with credibility than
  countdown timers.

### 8. What not to do
- Don't turn every free issue into a brochure for the paid wire.
- Don't dump raw filing tables with no interpretation.
- Don't promise "leads" in the free letter if the paid product is intelligence
  (sell the map, not a fantasy of easy names).
- Don't change voice between free and paid — the paid offer should feel like
  more of the same mind.
- Don't hide the pitch completely either; Agora always made the commercial
  path visible.

### 9. Reusable template
Subject: curiosity + specificity (e.g. "The Quiet Fiction About RIA Lists",
"Why Most Salespeople Arrive Late"). Body: 2–4 paragraph opener (scene or
filing-based observation) → one core insight → 2–4 short examples from the
public record → "what this means if you sell into this market" → one soft
paragraph on the paid wire → sign-off as publisher → single link.

### 10. The Agora conversion logic in one line
Free letter: "See the world the way we see it." Paid product: "Get the ongoing
instrument that makes that view useful every week." Free brief = pattern
recognition from the public record + sales implication; paid wire = the
continuous, working version of that same method.

---

## Set: Paid-subscriber delivery email (added Aug 6, 2026)

Provided by Karilyn. Written originally for RIA Wire's monthly file delivery;
applies to the HSW weekly paid Wire delivery email. "Files" = the week's issue.

### 1. Fulfillment first, personality second
Agora paid letters still had voice, but they did not make the customer hunt for
what they paid for. Lead with the delivery: what's ready, what release/week,
what is included, clear links. Then add interpretation, texture, and tips.
**Rule:** a subscriber should be able to get what they paid for in under 20
seconds, even if they skip the prose.

### 2. Make the subscriber feel smart for having bought
Quietly reinforce: you are working from the current release; most others are
not; that is why this subscription exists. Do this with facts and framing — not
with "thank you for being a valued customer." Agora rarely flattered. It
confirmed the reader's judgment.

### 3. One useful idea, not a second newsletter
The delivery email can include a short intelligence layer: what moved, what to
call first, one practical sort/filter, one retention or team-seat mention if
natural. It should not become another long essay. They already bought; help
them use it. Ideal shape: delivery + links → this period in the data (compact)
→ optional longer view (2–4 bullets) → how to use it (actionable) → soft
secondary offer only if relevant → sign-off + one practical P.S.

### 4. Voice: still Bonner, slightly more direct
Keep the dry, specific voice. Slightly less philosophical than the free brief.
More "here's the map; here's where to start." No hard sell; no urgency theater;
no corporate onboarding language. Tone target: a competent publisher handing
over the period's instrument — not a customer-success sequence.

### 5. Data presentation rules
Lead with the numbers that change behavior (new registrants, threshold
crossings, exits, shifts). Name one or two vivid examples if useful. Keep full
ranked lists only if they are part of the paid value and readable in email.
Always separate commentary from the deliverable. Remind them the material is
personal / not for forwarding if that matters operationally.

### 6. Teach usage every issue
Agora retained by making the product habitual. Include a short recurring
"getting the most from this issue" section: where to start, how to sort, one
play to run today. This does more for renewal than a paragraph of appreciation.

### 7. Commercial rules for an already-paid list
- Primary job: deliver + make it usable.
- Secondary job: reinforce why the subscription is worth keeping.
- Upsell: soft, rare, relevant (e.g. Team seat for colleagues).
- CTA count: the deliverable first; one optional secondary CTA max.
- Scarcity: almost never — paid users dislike fake pressure.
- Length: long enough to orient; short enough to scan on a phone.

### 8. What not to do
- Don't bury the deliverable under a long essay.
- Don't rewrite the free brief and paste it into the paid email.
- Don't over-explain the sourcing process every issue.
- Don't sound grateful in a needy way.
- Don't introduce new offers that distract from this issue.
- Don't shift voice from the free brief so sharply it feels like two companies.

### 9. Reliable template
Subject: specific + useful (e.g. "34 firms crossed $100M — your 2026-08 files
are ready"). Body: hello + delivery ready (1–2 lines) → one-sentence
positioning → this period in the data (bullets) → optional longer view → the
deliverable (named links, clean) → gainers/declines only if scannable →
getting the most from it (3–5 practical lines) → soft Team note only when
natural → sign-off → P.S. with one practical tip.

### 10. The Agora retention logic in one line
Free brief: "See the world the way we see it."
Paid delivery: "Here is this period's instrument — and how to put it to work
before the window closes." The subscriber email should feel like: the release
landed, we cleaned it, here it is, here's what moved, here's who to call first.
Agora kept people not by entertaining them after the sale, but by making the
paid product feel indispensable in use.
