/**
 * Cold outreach campaign creation — Instantly API.
 *
 * Called by the scheduler every Tuesday, Wednesday, and Thursday at 8 AM PT.
 * Each run creates one campaign batch in Instantly (status: active), enrolls
 * kerricolegrove@gmail.com so Karilyn sees every email her prospects receive,
 * stores the campaign record in the cold_campaigns table, and auto-ramps the
 * daily send limit based on how many batches have run before.
 *
 * Lead upload is handled by uploadColdLeads() — called from the publisher API
 * endpoint POST /publisher/cold-leads — so neither Karilyn nor another agent
 * needs to touch the Instantly UI.
 *
 * Copy source: marketing/cold-campaign-draft1.txt (publisher-locked).
 * To update copy: edit that file and sync the template strings below.
 */

import { desc, eq } from "drizzle-orm";
import { db, coldCampaignsTable } from "@workspace/db";
import { logger } from "./logger";

const INSTANTLY_BASE = "https://api.instantly.ai/api/v2";
const SENDING_ACCOUNTS = [
  "karilyn@hollywoodsaleswires.com",
  "karilyn@tryhollywoodsaleswire.com",
  "karilyn@hollywood-sales-wire.com",
] as const;

/** Added automatically to every batch so Karilyn sees exactly what prospects receive. */
const MONITOR_EMAIL = "kerricolegrove@gmail.com";
const MONITOR_FIRST = "Karilyn";

/** E1=Day0, E2=+1, E3=+1, E4=+2, E5=+3 → E5 lands on Day 7. */
const STEP_DELAYS = [0, 1, 1, 2, 3] as const;

/**
 * Mailbox daily ceiling — Instantly slow-ramp is enabled at the account level
 * on each HSW sender, so we do NOT set a campaign-level daily_limit. Instantly
 * distributes sends across the campaign's warmed mailboxes and applies each
 * mailbox's own ramp up to 50/day. A campaign cap would override that and
 * starve sending unnecessarily.
 */
const MAILBOX_DAILY_CAP = 50; // informational only — not sent to Instantly API

/** Hard ceiling on prospect leads per batch (Instantly Growth plan cap). */
const PLAN_CONTACT_CAP = 40;

/** Instantly only validates this timezone string; it controls the send window. */
const SCHEDULE_TIMEZONE = "Etc/GMT+12";

