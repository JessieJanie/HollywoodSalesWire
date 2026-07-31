// Articles for the public /articles section.
// Each article body is a sequence of blocks: h2 headings and paragraphs.

export type ArticleBlock =
  | { type: "h2"; text: string }
  | { type: "p"; text: string };

export interface Article {
  slug: string;
  title: string;
  description: string;
  datePublished: string; // ISO date
  readMinutes: number;
  /** Path under public/, relative to the site base (e.g. "images/foo.jpeg") */
  heroImage?: string;
  heroImageAlt?: string;
  body: ArticleBlock[];
}

export const ARTICLES: Article[] = [
  {
    slug: "hollywoods-comfortably-numb-herd-mentality",
    title: "Hollywood's Comfortably Numb Herd Mentality",
    description:
      "Everyone reads the same trades and reaches the same conclusions at the same moment. The advantage sits with whoever watches what precedes the announcements.",
    datePublished: "2026-07-31",
    readMinutes: 4,
    heroImage: "images/trades-herd.jpeg",
    heroImageAlt:
      "A stack of Hollywood trade publications — Deadline, Variety, and The Hollywood Reporter",
    body: [
      {
        type: "p",
        text: "Most vendors selling into entertainment read the same things everyone else reads.",
      },
      {
        type: "p",
        text: "Variety. The Hollywood Reporter. Deadline. A daily procession of announcements, greenlights, deals, and carefully laundered executive statements. It feels like staying informed. In practice it is closer to watching an index fund. By the time the information appears in the trades, the meaningful movement has often already occurred. You are not early. You are reading a polished summary of where the crowd has already been.",
      },
      {
        type: "p",
        text: "This is the comfortably numb herd mentality of the business. Everyone consumes the same after-the-fact material, reaches roughly the same conclusions, and then competes for whatever attention is left. It is a very expensive way to feel current.",
      },
      { type: "h2", text: "After-the-Fact Has a Stale Flavor" },
      {
        type: "p",
        text: "A press release is not a signal. It is a controlled document issued when the company is finally ready for the rest of the world to know. The financing has been arranged. The key decisions have been made. The internal process has already moved. What reaches the trades is the public version of events that were, until recently, private.",
      },
      {
        type: "p",
        text: "Call it trade slop. It is served regularly, it is plentiful, and by the time it reaches the table the real cooking is mostly finished. Reading it produces a mild and reliable sensation of being up to date — the same sensation available to anyone checking which names have already risen in the Nasdaq. The information is real. It is also late.",
      },
      {
        type: "p",
        text: "Vendors who build their outreach around what has just been announced often discover they are entering conversations after the important choices have been made. The production has already begun staffing. The preferred vendors are already in place. What remains is the slower, more crowded work of trying to matter after the useful moment has passed.",
      },
      { type: "h2", text: "Following the Crowd Is Not Leading It" },
      {
        type: "p",
        text: "There is a long and respectable tradition of relationship-driven selling in entertainment. Stay visible. Take the meetings. Cultivate people over time. Eventually something may come of it. This approach is not wrong. It is simply incomplete.",
      },
      {
        type: "p",
        text: "The difficulty is that most of the market is doing some version of the same thing, guided by the same announcements, reacting to the same stories at roughly the same moment. When the trades report that a project is moving, a small herd of vendors often begins moving with it. The result is familiar: more competition, longer cycles, and a great deal of activity that feels industrious without being early.",
      },
      {
        type: "p",
        text: "Getting ahead of the crowd requires looking at different material. Not the finished announcement, but the quieter evidence that something is forming before anyone is ready to issue a press release.",
      },
      { type: "h2", text: "Getting Into the Kitchen Before the Trade Slop Is Served" },
      {
        type: "p",
        text: "Before the announcement there is usually a stretch of less glamorous activity. Financing is secured. Incentive applications are filed and awarded. Production entities take shape. Early hiring begins. Infrastructure starts to appear. None of this is designed for public storytelling. It is designed to get the work underway.",
      },
      {
        type: "p",
        text: "Most of it is public in one form or another. It is simply not packaged for easy consumption, and it is rarely what the trades lead with. The trades have a different job. They report what the industry is prepared to say about itself. A salesperson has a narrower one: determine where money is about to move, and arrive while the decisions are still open.",
      },
      {
        type: "p",
        text: "These are not the same activity. Confusing them is common. It is also one of the more reliable ways to stay busy without getting ahead.",
      },
      { type: "h2", text: "The Expensive Comfort of Staying Current" },
      {
        type: "p",
        text: "It is easy to mistake familiarity with the daily flow of entertainment news for actual sales advantage. The two overlap less than they appear to. One keeps you conversant at lunch. The other determines whether you are calling while a production is still assembling its vendors or after it has largely finished doing so.",
      },
      {
        type: "p",
        text: "Cultivating relationships remains useful. Reading the trades remains useful for context. Neither substitutes for seeing the earlier signals that the rest of the market prefers to skip. The herd will always have the announcements. The advantage sits with whoever is watching what precedes them.",
      },
      {
        type: "p",
        text: "Trade slop will always be available. It arrives after the heat is off the stove. The only real question is whether you were in the kitchen earlier — or comfortably numb with everyone else, waiting to be served.",
      },
    ],
  },
  {
    slug: "the-wizards-of-hollywood-behind-the-curtains",
    title: "The Wizards of Hollywood Behind the Curtains",
    description:
      "Hollywood manufactures glamour after the fact. The money that pays for it is first authorized in quieter documents — the help-wanted page among them.",
    datePublished: "2026-07-31",
    readMinutes: 4,
    heroImage: "images/wizards-curtain.jpeg",
    heroImageAlt:
      "A red theater curtain parted slightly, with a bright spotlight shining through from the stage behind it",
    body: [
      {
        type: "p",
        text: "Hollywood is a machine for manufacturing glamour after the fact.",
      },
      {
        type: "p",
        text: "By the time the premieres arrive, the clothes are perfect, the quotes are polished, and the trades are full of people explaining how inevitable it all was. The audience sees the finished surface: the stars on the steps, the flashbulbs, the official myth. What they do not see is the earlier and less photogenic stage, when the money that will eventually pay for all that glamour is first authorized and the first practical people are hired to spend it.",
      },
      {
        type: "p",
        text: "That stage does not appear on the red carpet. It appears in quieter places — among them, the help-wanted page.",
      },
      { type: "h2", text: "The Story Is Written Before the Story" },
      {
        type: "p",
        text: "A press release is literature. A job posting is closer to a wiring instruction.",
      },
      {
        type: "p",
        text: "Before the project becomes a narrative object — before it has a tone, a theme, or a publicist prepared to call it \u201Cintimate yet epic\u201D — it needs a unit production manager, a production accountant, a coordinator, a few department heads. These are not decorative roles. They are the people who open the accounts, approve the purchase orders, and begin turning a financed project into an actual operation. When those postings appear, the big money that will later create the glamour has already begun to move.",
      },
      {
        type: "p",
        text: "The industry prefers not to dwell on this. It is more flattering to discuss attachments and creative vision than to notice that one of the first real signals of life is often a recruiting ad.",
      },
      { type: "h2", text: "Glamour Is Expensive. Someone Has to Start Spending." },
      {
        type: "p",
        text: "The finished product is designed to look effortless. The gowns, the lighting, the interviews in which everyone pretends the whole enterprise floated into existence on pure talent and excellent taste. In reality it is assembled by people hired early, quietly, and for the unromantic purpose of making the machine run.",
      },
      {
        type: "p",
        text: "A help-wanted page does not care about prestige. It records that a budget line has been approved and that a human being is required to execute it. That is a more honest document than most of what circulates under the heading of industry news. One is composed for effect. The other is a purchase order in a different font.",
      },
      {
        type: "p",
        text: "Help-wanted ads are only one of several such precursors. Early staffing, incentive activity, entity formation, and the other unglamorous indicators that precede a public narrative do not each tell the whole story. Together, they begin to flush out where the biggest spends are preparing to happen. The market continues to stare at the curtain. The quieter documents identify the room where the money is being organized.",
      },
      {
        type: "p",
        text: "Vendors who wait for the glamorous version of events often arrive after these first practical decisions have already been made. The advantage sits with whoever noticed the earlier and less elegant paperwork.",
      },
      { type: "h2", text: "The Curtain Is the Entertaining Part" },
      {
        type: "p",
        text: "Hollywood is very skilled at directing attention toward the curtain. The premieres. The panels. The official story. This material is not worthless. It is simply late. By the time the curtain is being discussed in public, the wizards behind it have frequently already been hired and have started doing the work that makes the curtain worth looking at.",
      },
      {
        type: "p",
        text: "The trades will continue to report the finished narrative. That is their function. A salesperson has a narrower interest: determine when the spending mechanism has been switched on, and arrive while the people switching it on are still reachable.",
      },
      {
        type: "p",
        text: "Most of the market remains hypnotized by the show. A smaller group watches the quieter documents — the help-wanted page among them — where the show is first staffed and the money first becomes real.",
      },
      {
        type: "p",
        text: "The glamour is the product. The requisition is one of the places the product begins. The rest of the early signals simply confirm where the biggest checks are getting ready to move.",
      },
    ],
  },
  {
    slug: "find-film-productions-before-they-buy",
    title: "How to Find Film Productions Before They Start Buying",
    description:
      "Funded productions are published on public state tax-credit award lists months before they cut purchase orders. Here's how to read those lists and reach buyers while budgets are live.",
    datePublished: "2026-07-30",
    readMinutes: 6,
    body: [
      {
        type: "p",
        text: "Every vendor who sells into the entertainment industry has the same complaint: by the time you hear a production exists, it has already picked its camera house, its stages, its payroll company, and its post pipeline. You're not late by days. You're late by months.",
      },
      {
        type: "p",
        text: "Here's what most vendors never realize: the moment a production is funded is a public event. It just isn't published anywhere vendors think to look.",
      },
      { type: "h2", text: "The award list is the starting gun" },
      {
        type: "p",
        text: "Most major production states run film tax-credit programs, and those programs publish award lists — named productions, approved budget figures, award amounts — as a matter of public record. In the first year of California's expanded program alone, 170 productions were awarded credits tied to $6.6 billion in direct production spending. Georgia's program doesn't even have a cap.",
      },
      {
        type: "p",
        text: "A tax-credit award is not a press release about a project that might happen. It's a legal commitment with a clock attached. To keep the credit, the production has to spend qualified dollars inside a defined window. That means every name on an award list is a company that is about to hire crew, book stages, and cut purchase orders — on a deadline.",
      },
      { type: "h2", text: "Why the window matters more than the name" },
      {
        type: "p",
        text: "A production company's name is worth very little on its own. What's worth money is knowing where that production is in its spending cycle. Between the award announcement and the first day of principal photography, there's a stretch — usually a few months — when department heads are being hired and vendor decisions are actually being made. That's the window. Call before it opens and there's no one to talk to. Call after it closes and every contract is signed.",
      },
      {
        type: "p",
        text: "The award lists give you the opening bell. Cross-reference the award date against typical pre-production timelines for the production's budget size, and you can estimate when each department starts writing checks.",
      },
      { type: "h2", text: "How to work the lists yourself" },
      {
        type: "p",
        text: "Start with the film office websites of California, Georgia, New York, New Mexico, Louisiana, and any state where your customers shoot. Find the credit program's award or approval announcements — they're usually PDFs or press pages, published in rounds. Put every round on your calendar. When a new round drops, read the whole list, flag productions whose budget range fits your product, and start identifying who will run the department that buys what you sell.",
      },
      {
        type: "p",
        text: "It's not glamorous work. It's an hour or two per state, every round, forever. But it puts you in front of funded buyers months before they appear in any purchased lead list — because purchased lists are built from what already happened, and award lists are a record of what's about to.",
      },
      {
        type: "p",
        text: "If you'd rather have someone read every list, every filing, and every hiring page for you and report the actionable signals every Tuesday, that's exactly what Hollywood Sales Wire does. But whether you subscribe or not: stop buying stale directories and start reading the award lists. The information is public. Almost nobody in sales uses it.",
      },
    ],
  },
  {
    slug: "why-entertainment-lead-lists-go-stale",
    title: "Why Entertainment Industry Lead Lists Go Stale (and What to Use Instead)",
    description:
      "The $15,000-a-year industry databases are cold before they're sold — and rented to your competitors at the same time. Here's why, and where fresher signal comes from.",
    datePublished: "2026-07-30",
    readMinutes: 5,
    body: [
      {
        type: "p",
        text: "If you sell to film and television productions, you've probably paid for a lead list: an industry database, a festival directory, a scraped export of production company contacts. And you've probably noticed the same thing every buyer of these lists notices — the hit rate is terrible.",
      },
      { type: "h2", text: "The staleness problem is structural" },
      {
        type: "p",
        text: "Productions are temporary companies. A feature film is an LLC that exists for perhaps eighteen months; a season of television isn't much longer. The people change, the offices change, and — most importantly — the buying happens in a short, concentrated burst near the start. A directory compiled last year is a directory of companies whose spending window has already closed.",
      },
      {
        type: "p",
        text: "Even the expensive databases can't escape this. By the time a production is visible enough to be indexed, verified, and packaged into a product, its vendor decisions are largely made. Six months stale is a good day.",
      },
      { type: "h2", text: "The rental problem makes it worse" },
      {
        type: "p",
        text: "List companies don't sell exclusivity; they rent the same names to anyone with a marketing budget. By the time you dial a contact from a purchased list, that person has heard from a dozen vendors working the identical list. You're not just late — you're indistinguishable.",
      },
      { type: "h2", text: "What fresh signal actually looks like" },
      {
        type: "p",
        text: "Fresh signal is anything that reveals funding or buildout before the buying happens. Three sources stand out, and all of them are public: state tax-credit award lists, which name funded productions with budgets and deadlines; public filings, which show money movements and new production entities; and hiring activity, because a production staffing up a department is a production about to equip that department.",
      },
      {
        type: "p",
        text: "None of this is secret. It's just labor-intensive — the information is scattered across state film office PDFs, filing databases, and careers pages, and it has to be read every single week to be useful. That's the actual trade-off: purchased lists are convenient and cold; public signals are fresh and tedious.",
      },
      {
        type: "p",
        text: "Hollywood Sales Wire exists because most salespeople can't spend two days a week reading state filings — so one publisher does it and reports what matters every Tuesday. But the underlying lesson stands on its own: in this industry, the freshest lead list is free. It's just not called a lead list.",
      },
    ],
  },
  {
    slug: "hiring-signals-predict-production-purchases",
    title: "Reading Hiring Signals: How Careers Pages Reveal What Productions Will Buy Next",
    description:
      "Job postings are purchase orders in embryo. How to read studio and production-company hiring pages to predict equipment, software, and services spending.",
    datePublished: "2026-07-30",
    readMinutes: 5,
    body: [
      {
        type: "p",
        text: "Before a production or studio buys anything significant, it hires the person who will use it. That simple fact makes careers pages one of the most underrated sales-intelligence sources in the entertainment industry — and one of the least monitored.",
      },
      { type: "h2", text: "People come before purchase orders" },
      {
        type: "p",
        text: "Nobody buys a virtual-production volume and then looks for someone to run it. The sequence runs the other way: post the job, hire the supervisor, then let the supervisor spec the gear. The same holds across the supply chain. A cluster of post-production hires precedes a post pipeline buildout. A localization manager posting precedes a localization vendor decision. Payroll and production-accounting hires precede back-office system purchases.",
      },
      {
        type: "p",
        text: "Each of those postings is a public announcement that a budget line now exists and a buying decision is coming — usually within a quarter or two.",
      },
      { type: "h2", text: "What to watch for" },
      {
        type: "p",
        text: "The signal isn't any single job posting; it's the pattern. Watch for clusters: several roles in one department appearing within weeks of each other means a buildout, not backfill. Watch for firsts: a company posting its first-ever role of a given type is standing up a new capability and will need everything that capability requires. And watch for seniority order: a department-head posting followed by staff postings means the buying authority arrives first — that department head is your future buyer, reachable in their first weeks on the job, before vendor loyalties form.",
      },
      { type: "h2", text: "Combine hiring with funding and you have timing" },
      {
        type: "p",
        text: "Hiring signals tell you what a company is building. Funding signals — tax-credit awards, filings, announced money flows — tell you it can pay for it. Where the two overlap, you have the closest thing to a guaranteed live prospect this industry offers: a funded organization actively staffing the department that buys what you sell.",
      },
      {
        type: "p",
        text: "Tracking this by hand means checking the careers pages of every studio, streamer, and production company in your territory weekly. That's exactly the kind of systematic reading Hollywood Sales Wire was built to do for its members — but even a manual watch on your ten most important accounts will put you ahead of competitors who wait for the trades to report what the hiring pages announced months earlier.",
      },
    ],
  },
  {
    slug: "timing-the-greenlight-window",
    title: "The Greenlight Window: Timing Your Sales Outreach to the Production Spending Cycle",
    description:
      "Productions buy on a compressed, predictable schedule between funding and principal photography. Map your outreach to that cycle and the same pitch performs dramatically better.",
    datePublished: "2026-07-30",
    readMinutes: 6,
    body: [
      {
        type: "p",
        text: "In most industries, a good prospect stays a good prospect for a year. In film and television, the entire vendor-selection life of a production can fit inside one quarter. Selling into this industry without a timing model is like fishing without knowing when the tide comes in.",
      },
      { type: "h2", text: "The cycle, from greenlight to wrap" },
      {
        type: "p",
        text: "A production's spending follows a recognizable arc. First comes funding — a greenlight, a tax-credit award, financing closing. Then pre-production: department heads hired, stages booked, vendors selected, purchase orders cut. Then principal photography, where money flows fast but to vendors chosen weeks or months earlier. Then post, with its own second wave of decisions around editorial, VFX, sound, and delivery.",
      },
      {
        type: "p",
        text: "For most vendors, the sale is won or lost in pre-production. That stretch — after the money is committed but before the contracts are signed — is the greenlight window.",
      },
      { type: "h2", text: "Why early is almost as bad as late" },
      {
        type: "p",
        text: "Pitching a production before it's funded wastes effort on projects that may never happen, and whoever you reach has no budget authority yet. Pitching after photography starts means the decisions are made. The window has a front edge and a back edge, and both matter. The practical skill is anchoring on a public funding event — an award list, a filing, an announced close — and counting forward: department heads typically arrive within weeks, and vendor decisions follow on their heels.",
      },
      { type: "h2", text: "Post-production is a second window" },
      {
        type: "p",
        text: "Vendors who sell into post get a second chance. Editorial, VFX, sound, music clearance, localization, and delivery decisions often finalize during or after the shoot. If you missed the pre-production window, the post window opens months later — and it's usually less crowded, because most vendors gave up on the production when the cameras rolled.",
      },
      { type: "h2", text: "Build your pipeline around windows, not names" },
      {
        type: "p",
        text: "The discipline shift is simple to state: stop maintaining a list of companies and start maintaining a calendar of windows. Every funded production in your territory gets a projected window based on its funding date and budget size; your outreach schedule falls out of the calendar automatically. Vendors who work this way report the same pitch, the same product, and the same effort producing dramatically different results — because the person on the other end of the phone finally has a live budget and an open decision.",
      },
      {
        type: "p",
        text: "Hollywood Sales Wire's weekly briefing is, at heart, a window calendar maintained for you: who just got funded, what they're about to buy, and when the window closes. But the principle costs nothing to adopt. In this industry, when you call matters more than who you call.",
      },
    ],
  },
];

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}
