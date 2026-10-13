import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useFoundingOffer } from "@workspace/api-client-react";
import { Header, Footer } from "@/components/layout/Shell";
import { orderPath } from "@/lib/foundingDeadline";
import { useFoundingDeadline } from "@/lib/useFoundingDeadline";
import { PricingContent } from "./OrderPage";

function useCountdown(deadlineIso: string | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!deadlineIso) return null;
  const ms = new Date(deadlineIso).getTime() - now;
  if (ms <= 0) return null;
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return { d, h, m, s };
}

/**
 * Two entry paths:
 * - Token link (warm-prospect welcome series): the subscriber's personal
 *   window, verified via /api/founding-offer, then checkout re-checks it.
 * - No token (the public founding offer and cold campaigns): the shared
 *   client deadline from ?d=YYYY-MM-DD, or the next Monday at least 7 days
 *   out at 11:59 PM ET. After that instant, regular rates are shown.
 */
export default function FoundingOfferPage() {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const deadline = useFoundingDeadline();
  const tokenOffer = useFoundingOffer(
    { token },
    { query: { queryKey: ["founding-offer", token], enabled: token !== "", retry: false } },
  );
  const countdown = useCountdown(token !== "" ? tokenOffer.data?.deadline : undefined);

  if (token !== "") {
    const invalid = tokenOffer.isError;
    const isLoading = tokenOffer.isLoading && !invalid;
    const expired = tokenOffer.data ? !tokenOffer.data.active || countdown === null : false;
    const founding = Boolean(tokenOffer.data && tokenOffer.data.active && countdown !== null);
    const orderHref = orderPath(deadline?.overrideDate ?? null);

    return (
      <div className="min-h-screen flex flex-col font-sans text-foreground bg-[#F6F5F2]">
        <Header />
        {isLoading ? (
          <main className="flex-1 flex items-center justify-center py-32">
            <p className="text-muted-foreground font-mono-data text-sm tracking-widest">CHECKING YOUR OFFER…</p>
          </main>
        ) : invalid ? (
          <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-24 text-center">
            <h1 className="text-3xl font-serif font-bold mb-4">This offer link isn't valid</h1>
            <p className="text-muted-foreground mb-8">
              The link may be incomplete — try clicking it again from your email. Membership is always
              available at the regular rate.
            </p>
            <Link href={orderHref} className="inline-block bg-primary text-primary-foreground px-6 py-3 font-serif font-bold">
              See Membership Options
            </Link>
          </main>
        ) : (
          <>
            {founding && countdown && (
              <div className="bg-primary text-primary-foreground py-3 px-4 text-center font-mono-data text-sm tracking-widest">
                YOUR FOUNDING RATE ENDS IN {countdown.d}D {countdown.h}H {countdown.m}M {countdown.s}S — MIDNIGHT ET,{" "}
                {tokenOffer.data?.deadlineLabel?.toUpperCase()}
              </div>
            )}
            {expired && (
              <div className="bg-muted text-muted-foreground py-3 px-4 text-center font-mono-data text-xs tracking-widest">
                YOUR FOUNDING OFFER CLOSED AT MIDNIGHT ET, {tokenOffer.data?.deadlineLabel?.toUpperCase()} — REGULAR RATES BELOW
              </div>
            )}
            <PricingContent
              founding={founding}
              deadline={deadline}
              deadlineLabel={tokenOffer.data?.deadlineLabel}
              checkoutSource={{ token }}
            />
          </>
        )}
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col font-sans text-foreground bg-[#F6F5F2]">
      <Header />
      {!deadline ? (
        <main className="flex-1 flex items-center justify-center py-32">
          <p className="text-muted-foreground font-mono-data text-sm tracking-widest">CHECKING THE OFFER DATE…</p>
        </main>
      ) : (
        <>
          {deadline.closed ? (
            <div
              className="bg-muted text-muted-foreground py-3 px-4 text-center text-sm"
              data-testid="founding-deadline"
            >
              This founding offer {deadline.endedPhrase}. Regular rates are below.
            </div>
          ) : (
            <div
              className="bg-primary text-primary-foreground py-3 px-4 text-center text-sm"
              data-testid="founding-deadline"
            >
              This offer {deadline.endsPhrase} — {deadline.daysLeftLabel}
            </div>
          )}
          <PricingContent founding={!deadline.closed} deadline={deadline} />
        </>
      )}
      <Footer />
    </div>
  );
}
