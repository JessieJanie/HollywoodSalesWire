import { Header, Footer } from "@/components/layout/Shell";
import {
  SUPPORT_EMAIL,
  REGULAR_RATE_YR,
  REGULAR_RATE_WK,
  TEAM_REGULAR_RATE_YR,
  REPORTS_VALUE,
} from "@/lib/constants";

interface Faq {
  q: string;
  a: string;
}

// Answers are also emitted as FAQPage structured data below, so keep them
// plain text (no JSX) and factually in sync with the order and legal pages.
const FAQS: Faq[] = [
  {
    q: "What is Hollywood Sales Wire?",
    a: "Hollywood Sales Wire is a weekly sales-intelligence briefing for vendors, service providers, and dealmakers who sell to the entertainment industry. Every Tuesday, members get the week's live buying signals: who just got funded, what they're about to buy, and when the window closes — drawn from public filings, state tax-credit award lists, government business registries, and studio hiring patterns.",
  },
  {
    q: "How much does Hollywood Sales Wire cost?",
    a: `An individual membership is $${REGULAR_RATE_YR.toLocaleString()} per year — about $${REGULAR_RATE_WK} a week. A team membership (up to five readers) is $${TEAM_REGULAR_RATE_YR.toLocaleString()} per year. Every new membership is covered by a 90-day money-back guarantee.`,
  },
  {
    q: "Where do the leads come from?",
    a: "From public, primary sources read every week: state film-office tax-credit award lists (California, New York, Texas, New Mexico, Georgia), new production-company filings on government business registries in the US and UK, official film-office announcements, and studio job postings that reveal spending before it is announced. Every item in the Wire cites its source.",
  },
  {
    q: "How is this different from a lead database or purchased list?",
    a: "Purchased lead lists are typically months old and rented to many buyers at once, so the contacts are cold and over-pitched. Hollywood Sales Wire reports signals from the current week — productions that just received funding and now have money they must spend on a deadline. The list is never rented or resold, and neither are subscriber names.",
  },
  {
    q: "What exactly arrives every Tuesday?",
    a: "One briefing by email: a short read on the week's money picture, then numbered signal items. Each item names the production or company, what happened (award, filing, report, or announcement, with figures), why money is about to move, and which vendor categories should be calling. Members can also read every issue on their private HSW Shelf on the website.",
  },
  {
    q: "Is there a free version?",
    a: "Yes. The HSW Weekly Brief is a free weekly email with a sample of the week's signals. Sign up on the home page at hollywoodsaleswire.com — free readers are also first in line for member invitations and offers.",
  },
  {
    q: "What are the Special Reports?",
    a: `Three written reports that document the method behind the Wire — how to read tax-credit award lists, entity formations, and hiring signals yourself. Sold separately they total $${REPORTS_VALUE.toLocaleString()}; they are included free with membership and are yours to keep even if you refund.`,
  },
  {
    q: "Who is Hollywood Sales Wire for?",
    a: "Salespeople and owners at companies that sell into film and television production: cameras and equipment, stages and facilities, software, localization, post-production, payroll, insurance, catering, transportation, legal, and other production services. If productions or studios are your buyers, the Wire is your prospecting radar.",
  },
  {
    q: "Can I get a refund if it isn't for me?",
    a: `Yes. Every new membership carries a 90-day money-back guarantee: use the Wire for up to 90 days, and if it isn't paying for itself, email ${SUPPORT_EMAIL} for a full refund of your membership fee. After 90 days, you can cancel anytime to stop future renewals.`,
  },
  {
    q: "Will my contact information be sold or shared?",
    a: "No. The subscriber list is never rented, sold, or shared — that is a stated policy of the publication. You get the briefing; nobody gets you.",
  },
];

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-16">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <p className="font-mono-data text-xs tracking-widest text-muted-foreground uppercase mb-3">
          Questions &amp; Answers
        </p>
        <h1 className="font-serif text-4xl md:text-5xl font-bold tracking-tight mb-4">
          Frequently Asked Questions
        </h1>
        <p className="text-lg text-muted-foreground mb-12">
          Plain answers about what Hollywood Sales Wire is, what it costs, and
          where the leads come from.
        </p>
        <div className="space-y-10">
          {FAQS.map((f) => (
            <section key={f.q}>
              <h2 className="font-serif text-2xl font-bold mb-3">{f.q}</h2>
              <p className="text-base leading-[1.8] text-foreground/90">{f.a}</p>
            </section>
          ))}
        </div>
        <div className="mt-16 border border-border bg-secondary/30 p-8">
          <h2 className="font-serif text-2xl font-bold mb-3 mt-0">
            Still have a question?
          </h2>
          <p className="text-base text-foreground/90 mb-0">
            Email{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:underline">
              {SUPPORT_EMAIL}
            </a>{" "}
            and you'll get an answer from a person.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
