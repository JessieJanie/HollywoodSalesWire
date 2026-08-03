import { Header, Footer } from "@/components/layout/Shell";
import {
  CHECKOUT_LINKS,
  FOUNDING_RATE_WK,
  FOUNDING_RATE_YR,
  REGULAR_RATE_WK,
  REGULAR_RATE_YR,
  TEAM_FOUNDING_RATE_YR,
  TEAM_REGULAR_RATE_YR
} from "@/lib/constants";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Lock, ShieldCheck, Users, User } from "lucide-react";

/**
 * Pricing content shared between the public order page (regular rate) and the
 * private founding-offer page (founding rate, reached only from email links
 * while the subscriber's personal deadline is still open).
 */
export function PricingContent({
  founding,
  deadlineLabel,
  token,
}: {
  founding: boolean;
  deadlineLabel?: string;
  token?: string;
}) {
  const indWk = founding ? FOUNDING_RATE_WK : REGULAR_RATE_WK;
  const indYr = founding ? FOUNDING_RATE_YR : REGULAR_RATE_YR;
  const teamYr = founding ? TEAM_FOUNDING_RATE_YR : TEAM_REGULAR_RATE_YR;
  // Founding checkout is never linked directly — the server re-verifies the
  // subscriber's deadline before redirecting to Stripe.
  const foundingCheckout = (plan: string) =>
    `${import.meta.env.BASE_URL}api/founding-checkout?token=${encodeURIComponent(token ?? "")}&plan=${plan}`;
  const indLink = founding ? foundingCheckout("individual") : CHECKOUT_LINKS.INDIVIDUAL_REGULAR;
  const teamLink = founding ? foundingCheckout("team") : CHECKOUT_LINKS.TEAM_REGULAR;

  const individualFeatures = founding
    ? [
        "52 issues of the Tuesday Wire",
        "12 issues of The Divergence Report",
        <span key="1"><strong>Bonus:</strong> The Spend Map ($795 value)</span>,
        <span key="2"><strong>Bonus:</strong> The $6.6 Billion Greenlight Window ($695 value)</span>,
        <span key="3"><strong>Bonus:</strong> The Requisition Read ($495 value)</span>,
        "90-day money-back guarantee"
      ]
    : [
        "52 issues of the Tuesday Wire",
        "12 issues of The Divergence Report",
        <span key="1"><strong>Bonus:</strong> The Spend Map ($795 value)</span>,
        <span key="2"><strong>Bonus:</strong> The $6.6 Billion Greenlight Window ($695 value)</span>,
        <span key="3"><strong>Bonus:</strong> The Requisition Read ($495 value)</span>,
        "90-day money-back guarantee"
      ];

  return (
    <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
      <div className="text-center max-w-3xl mx-auto mb-16">
        {founding && deadlineLabel && (
          <span className="inline-block px-3 py-1 bg-accent text-accent-foreground text-xs font-mono-data font-bold tracking-widest mb-6 shadow-sm">
            YOUR FOUNDING OFFER CLOSES MIDNIGHT ET, {deadlineLabel.toUpperCase()}
          </span>
        )}
        <h1 className="text-4xl sm:text-5xl font-serif font-bold tracking-tight mb-6 text-balance">
          {founding ? "Secure Your Founding Membership" : "Become a Member"}
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed text-balance max-w-2xl mx-auto">
          {founding
            ? "Lock in the half-price rate for as long as your membership continues. Get the three Special Reports ($1,985 value) immediately, free to keep forever. Backed by a 90-day money-back guarantee."
            : "Every Tuesday: the week's live buying signals — who just got funded, what they're about to buy, and when the window closes. Plus three Special Reports ($1,985 value) free with your membership. Backed by a 90-day money-back guarantee."}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 items-stretch max-w-4xl mx-auto">
        {/* Individual Tier */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-card border-t-4 border-t-primary shadow-2xl relative flex flex-col"
        >
          <div className="p-8 pb-6 border-b border-border bg-secondary/10">
            <div className="flex items-center gap-2 mb-3 text-primary">
              <User className="w-5 h-5" />
              <h2 className="text-xl font-mono-data font-bold tracking-widest m-0">INDIVIDUAL</h2>
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-5xl font-serif font-bold tracking-tight">${indWk}</span>
              <span className="text-muted-foreground font-medium">/ week</span>
            </div>
            <p className="text-sm font-mono-data text-muted-foreground mb-4">
              BILLED ANNUALLY AS ${indYr.toLocaleString()}
            </p>
            {founding ? (
              <>
                <div className="inline-block px-2 py-1 bg-muted text-xs font-medium text-muted-foreground line-through mb-1">
                  Regular Rate: ${REGULAR_RATE_WK}/wk (${REGULAR_RATE_YR.toLocaleString()}/yr)
                </div>
                <p className="text-sm font-medium mt-2 text-primary">
                  Rate locked for as long as membership continues.
                </p>
              </>
            ) : (
              <p className="text-sm font-medium mt-2 text-primary">
                One closed deal sourced from one issue pays for years of it.
              </p>
            )}
          </div>

          <div className="p-8 flex-1 flex flex-col">
            <ul className="space-y-4 mb-8 flex-1">
              {individualFeatures.map((feature, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-sm leading-relaxed text-foreground/90">{feature}</span>
                </li>
              ))}
            </ul>

            <a
              href={indLink}
              target="_blank"
              rel="noopener noreferrer"
              className="group w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-4 sm:py-5 text-lg font-serif font-bold hover:bg-primary/90 transition-all shadow-md hover:shadow-xl hover:-translate-y-0.5"
            >
              Join as Individual <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </a>
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground font-mono-data opacity-80">
              <Lock className="w-3 h-3" /> SECURE STRIPE CHECKOUT
            </div>
          </div>
        </motion.div>

        {/* Team Tier */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-card border border-border shadow-lg flex flex-col"
        >
          <div className="p-8 pb-6 border-b border-border bg-secondary/10">
            <div className="flex items-center gap-2 mb-3 text-muted-foreground">
              <Users className="w-5 h-5" />
              <h2 className="text-xl font-mono-data font-bold tracking-widest m-0">TEAM</h2>
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-5xl font-serif font-bold tracking-tight">${teamYr.toLocaleString()}</span>
              <span className="text-muted-foreground font-medium">/ year</span>
            </div>
            <p className="text-sm font-mono-data text-muted-foreground mb-4">
              COVERS UP TO 5 SEATS
            </p>
            {founding && (
              <div className="inline-block px-2 py-1 bg-muted text-xs font-medium text-muted-foreground line-through mb-1">
                Regular Rate: ${TEAM_REGULAR_RATE_YR.toLocaleString()}/yr
              </div>
            )}
            <p className="text-sm font-medium mt-2 text-foreground/80">
              Equips your entire core sales team.
            </p>
          </div>

          <div className="p-8 flex-1 flex flex-col">
            <ul className="space-y-4 mb-8 flex-1">
              {[
                founding ? "Everything in Individual Founding" : "Everything in Individual",
                "5 separate inbox deliveries",
                "Single unified billing",
                "Seat reassignment as team changes",
                ...(founding ? ["Rate lock applies to the whole team"] : [])
              ].map((feature, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                  <span className="text-sm leading-relaxed text-foreground/80">{feature}</span>
                </li>
              ))}
            </ul>

            <a
              href={teamLink}
              target="_blank"
              rel="noopener noreferrer"
              className="group w-full inline-flex items-center justify-center gap-2 bg-secondary text-secondary-foreground px-6 py-4 sm:py-5 text-lg font-serif font-bold hover:bg-border transition-all border border-border"
            >
              Join as Team <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </a>
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground font-mono-data opacity-60">
              <Lock className="w-3 h-3" /> SECURE STRIPE CHECKOUT
            </div>
          </div>
        </motion.div>
      </div>

      {/* Guarantee Box */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.3 }}
        className="max-w-3xl mx-auto mt-16 p-8 sm:p-10 border border-border bg-card flex flex-col sm:flex-row gap-6 sm:gap-8 items-start shadow-sm"
      >
        <div className="bg-secondary p-4 rounded-full shrink-0">
          <ShieldCheck className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h3 className="text-2xl font-serif font-bold mb-3">The 90-Day Money-Back Guarantee</h3>
          <p className="text-muted-foreground leading-relaxed text-base">
            {founding
              ? "If Hollywood Sales Wire hasn't put live, workable prospects in front of you within 90 days, we'll refund every penny of your membership. You keep the three Special Reports ($1,985 value) and every issue delivered as a professional courtesy. The risk is entirely on our side of the table."
              : "If Hollywood Sales Wire hasn't put live, workable prospects in front of you within 90 days, we'll refund every penny of your membership. You keep the three Special Reports ($1,985 value) and every issue delivered as a professional courtesy. The risk is entirely on our side of the table."}
          </p>
        </div>
      </motion.div>
    </main>
  );
}

export default function OrderPage() {
  return (
    <div className="min-h-screen flex flex-col font-sans text-foreground bg-[#F6F5F2]">
      <Header />
      <PricingContent founding={false} />
      <Footer />
    </div>
  );
}
