import { Link } from "wouter";
import { Header, Footer } from "@/components/layout/Shell";
import { SUPPORT_EMAIL, FOUNDING_RATE_YR, REGULAR_RATE_YR } from "@/lib/constants";

function LegalLayout({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col font-sans text-foreground">
      <Header />
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-serif font-bold tracking-tight mb-2">{title}</h1>
        <p className="text-sm text-muted-foreground font-mono-data mb-10">LAST UPDATED: {updated}</p>
        <article className="prose prose-zinc max-w-none prose-headings:font-serif prose-headings:font-bold prose-p:leading-relaxed prose-a:text-primary">
          {children}
        </article>
      </main>
      <Footer />
    </div>
  );
}

const UPDATED = "July 28, 2026";

export function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" updated={UPDATED}>
      <h2>What we sell</h2>
      <p>
        Hollywood Sales Wire is a paid subscription intelligence briefing for people who sell products
        and services into the entertainment production industry. A membership includes the weekly Wire
        briefing delivered by email, the monthly Divergence Report, and any bonus materials included
        with your offer at the time of purchase.
      </p>
      <h2>Billing</h2>
      <p>
        Membership is billed annually. The rate shown at checkout is the rate you pay. Founding Member
        pricing (${FOUNDING_RATE_YR.toLocaleString()}/year) remains in effect for as long as your
        membership continues without interruption; if your membership lapses and you rejoin later, the
        then-current rate (currently ${REGULAR_RATE_YR.toLocaleString()}/year) applies.
      </p>
      <h2>Refunds and cancellation</h2>
      <p>
        Every new membership is covered by our 90-Day Money-Back Guarantee — see the{" "}
        <Link href="/refund-policy">Refund Policy</Link> for the full terms. You may cancel your membership at
        any time by emailing <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>; cancellation stops
        future renewals.
      </p>
      <h2>Use of the material</h2>
      <p>
        Your membership is for you (or, for team memberships, for the named seats on your team). The
        briefings and reports are copyrighted material provided for your business use as a subscriber.
        Please don't redistribute, resell, or republish them outside your organization.
      </p>
      <h2>What we are not</h2>
      <p>
        Hollywood Sales Wire is a research and intelligence publication. We are not a law firm, an
        accounting firm, or an investment adviser, and nothing in the Wire is legal, tax, or investment
        advice. We compile information from public sources we believe to be reliable, but we can't
        guarantee that every figure is complete or error-free, and we aren't responsible for business
        decisions you make based on the material.
      </p>
      <h2>Changes to these terms</h2>
      <p>
        If we update these terms, we'll post the new version here and update the date above. Material
        changes affecting active subscribers will also be announced by email.
      </p>
      <h2>Contact</h2>
      <p>
        Questions? Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </LegalLayout>
  );
}

export function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated={UPDATED}>
      <h2>What we collect</h2>
      <p>
        When you subscribe, we collect the information needed to run your membership: your name, email
        address, and company details you choose to provide. Payments are processed by Stripe; your card
        details go directly to Stripe and are never stored on our systems.
      </p>
      <h2>How we use it</h2>
      <p>
        We use your information to deliver the briefings and reports you paid for, to manage your
        account and billing, and to send you service emails about your membership. That's it.
      </p>
      <h2>What we don't do</h2>
      <p>
        We do not sell, rent, or share our subscriber list with anyone. Ever. That is a founding
        principle of this publication, not just a policy line.
      </p>
      <h2>Email</h2>
      <p>
        Membership content arrives by email, so email is part of the product. Marketing emails (as
        opposed to the briefings you subscribed to) always include an unsubscribe link.
      </p>
      <h2>Cookies and analytics</h2>
      <p>
        Our website uses only the cookies necessary for it to function and basic, aggregate analytics to
        understand site traffic. We don't run third-party advertising trackers.
      </p>
      <h2>Your rights</h2>
      <p>
        You can ask us at any time to show you the personal data we hold about you, correct it, or
        delete it (subject to records we're legally required to keep, such as billing records). Email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we'll take care of it.
      </p>
      <h2>Changes</h2>
      <p>
        If this policy changes, we'll post the new version here and update the date above.
      </p>
    </LegalLayout>
  );
}

export function RefundPage() {
  return (
    <LegalLayout title="Refund Policy" updated={UPDATED}>
      <h2>The 90-Day Money-Back Guarantee</h2>
      <p>
        Every new Hollywood Sales Wire membership is covered by a 90-Day Money-Back Guarantee. Use the
        Wire for up to 90 days from your purchase date. If it isn't paying for itself, email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> within those 90 days and we'll refund
        every dollar of your membership fee. No forms, no phone tree, no hard feelings.
      </p>
      <h2>What's covered</h2>
      <p>
        The full annual membership fee you paid, refunded to your original payment method. Refunds are
        processed through Stripe and typically appear within 5–10 business days.
      </p>
      <h2>Keep the reports</h2>
      <p>
        Any Special Reports delivered with your membership are yours to keep even if you refund. We'd
        rather you keep something useful than feel penalized for deciding the Wire isn't for you.
      </p>
      <h2>After 90 days</h2>
      <p>
        After the 90-day window, membership fees for the current term are non-refundable, but you can
        cancel at any time to stop future renewals — email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </LegalLayout>
  );
}