// ── Helpers ──────────────────────────────────────────────────────────────────

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function formatDeadline(date: Date): string {
  return date.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** Convert plain-text email body → HTML paragraphs (Instantly silently drops plain text). */
function toHtml(plain: string): string {
  return plain
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

async function instantly<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const apiKey = process.env.INSTANTLY_API_KEY;
  if (!apiKey) throw new Error("INSTANTLY_API_KEY not set");
  const r = await fetch(`${INSTANTLY_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = (await r.json()) as T;
  if (!r.ok)
    throw new Error(`Instantly ${method} ${path} → ${r.status}: ${JSON.stringify(json)}`);
  return json;
}

// ── Email copy (publisher-locked) ────────────────────────────────────────────
// Source: marketing/cold-campaign-draft1.txt
// [DATE TOKEN] → deadlineLabel   |   hsw-cold-1 → batchTag (date-stamped)

function buildEmails(
  deadlineLabel: string,
  batchTag: string,
): Array<{ subj: string; html: string }> {
  const dl = deadlineLabel;
  const tag = batchTag;

  const emails: Array<{ subj: string; plain: string }> = [
    {
      subj: "The lead list your competitors bought is already dead",
      plain: `Hi {{firstName}},

I'm Karilyn Colegrove — I publish Hollywood Sales Wire, a weekly intelligence briefing for vendors selling into the entertainment industry. I found your contact while researching companies active in production-side sales, and I think this will be worth two minutes of your time.

Three weeks ago, California's film office closed the books on the first year of its expanded tax credit: 170 productions awarded, $6.6 billion in direct production spending — including 41 new films greenlit in the final round alone.

Not projections. Not "industry outlook." Awards. Named productions, approved budgets, published on a state list — which means every one of them is now on a clock: crew up, book stages, cut purchase orders, spend the money or lose the credit.

California alone now moves three-quarters of a billion dollars a year through its expanded credit. Georgia doesn't even cap its program. And every production on those award lists is a company that is about to buy things: cameras, stages, software, localization, post, payroll, insurance — the whole supply chain of a budget with a deadline.

Here's the part that should bother you.

The "industry lead lists" your competitors are working from — the $15,000-a-year databases, the festival directories, the scraped LinkedIn exports — were cold before they were ever sold. Six months stale on a good day.

And it's worse than stale: the list companies rent those same names out, over and over, to anyone with a marketing budget. By the time you dial, that contact has been pitched by a dozen vendors, three conferences, and a webinar series. They're not just cold. They're sick of the phone.

Meanwhile the hot list — who got money this month and has to spend it — sits in public filings that almost nobody in sales reads, because reading them is a genuinely tedious skill.

That's the entire idea behind Hollywood Sales Wire: I read the filings, the award lists, the requisitions, and the money flows every week, and every Tuesday you get the names — who just got funded, what they're about to buy, and when the window closes.

Cold leads are a commodity. Hot leads are an edge.

I'm running a Founding Member offer through ${dl}: subscribe by midnight Eastern that night and you're in at $38 a week ($1,995/year) instead of the regular $77 ($3,995). Three Special Reports — worth $1,985 — arrive free the moment you join.

I'll make the full case over the next few days. But if you already know what a two-week-old award list is worth to your pipeline, there's no reason to wait:

https://hollywoodsaleswire.com/?utm_source=cold&utm_medium=email&utm_campaign=${tag}&utm_content=e1

Karilyn Colegrove, Publisher
Hollywood Sales Wire

P.S. One question worth sitting with: when a state publishes a list of 170 funded productions worth $6.6 billion, who in your company is assigned to call those productions first? If the answer is "nobody," that's fixable — by ${dl}.`,
    },
    {
      subj: "Why your close rate is a math problem, not a talent problem",
      plain: `Hi {{firstName}},

Picture two salespeople selling the same product into the same studios.

The first works a purchased list. The names are real. The titles are mostly right. And the information is an average of six months old — which in this business means the budget was allocated, the vendors were chosen, and the purchase orders were cut before she ever dialed. She's not selling. She's leaving voicemails at closed doors.

And there's a second problem nobody at the list company mentioned when they took her $15,000: they didn't sell her those names. They rented them to her — and to everybody else.

The same contacts get rented out again and again. To software vendors. To conference promoters. To "partnership" pitches. To marketers selling things that have nothing to do with production.

So when she finally gets a prospect on the phone, she isn't a salesperson to him. She's the fourteenth interruption this week. He was jaded before she said her own name.

The second rep works a different list: productions that appeared on a state tax-credit award list within the last two weeks. Approved budget. Spending deadline. No incumbent vendors yet, because two weeks ago the production didn't exist as a buying entity.

And her prospects still answer the phone — because this list was never for sale, never rented, never carpet-bombed. It was sitting in a government filing, free, unread by everyone except the people who know to look.

Same skill. Same product. The second rep isn't better. Her leads are simply alive.

That's the difference with Hollywood Sales Wire — and let me be straight about what it is and isn't. Every subscriber gets the same Tuesday wire. But here's what will never happen: I will never rent this list. Not the leads, and not you. Your prospects aren't being hammered by everyone who paid a list broker, and your inbox isn't being sold to one either. In this business, that alone puts you in rare company.

While the trade press spends its ink on which model made which trailer, the real oceans of money — the physical production wave Netflix and Amazon are riding into live sports, the localization boom, the buildouts that follow every rights deal — announce themselves every week in filings and postings. The Wire reads them so you don't have to.

And to hand you the system itself, three Special Reports come free with a Founding Membership — delivered the moment you subscribe:

The Spend Map — the honest map of where money actually moves in the production economy. The real oceans are physical production, sports rights, and localization — each walked with receipts. AI spend is in there too — real, growing, honestly sized fourth.

The $6.6 Billion Greenlight Window — the state tax-credit system decoded as a prospecting machine. Which states publish award lists, on what calendar, and the window between greenlight and spend when a production buys nearly everything it will ever buy.

The Requisition Read — careers pages as disclosure documents. The job titles that mean "a budget just landed here," the posting patterns that reveal a buildout weeks before any purchase order.

Subscribe by ${dl} — or right now — and all three are yours free, along with the Founding Member rate: $38 a week ($1,995 a year) instead of $77 ($3,995), locked for as long as you stay.

https://hollywoodsaleswire.com/?utm_source=cold&utm_medium=email&utm_campaign=${tag}&utm_content=e2

Tomorrow I'll show you the method working on a real example.

Karilyn Colegrove, Publisher
Hollywood Sales Wire`,
    },
    {
      subj: "A job posting told us a nine-figure budget had landed",
      plain: `Hi {{firstName}},

Let me show you the method on one concrete case, so you can judge for yourself whether this is worth your attention.

When a streamer signs a major live-sports rights deal — the way Netflix pushed into live NFL games, the way Amazon wrote a multi-billion-dollar check for the NBA — the press covers the rights fee and stops there. But a rights deal is not a broadcast.

Between "we own the rights" and "we're on the air" sits a buildout: production facilities, broadcast crews, graphics systems, transmission, localization — an entire supply chain that has to be purchased and staffed on a hard deadline, because the season starts whether you're ready or not.

You can't see the purchase orders. But you can see the hiring.

Within weeks of one such deal, the requisitions started appearing on the streamer's own careers page. Not vague postings — roles like Broadcast Systems Engineer, Live Production and Technical Program Manager, Live Events, dated, specific, and useless to explain unless a broadcast operation was being built from scratch.

To a salesperson who knows how to read them, those postings said: the budget is real, the buildout has started, and the vendor decisions are being made right now. The purchase orders followed within the quarter. The signal had been public the whole time.

Anyone could have seen it. Almost nobody looked — because almost nobody in sales has been taught that a careers page is a disclosure document.

The Requisition Read — one of the three Special Reports you get free as a Founding Member — teaches exactly this. Inside:

The full walkthrough of that live-sports buildout, named, dated, requisition by requisition — what each posting revealed and when.

The glossary of job-title tells: which titles reliably mean money has landed, ranked by how early they show up in a buildout.

The rights-deal-to-requisition timeline, so you know when to start watching a target account.

How to run a requisition sweep on any account in about twenty minutes a week, with nothing but public pages.

On its own I'd price it at $495, and I'd be underpricing it: this is the kind of thing you could sit through a $2,000 sales conference and never hear, because the people who know it are using it, not teaching it.

The other two reports do the same for the other two signal sources. The Spend Map ($795 value) hands you the territory. The $6.6 Billion Greenlight Window ($695 value) hands you the calendar.

Map, calendar, craft. A complete prospecting system.

Reports teach you to fish. The Wire hands you fish every Tuesday — because you have a quota, and the filings don't read themselves.

All three reports are free with a Founding Membership — $38 a week ($1,995 a year) instead of the regular $77 ($3,995) — if you subscribe by ${dl}.

https://hollywoodsaleswire.com/?utm_source=cold&utm_medium=email&utm_campaign=${tag}&utm_content=e3

Karilyn Colegrove, Publisher
Hollywood Sales Wire`,
    },
    {
      subj: "Everything this membership includes (and the guarantee that removes the risk)",
      plain: `Hi {{firstName}},

Today, the whole offer, plainly, so you can make the call with all the facts in front of you.

What the subscription is. Hollywood Sales Wire is a weekly intelligence briefing for people who sell into the production economy.

Every Tuesday, you get the week's live buying signals — new tax-credit awards, requisition sweeps, money flows — read and translated into who to call, what they're about to buy, and when the window closes. Fifty-two issues a year.

Once a month, subscribers also receive The Divergence Report — the strategic layer on top of the weekly wire. Where the Tuesday wire tells you who to call this week, the Divergence Report is the deeper monthly read on where the money is moving next quarter — the spend shifts, the buildouts forming, the territories opening — so you're positioned before the crowd shows up.

The wire is your calls for the week. The Divergence Report is your plan for the season. Both come with the subscription.

What Founding Members get on top — the three Special Reports. These are one-time bonuses, free when you join during this offer, delivered immediately, and yours to keep forever.

The Spend Map ($795 value) — the honest map of the production economy's money. Three oceans the headlines ignore — physical production, sports rights, localization — each walked with receipts. Plus the truth about AI spend: real, growing, honestly sized fourth.

The $6.6 Billion Greenlight Window ($695 value) — the tax-credit award system as a prospecting machine: which states publish award lists, on what calendar, and the greenlight-to-spend window when a production does nearly all of its buying.

The Requisition Read ($495 value) — careers pages as buying signals: the job-title tells glossary, the posting patterns that announce a landed budget before any purchase order, and the full named walkthrough of a nine-figure streaming-sports buildout.

That's $1,985 in Special Reports — a crash course in producing your own hot leads that the $15,000-a-year databases don't teach, because their business is renting the same tired names to everyone.

(And no — I will never rent this subscriber list to anyone, for any purpose. Your prospects stay fresh and so does your inbox.)

The price. The regular rate for Hollywood Sales Wire is $77 a week — $3,995 a year, billed annually. One closed deal sourced from one issue pays for years of it.

Subscribe during this offer and you pay the Founding Member rate instead: $38 a week — $1,995 a year — locked in for as long as you stay a member. Half the regular rate, and when rates rise for everyone who comes after you, yours never moves.

Notice the math: the Special Reports alone ($1,985) are worth the Founding Membership fee ($1,995). The fifty-two weekly issues and twelve Divergence Reports are, in effect, thrown in.

The guarantee — you risk nothing. Take 90 days — roughly thirteen issues of the Wire and three Divergence Reports. If it hasn't put live, workable prospects in front of you, write me and I'll refund every penny. Everything you've received — all three Special Reports and every issue delivered — is yours to keep either way. I've kept all the risk on my side of the table.

The deadline. This offer ends at midnight Eastern on ${dl}. After that, the Founding Member rate and the free Special Reports are withdrawn, and membership is $77 a week like everyone else.

Subscribe now and the three Special Reports arrive immediately, with your first Wire the following Tuesday.

https://hollywoodsaleswire.com/?utm_source=cold&utm_medium=email&utm_campaign=${tag}&utm_content=e4

Karilyn Colegrove, Publisher
Hollywood Sales Wire

P.S. If you're not the person who owns the sales number, forward this to whoever is. They'll want to see it before ${dl}.`,
    },
    {
      subj: "Midnight tonight: the founding rate goes away",
      plain: `Hi {{firstName}},

Short and plain, because it's deadline day.

At midnight Eastern tonight, this offer closes. Here's what changes at 12:01:

The rate goes from $38 a week to $77 a week ($1,995 to $3,995 a year).

The three Special Reports — The Spend Map, The $6.6 Billion Greenlight Window, The Requisition Read, $1,985 in prospecting systems — are no longer free with membership.

The lock disappears. Founding Members keep $38 a week for as long as they stay members. Everyone after tonight pays the going rate, including future increases.

Subscribe before midnight and everything is immediate: the three Special Reports in your inbox tonight, your first Wire the following Tuesday.

And here's what doesn't change either way: every week, somewhere in the public record, productions with fresh budgets and hard spending deadlines quietly announce themselves — in award lists, in requisitions, in money flows. Somebody's going to read those signals and make the first call.

It won't be the reps working the rented lists. Those names have been pitched to death by everyone who rented them — the prospects stopped listening months ago. The first call that lands will come from someone working leads that are two weeks old instead of six months, calling prospects who still answer the phone. The only question is whether that someone works for you or for your competitor.

The math one last time: $38 a week, against $1,985 in reports that are yours to keep no matter what, against a 90-day everything-to-keep guarantee, against competitors charging $15,000 for names that were cold — and worn out — before they were sold.

You risk nothing. The deadline is real. It's tonight.

https://hollywoodsaleswire.com/?utm_source=cold&utm_medium=email&utm_campaign=${tag}&utm_content=e5

Whatever you decide, thank you for reading this far. If the Wire isn't for you, I hope the last week at least changed how you look at a careers page.

Karilyn Colegrove, Publisher
Hollywood Sales Wire

P.S. Midnight Eastern means midnight Eastern. If you're reading this after hours, check the page: if the $38 rate is still showing, you made it.`,
    },
  ];

  return emails.map(({ subj, plain }) => ({ subj, html: toHtml(plain) }));
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface ColdBatchResult {
  campaignId: string;
  batchTag: string;
  deadline: string;
}

export interface ColdLead {
  email: string;
  first_name?: string;
  last_name?: string;
  company?: string;
}

export interface UploadLeadsResult {
  uploaded: number;
  skipped: number;
  campaignId: string;
  leadsUploaded: number; // total after this upload
  remaining: number;     // slots left before PLAN_CONTACT_CAP
}

/**
 * Create one Instantly cold campaign batch, activate it, and enroll the
 * monitor address so Karilyn receives every email her prospects receive.
 * The daily send limit is auto-ramped based on how many batches have run
 * before, and the campaign record is stored in cold_campaigns for lead tracking.
 */
export async function createColdBatch(startDate = new Date()): Promise<ColdBatchResult> {
  const deadlineDate = addDays(startDate, 7);
  const deadline = formatDeadline(deadlineDate);

  // Date-stamped tag is unique and self-documenting; no counter file needed.
  const dateStamp = startDate
    .toLocaleDateString("en-US", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .replace(/\//g, "");
  const batchTag = `hsw-cold-${dateStamp}`;

  const campaignName = `HSW Founding Offer — Cold (starts ${startDate.toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric" })}, deadline ${deadline})`;
  const emails = buildEmails(deadline, batchTag);

  logger.info({ deadline, batchTag }, "cold-campaigns: creating Instantly batch");

  // Step 1: POST creates the campaign structure (bodies are not saved on POST).
  const created = await instantly<{ id: string }>("POST", "/campaigns", {
    name: campaignName,
    status: 0, // draft on creation; activated explicitly below via /activate
    email_list: [...SENDING_ACCOUNTS],
    // No daily_limit set here — Instantly slow-ramp on the mailbox handles volume
    // automatically (starts low, increases to MAILBOX_DAILY_CAP over time).
    campaign_schedule: {
      schedules: [
        {
          name: "Weekdays",
          timing: { from: "08:00", to: "18:00" },
          days: { "0": false, "1": true, "2": true, "3": true, "4": true, "5": true, "6": false },
          timezone: SCHEDULE_TIMEZONE,
        },
      ],
    },
    stop_on_reply: true,
    open_tracking: false,
    first_email_text_only: true,
    prioritize_new_leads: true,
    sequences: [
      {
        steps: emails.map((e, i) => ({
          type: "email",
          delay: STEP_DELAYS[i],
          delay_unit: "days",
          variants: [{ subject: e.subj, body: "" }],
        })),
      },
    ],
  });

  const campaignId = created.id;

  // Step 2: PATCH to save HTML bodies (Instantly silently drops them on POST).
  await instantly("PATCH", `/campaigns/${campaignId}`, {
    sequences: [
      {
        steps: emails.map((e, i) => ({
          type: "email",
          delay: STEP_DELAYS[i],
          delay_unit: "days",
          variants: [{ subject: e.subj, body: e.html }],
        })),
      },
    ],
  });

  // Step 3: Activate — /activate is the only endpoint that flips status to 1.
  await instantly("POST", `/campaigns/${campaignId}/activate`);

  // Step 4: Enroll monitor address so Karilyn sees every email prospects receive.
  try {
    await instantly("POST", "/leads", {
      // NOTE: field must be `campaign` — `campaign_id` is silently ignored and orphans the lead.
      campaign: campaignId,
      email: MONITOR_EMAIL,
      first_name: MONITOR_FIRST,
    });
    logger.info({ campaignId, monitor: MONITOR_EMAIL }, "cold-campaigns: monitor lead enrolled");
  } catch (err) {
    // Non-fatal — campaign is still active; Karilyn can add herself manually.
    logger.error({ err, campaignId }, "cold-campaigns: failed to enroll monitor lead");
  }

  // Step 5: Record in DB for lead-upload tracking.
  // dailyLimit stored as the mailbox cap for reference; actual ramp is managed by Instantly.
  await db.insert(coldCampaignsTable).values({ campaignId, batchTag, deadline, dailyLimit: MAILBOX_DAILY_CAP });

  logger.info({ campaignId, batchTag, deadline }, "cold-campaigns: batch created and active");
  return { campaignId, batchTag, deadline };
}

/**
 * Returns the most recently created cold campaign row, or null if none exist.
 * Used by the publisher lead-upload endpoint to find the active campaign.
 */
export async function getLatestColdCampaign() {
  const rows = await db
    .select()
    .from(coldCampaignsTable)
    .orderBy(desc(coldCampaignsTable.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Upload prospect leads to the latest active cold campaign.
 * Enforces PLAN_CONTACT_CAP (40) and updates leads_uploaded in the DB.
 * Skips leads that would push over the cap; returns counts for the caller.
 *
 * Called from POST /publisher/cold-leads — no Instantly UI access needed.
 */
export async function uploadColdLeads(leads: ColdLead[]): Promise<UploadLeadsResult> {
  const campaign = await getLatestColdCampaign();
  if (!campaign) throw new Error("No cold campaign found — run createColdBatch first");

  const alreadyUploaded = campaign.leadsUploaded;
  const slotsLeft = PLAN_CONTACT_CAP - alreadyUploaded;

  // Trim the list to what fits, skipping the rest.
  const toUpload = leads.slice(0, slotsLeft);
  const skipped = leads.length - toUpload.length;

  let uploaded = 0;
  for (const lead of toUpload) {
    try {
      await instantly("POST", "/leads", {
        // NOTE: field must be `campaign` — `campaign_id` is silently accepted but ignored,
        // leaving the lead orphaned in the org (campaign: NONE). Verified live Aug 18, 2026.
        campaign: campaign.campaignId,
        email: lead.email.trim().toLowerCase(),
        ...(lead.first_name ? { first_name: lead.first_name } : {}),
        ...(lead.last_name ? { last_name: lead.last_name } : {}),
        ...(lead.company ? { company_name: lead.company } : {}),
      });
      uploaded++;
    } catch (err) {
      logger.error({ err, email: lead.email }, "cold-campaigns: failed to upload lead — skipping");
    }
  }

  // Update the running total in the DB.
  const newTotal = alreadyUploaded + uploaded;
  await db
    .update(coldCampaignsTable)
    .set({ leadsUploaded: newTotal })
    .where(eq(coldCampaignsTable.id, campaign.id));

  logger.info(
    { campaignId: campaign.campaignId, uploaded, skipped, newTotal },
    "cold-campaigns: leads uploaded",
  );

  return {
    uploaded,
    skipped,
    campaignId: campaign.campaignId,
    leadsUploaded: newTotal,
    remaining: PLAN_CONTACT_CAP - newTotal,
  };
}
