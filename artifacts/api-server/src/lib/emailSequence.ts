/**
 * Email marketing for the warm-prospect list.
 *
 * 1. WELCOME_EMAIL — sent immediately on signup.
 * 2. SEQUENCE — the publisher's Founding-Offer series (Draft 5, verbatim from
 *    marketing/founding-offer-email-series-draft5.txt), evergreen-adapted:
 *    starts 14 days after signup (so prospects receive 1–2 Free Editions
 *    before any selling — publisher's Aug 2026 decision), then one email every
 *    7 days (day offsets 14, 21, 28, 35, 42), and every calendar-date
 *    reference ("Tuesday, August 4") is replaced with the subscriber's own
 *    deadline — midnight Eastern at the end of day 42. Each email links to the
 *    /founding-offer page, which enforces that deadline for real.
 *
 * COPY IS PUBLISHER-LOCKED. Do not rewrite claims, pricing, or phrasing.
 * Only the mechanical substitutions below were made:
 *   - "Hello [FIRST NAME]," → "Hello Reader," (her stated ESP fallback)
 *   - [SIGNUP LINK] → personal /founding-offer?token=… link with her UTM params
 *   - "Tuesday, August 4" / deadline references → the subscriber's deadline date
 *   - E5 P.S. "check the page" logic still true: the offer page flips to the
 *     regular rate at the subscriber's deadline.
 */

export const FROM_ADDRESS = "Hollywood Sales Wire <briefings@hollywoodsaleswire.com>";
export const SITE_URL = process.env.SITE_URL ?? "https://hollywoodsaleswire.com";

export interface SequenceOpts {
  unsubscribeUrl: string;
  offerUrl: string; // personal founding-offer page link (no UTM; added per email)
  deadlineLabel: string; // e.g. "Tuesday, August 18"
}

export interface SequenceStep {
  step: number;
  dayOffset: number;
  subject: string;
  body: (opts: SequenceOpts) => string;
}

function wrap(content: string, unsubscribeUrl: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f5f2;">
    <div style="max-width:560px;margin:0 auto;padding:32px 24px;font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;font-size:17px;line-height:1.6;background:#ffffff;">
      ${content}
      <hr style="border:none;border-top:1px solid #e5e2da;margin:32px 0 16px;" />
      <p style="font-size:12px;color:#8a8577;font-family:Arial,sans-serif;">
        Hollywood Sales Wire &middot; You're receiving this because you signed up at hollywoodsaleswire.com.<br />
        <a href="${unsubscribeUrl}" style="color:#8a8577;">Unsubscribe</a> at any time.
      </p>
    </div>
  </body>
</html>`;
}

function cta(label: string, url: string): string {
  return `<p style="margin:28px 0;"><a href="${url}" style="background:#1d5c3a;color:#ffffff;padding:12px 24px;text-decoration:none;font-family:Arial,sans-serif;font-size:15px;">${label}</a></p>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Renders a Weekly Brief's plain-text body as HTML paragraphs, same
 * convention as sendWire.ts's briefHtml: a line starting with "→ " becomes
 * a link-button rather than a paragraph. Kept independent from sendWire.ts
 * (no shared import) to avoid a cross-module coupling for one small helper.
 */
function briefBodyHtml(bodyText: string, ctaUrl: string): string {
  return bodyText
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) =>
      /^→\s*/.test(s)
        ? `<p style="margin:20px 0;"><a href="${ctaUrl}" style="background:#1d5c3a;color:#ffffff;padding:10px 20px;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;">${escapeHtml(s.replace(/^→\s*/, ""))} &rarr;</a></p>`
        : `<p style="margin:0 0 16px;">${escapeHtml(s).replace(/\n/g, "<br />")}</p>`,
    )
    .join("\n");
}

function utm(offerUrl: string, n: number): string {
  const sep = offerUrl.includes("?") ? "&" : "?";
  return `${offerUrl}${sep}utm_source=email&utm_medium=founding&utm_campaign=hsw-launch&utm_content=e${n}`;
}

// Explicit margin — many email clients (Outlook, some webmail resets) strip
// the browser default <p> margin, which collapses every paragraph together
// with no visible blank line between them or before the P.S.
const p = (s: string) => `<p style="margin:0 0 20px;">${s}</p>`;
const sig = p("Karilyn Colegrove, Publisher<br />Hollywood Sales Wire");

