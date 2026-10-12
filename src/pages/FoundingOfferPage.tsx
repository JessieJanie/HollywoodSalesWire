import { Header, Footer } from "@/components/layout/Shell";
import { useFoundingDeadline } from "@/lib/useFoundingDeadline";
import { PricingContent } from "./OrderPage";

/**
 * Founding rate while the shared deadline is still open. The date comes from
 * ?d=YYYY-MM-DD when that value is valid, otherwise the next Monday at least
 * 7 days out. After 11:59 PM ET on that date, regular rates are shown.
 */
export default function FoundingOfferPage() {
  const deadline = useFoundingDeadline();

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
