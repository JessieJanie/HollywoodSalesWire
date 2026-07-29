import { Link } from "wouter";
import { Header, Footer } from "@/components/layout/Shell";
import { SUPPORT_EMAIL } from "@/lib/constants";

export default function SupportPage() {
  return (
    <div className="min-h-screen flex flex-col font-sans text-foreground">
      <Header />
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-serif font-bold tracking-tight mb-2">Support</h1>
        <p className="text-sm text-muted-foreground font-mono-data mb-10">WE ANSWER OUR OWN EMAIL</p>
        <article className="prose prose-zinc max-w-none prose-headings:font-serif prose-headings:font-bold prose-p:leading-relaxed prose-a:text-primary">
          <h2>Contact us</h2>
          <p>
            The fastest way to reach us is email:{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. We reply to every message,
            typically within one business day.
          </p>
          <h2>Billing questions</h2>
          <p>
            All payments are processed securely by Stripe. If you have a question about a charge,
            need a copy of a receipt, or want to update your payment method, email{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> from the address on your
            membership and we'll sort it out.
          </p>
          <h2>Cancellations</h2>
          <p>
            You can cancel your membership at any time — just email{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we'll stop future renewals.
            No forms, no phone tree.
          </p>
          <h2>Refunds</h2>
          <p>
            Every new membership is covered by our 90-Day Money-Back Guarantee. See the{" "}
            <Link href="/refund-policy">Refund Policy</Link> for the full terms, or just email us
            within 90 days of purchase and we'll refund every dollar.
          </p>
          <h2>Not receiving the briefing?</h2>
          <p>
            The Wire is delivered by email. If an issue hasn't arrived, check your spam or
            promotions folder first, then email{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we'll make sure your
            address is set up correctly and resend anything you missed.
          </p>
        </article>
      </main>
      <Footer />
    </div>
  );
}
