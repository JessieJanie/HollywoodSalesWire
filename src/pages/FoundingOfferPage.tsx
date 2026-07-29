import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useFoundingOffer } from "@workspace/api-client-react";
import { Header, Footer } from "@/components/layout/Shell";
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
 * Private page reached only from the email series. Shows the Founding rate
 * while the subscriber's personal 14-day window is open; after their deadline
 * (midnight Eastern) it genuinely flips to the regular rate.
 */
export default function FoundingOfferPage() {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const offer = useFoundingOffer(
    { token },
    { query: { queryKey: ["founding-offer", token], enabled: token !== "", retry: false } },
  );
  const countdown = useCountdown(offer.data?.deadline);

  const invalid = token === "" || offer.isError;
  const expired = offer.data ? !offer.data.active || countdown === null : false;
  const founding = Boolean(offer.data && offer.data.active && countdown !== null);

  return (
    <div className="min-h-screen flex flex-col font-sans text-foreground bg-[#F6F5F2]">
      <Header />
      {offer.isLoading && !invalid ? (
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
          <Link href="/order" className="inline-block bg-primary text-primary-foreground px-6 py-3 font-serif font-bold">
            See Membership Options
          </Link>
        </main>
      ) : (
        <>
          {founding && countdown && (
            <div className="bg-primary text-primary-foreground py-3 px-4 text-center font-mono-data text-sm tracking-widest">
              YOUR FOUNDING RATE ENDS IN {countdown.d}D {countdown.h}H {countdown.m}M {countdown.s}S — MIDNIGHT ET,{" "}
              {offer.data?.deadlineLabel?.toUpperCase()}
            </div>
          )}
          {expired && (
            <div className="bg-muted text-muted-foreground py-3 px-4 text-center font-mono-data text-xs tracking-widest">
              YOUR FOUNDING OFFER CLOSED AT MIDNIGHT ET, {offer.data?.deadlineLabel?.toUpperCase()} — REGULAR RATES BELOW
            </div>
          )}
          <PricingContent founding={founding} deadlineLabel={offer.data?.deadlineLabel} token={token} />
        </>
      )}
      <Footer />
    </div>
  );
}