export interface WelcomeEmailOpts {
  unsubscribeUrl: string;
  /** Most recently sent HSW Weekly Brief, if one exists yet, so new
   * subscribers get an issue right away instead of waiting for next Tuesday. */
  latestBrief?: { subject: string; bodyText: string } | null;
}

export const WELCOME_EMAIL = {
  subject: "You're on the list — Hollywood Sales Wire",
  body: ({ unsubscribeUrl, latestBrief }: WelcomeEmailOpts) =>
    wrap(
      `${p("Hello Reader,")}
${p("You're on the Hollywood Sales Wire list. Every week you'll get the free edition of the Wire — the shape of the week's buying signals, so you can see how the system works. You'll also hear from us with occasional offers — and nothing else. We never rent or share this list.")}
${
  latestBrief
    ? `${p("Here's the most recent issue, so you don't have to wait until Tuesday for your first one:")}
<hr style="border:none;border-top:1px solid #e5e2da;margin:24px 0;" />
<p style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;color:#8a8577;text-transform:uppercase;margin:0 0 8px;">HSW Weekly Brief</p>
<p style="font-weight:bold;margin:0 0 16px;">${escapeHtml(latestBrief.subject)}</p>
${briefBodyHtml(latestBrief.bodyText, `${SITE_URL}/order?utm_source=email&utm_medium=welcome&utm_campaign=weekly-brief`)}
<hr style="border:none;border-top:1px solid #e5e2da;margin:24px 0;" />`
    : `${p("Your first issue arrives this coming Tuesday.")}`
}
${p("In the meantime, you can learn more about the Wire and membership here:")}
${cta("Visit Hollywood Sales Wire", SITE_URL)}
${sig}`,
      unsubscribeUrl,
    ),
};

export const SEQUENCE: SequenceStep[] = [
  {
    step: 1,
    dayOffset: 14,
    subject: "The lead list your competitors bought is already dead",
    body: ({ unsubscribeUrl, offerUrl, deadlineLabel }) =>
      wrap(
        `${p("Hello Reader,")}
${p("Three weeks ago, California's film office closed the books on the first year of its expanded tax credit: 170 productions awarded, $6.6 billion in direct production spending — including 41 new films greenlit in the final round alone.")}
${p("Not projections. Not &ldquo;industry outlook.&rdquo; Awards. Named productions, approved budgets, published on a state list — which means every one of them is now on a clock: crew up, book stages, cut purchase orders, spend the money or lose the credit.")}
${p("California alone now moves three-quarters of a billion dollars a year through its expanded credit. Georgia doesn't even cap its program. And every production on those award lists is a company that is about to buy things: cameras, stages, software, localization, post, payroll, insurance — the whole supply chain of a budget with a deadline.")}
${p("Here's the part that should bother you.")}
${p("The &ldquo;industry lead lists&rdquo; your competitors are working from — the $15,000-a-year databases, the festival directories, the scraped LinkedIn exports — were cold before they were ever sold. Six months stale on a good day.")}
${p("And it's worse than stale: the list companies rent those same names out, over and over, to anyone with a marketing budget. By the time you dial, that contact has been pitched by a dozen vendors, three conferences, and a webinar series. They're not just cold. They're sick of the phone.")}
${p("Meanwhile the hot list — who got money this month and has to spend it — sits in public filings that almost nobody in sales reads, because reading them is a genuinely tedious skill.")}
${p("That's the entire idea behind Hollywood Sales Wire: I read the filings, the award lists, the requisitions, and the money flows every week, and every Tuesday you get the names — who just got funded, what they're about to buy, and when the window closes.")}
${p("Cold leads are a commodity. Hot leads are an edge.")}
${p(`The offer is live right now: use your valid offer link by midnight Eastern on ${deadlineLabel} — or better, today — to join at the Founding Member rate: $599/year or $64.99/month individual; $1,198/year or $129.98/month Team (up to five seats). Regular rates are $1,150/year individual and $2,300/year Team. Your rate is locked in for as long as you stay. Three Special Reports, valued at $357 total, arrive free and immediately with your membership, alongside your first issue of the Wire this coming Tuesday.`)}
${p("I'll make the full case over the next few weeks. But if you already know what a two-week-old award list is worth to your pipeline, there's no reason to wait:")}
${cta("View the Founding Member offer", utm(offerUrl, 1))}
${sig}
${p("P.S. One question worth sitting with: when a state publishes a list of 170 funded productions worth $6.6 billion, who in your company is assigned to call those productions first? If the answer is &ldquo;nobody,&rdquo; that's fixable — by " + deadlineLabel + ".")}`,
        unsubscribeUrl,
      ),
  },
  {
    step: 2,
    dayOffset: 21,
    subject: "Why your close rate is a math problem, not a talent problem",
    body: ({ unsubscribeUrl, offerUrl, deadlineLabel }) =>
      wrap(
        `${p("Hello Reader,")}
${p("Picture two salespeople selling the same product into the same studios.")}
${p("The first works a purchased list. The names are real. The titles are mostly right. And the information is an average of six months old — which in this business means the budget was allocated, the vendors were chosen, and the purchase orders were cut before she ever dialed. She's not selling. She's leaving voicemails at closed doors.")}
${p("And there's a second problem nobody at the list company mentioned when they took her $15,000: they didn't sell her those names. They rented them to her — and to everybody else.")}
${p("The same contacts get rented out again and again. To software vendors. To conference promoters. To &ldquo;partnership&rdquo; pitches. To marketers selling things that have nothing to do with production.")}
${p("So when she finally gets a prospect on the phone, she isn't a salesperson to him. She's the fourteenth interruption this week. He was jaded before she said her own name.")}
${p("The second rep works a different list: productions that appeared on a state tax-credit award list within the last two weeks. Approved budget. Spending deadline. No incumbent vendors yet, because two weeks ago the production didn't exist as a buying entity.")}
${p("And her prospects still answer the phone — because this list was never for sale, never rented, never carpet-bombed. It was sitting in a government filing, free, unread by everyone except the people who know to look.")}
${p("Same skill. Same product. The second rep isn't better. Her leads are simply alive.")}
${p("That's the difference with Hollywood Sales Wire — and let me be straight about what it is and isn't. Every subscriber gets the same Tuesday wire. But here's what will never happen: I will never rent this list. Not the leads, and not you. Your prospects aren't being hammered by everyone who paid a list broker, and your inbox isn't being sold to one either. In this business, that alone puts you in rare company.")}
${p("While the trade press spends its ink on which model made which trailer, the real oceans of money — the physical production wave Netflix and Amazon are riding into live sports, the localization boom, the buildouts that follow every rights deal — announce themselves every week in filings and postings. The Wire reads them so you don't have to.")}
${p("And to hand you the system itself, three Special Reports come free with your Hollywood Sales Wire membership — they're not for sale anywhere else — delivered the moment you subscribe:")}
<ul>
<li><strong>Under the Hood: The WBD AI Buildout</strong> — the inside look at how Warner Bros. Discovery is actually building its AI capability, 8,700 miles from Burbank: who is being hired, where, at what cost, and for what work — drawn from job postings, government records, corporate filings, and salary data on two continents. Not a scandal; a map — of exactly the kind of buildout your own prospects are quietly running.</li>
<li><strong>The $6.6 Billion Greenlight Window</strong> — the state tax-credit system, decoded as a prospecting machine. Which states publish award lists, on what calendar, where to find them — and the window between greenlight and spend, when a production hires, books, and buys nearly everything it will ever buy. Get the calendar right and you're calling the week the money lands, not the quarter after it's spent.</li>
<li><strong>Help-Wanted Pages Are Purchase Orders</strong> — careers pages as disclosure documents. The job titles that mean &ldquo;a budget just landed here,&rdquo; the posting patterns that reveal a buildout weeks before any purchase order, and a glossary of the tells — walked through on a real nine-figure case you'll recognize.</li>
</ul>
${p(`Subscribe by ${deadlineLabel} — or right now — and all three are yours immediately, along with the Founding Member rate: $38 a week ($1,995 a year) instead of $77 ($3,995), locked for as long as you stay.`)}
${cta("Become a Founding Member — $38/week", utm(offerUrl, 2))}
${p("Next week I'll show you the method working on a real example.")}
${sig}`,
        unsubscribeUrl,
      ),
  },
  {
    step: 3,
    dayOffset: 28,
    subject: "A job posting told us a nine-figure budget had landed",
    body: ({ unsubscribeUrl, offerUrl, deadlineLabel }) =>
      wrap(
        `${p("Hello Reader,")}
${p("Let me show you the method on one concrete case, so you can judge for yourself whether this is worth your attention.")}
${p("When a streamer signs a major live-sports rights deal — the way Netflix pushed into live NFL games, the way Amazon wrote a multi-billion-dollar check for the NBA — the press covers the rights fee and stops there. But a rights deal is not a broadcast.")}
${p("Between &ldquo;we own the rights&rdquo; and &ldquo;we're on the air&rdquo; sits a buildout: production facilities, broadcast crews, graphics systems, transmission, localization — an entire supply chain that has to be purchased and staffed on a hard deadline, because the season starts whether you're ready or not.")}
${p("You can't see the purchase orders. But you can see the hiring.")}
${p("Within weeks of one such deal, the requisitions started appearing on the streamer's own careers page. Not vague postings — roles like Broadcast Systems Engineer, Live Production and Technical Program Manager, Live Events, dated, specific, and useless to explain unless a broadcast operation was being built from scratch.")}
${p("To a salesperson who knows how to read them, those postings said: the budget is real, the buildout has started, and the vendor decisions are being made right now. The purchase orders followed within the quarter. The signal had been public the whole time.")}
${p("Anyone could have seen it. Almost nobody looked — because almost nobody in sales has ever been shown that a careers page is a disclosure document.")}
${p("Help-Wanted Pages Are Purchase Orders — one of the three Special Reports you get free with your membership — reveals exactly this. Inside:")}
<ul>
<li>The full walkthrough of that live-sports buildout, named, dated, requisition by requisition — what each posting revealed and when.</li>
<li>The glossary of job-title tells: which titles reliably mean money has landed, ranked by how early they show up in a buildout — and the ones that look promising but mean nothing.</li>
<li>The rights-deal-to-requisition timeline, so you know when to start watching a target account.</li>
<li>How to run a requisition sweep on any account in about twenty minutes a week, with nothing but public pages.</li>
</ul>
${p("On its own I'd price it at $495, and I'd be underpricing it: this is the kind of thing you could sit through a $2,000 sales conference and never hear, because the people who know it are using it, not sharing it.")}
${p("The other two reports round out the system. Under the Hood: The WBD AI Buildout ($795 value) hands you the method at full scale — one entertainment giant's AI capability buildout traced end to end through job postings, government records, corporate filings, and salary data on two continents, so you see exactly what a landed budget looks like from the outside. The $6.6 Billion Greenlight Window ($695 value) hands you the calendar — the state-by-state award-list schedule and the spend window when a production does nearly all of its buying.")}
${p("Case, calendar, craft. A complete prospecting system — and the fountainhead of the numbers the $15K databases keep promising and keep not delivering.")}
${p("The reports show you how to fish. The Wire hands you fish every Tuesday — because you have a quota, and the filings don't read themselves.")}
${p(`All three reports are free with your membership. Subscribe by ${deadlineLabel} and you're in at the Founding Member rate — $38 a week ($1,995 a year) instead of the regular $77 ($3,995), locked for as long as you stay. Subscribe today and the reports hit your inbox today, with your first Wire this Tuesday.`)}
${cta("Become a Founding Member — $38/week", utm(offerUrl, 3))}
${sig}`,
        unsubscribeUrl,
      ),
  },
  {
    step: 4,
    dayOffset: 35,
    subject: "Everything a Founding Member gets (and the guarantee that removes the risk)",
    body: ({ unsubscribeUrl, offerUrl, deadlineLabel }) =>
      wrap(
        `${p("Hello Reader,")}
${p("Today, the whole offer, plainly, so you can make the call with all the facts in front of you.")}
${p("<strong>What the subscription is.</strong> Hollywood Sales Wire is a weekly intelligence briefing for people who sell into the production economy.")}
${p("Every Tuesday, you get the week's live buying signals — new tax-credit awards, requisition sweeps, money flows — read and translated into who to call, what they're about to buy, and when the window closes. Fifty-two issues a year.")}
${p("Once a month, subscribers also receive The Divergence Report — the strategic layer on top of the HSW Weekly Wire. Where the Tuesday issue tells you who to call this week, the Divergence Report is the deeper monthly read on where the money is moving next quarter — the spend shifts, the buildouts forming, the territories opening — so you're positioned before the crowd shows up.")}
${p("The wire is your calls for the week. The Divergence Report is your plan for the season. Both come with the subscription, every month you're a member.")}
${p("<strong>The three Special Reports — free with your membership, delivered immediately, yours to keep forever.</strong> These are one-time bonuses included with every membership:")}
<ul>
<li><strong>Under the Hood: The WBD AI Buildout</strong> ($795 value) — how Warner Bros. Discovery is actually building its AI capability, 8,700 miles from Burbank: who is hired, where, at what cost, and for what work — drawn from job postings, government records, corporate filings, and salary data on two continents. Not a scandal; a map.</li>
<li><strong>The $6.6 Billion Greenlight Window</strong> ($695 value) — the tax-credit award system as a prospecting machine: which states publish award lists, on what calendar, and the greenlight-to-spend window when a production does nearly all of its buying. The report that turns a government filing into a call sheet.</li>
<li><strong>Help-Wanted Pages Are Purchase Orders</strong> ($495 value) — careers pages as buying signals: the job-title tells glossary, the posting patterns that announce a landed budget before any purchase order, and the full named walkthrough of a nine-figure streaming-sports buildout.</li>
</ul>
${p("That's $1,985 in Special Reports — a crash course in producing your own hot leads that the $15,000-a-year databases will never reveal, because their business is renting the same tired names to everyone.")}
${p("(And no — I will never rent this subscriber list to anyone, for any purpose. Your prospects stay fresh and so does your inbox.)")}
${p("<strong>The price.</strong> The regular rate for Hollywood Sales Wire is $77 a week — $3,995 a year, billed annually. One closed deal sourced from one issue pays for years of it.")}
${p("Subscribe during this launch offer and you pay the Founding Member rate instead: $38 a week — $1,995 a year — locked in for as long as you stay a member. Half the regular rate, and when rates rise for everyone who comes after you, yours never moves.")}
${p("Notice the math: the Special Reports alone ($1,985) are worth the Founding Membership fee ($1,995). The fifty-two weekly issues and twelve Divergence Reports are, in effect, thrown in.")}
${p("<strong>The guarantee — you risk nothing.</strong> Take 90 days — roughly thirteen issues of the Wire and three Divergence Reports. If it hasn't put live, workable prospects in front of you, write me and I'll refund every penny. Everything you've received — all three Special Reports and every issue delivered — is yours to keep either way. I've kept all the risk on my side of the table.")}
${p(`<strong>The deadline.</strong> This is a limited-time launch offer, and the clock is real: it ends at midnight Eastern on ${deadlineLabel}. After that, the Founding Member rate is withdrawn, and membership is $77 a week like everyone else.`)}
${p("Subscribe now and the three Special Reports arrive immediately — start running the system this weekend — with your first Wire on Tuesday.")}
${cta("Become a Founding Member — $38/week ($1,995/yr)", utm(offerUrl, 4))}
${sig}
${p("P.S. If you're not the person who owns the sales number, forward this to whoever is. They'll want to see it before " + deadlineLabel + ".")}`,
        unsubscribeUrl,
      ),
  },
  {
    step: 5,
    dayOffset: 42,
    subject: "Midnight tonight: the Founding Member rate goes away",
    body: ({ unsubscribeUrl, offerUrl }) =>
      wrap(
        `${p("Hello Reader,")}
${p("Short and plain, because it's deadline day.")}
${p("At midnight Eastern tonight, this launch offer closes. Here's what changes at 12:01:")}
<ul>
<li>The rate goes from $38 a week to $77 a week ($1,995 to $3,995 a year).</li>
<li>The lock disappears. Founding Members keep $38 a week for as long as they stay members. Everyone after tonight pays the going rate, including future increases.</li>
</ul>
${p("Subscribe before midnight and everything is immediate: the three Special Reports and your first issue of the Wire, both in your inbox.")}
${p("And here's what doesn't change either way: every week, somewhere in the public record, productions with fresh budgets and hard spending deadlines quietly announce themselves — in award lists, in requisitions, in money flows. Somebody's going to read those signals and make the first call.")}
${p("It won't be the reps working the rented lists. Those names have been pitched to death by everyone who rented them — the prospects stopped listening months ago. The first call that lands will come from someone working leads that are two weeks old instead of six months, calling prospects who still answer the phone. The only question is whether that someone works for you or for your competitor.")}
${p("The math one last time: $38 a week, against $1,985 in reports that are yours to keep no matter what, against a 90-day everything-to-keep guarantee, against competitors charging $15,000 for names that were cold — and worn out — before they were sold.")}
${p("You risk nothing. The deadline is real. It's tonight.")}
${cta("Become a Founding Member before midnight — $38/week", utm(offerUrl, 5))}
${p("Whatever you decide, thank you for reading this far. If the Wire isn't for you, I hope these last several weeks at least changed how you look at a careers page.")}
${sig}
${p("P.S. Midnight Eastern means midnight Eastern — your offer page switches to the $77 rate at 12:01. If you're reading this after hours, check the page: if the $38 rate is still showing, you made it.")}`,
        unsubscribeUrl,
      ),
  },
];
