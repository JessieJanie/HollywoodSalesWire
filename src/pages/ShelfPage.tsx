import { useEffect, useState } from "react";
import { Header, Footer } from "@/components/layout/Shell";
import { SUPPORT_EMAIL } from "@/lib/constants";

interface ShelfReport {
  slug: string;
  title: string;
  url: string;
}

interface ShelfIssue {
  weekKey: string;
  subject: string;
  bodyText: string;
  sentAt: string;
}

interface ShelfData {
  plan: string;
  isFounding: boolean;
  reports: ShelfReport[];
  issues: ShelfIssue[];
}

function issueDate(weekKey: string): string {
  const d = new Date(`${weekKey}T12:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function ShelfPage() {
  const [data, setData] = useState<ShelfData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [formEmail, setFormEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const email = params.get("email");
    const sig = params.get("sig");
    const query =
      email && sig
        ? `?email=${encodeURIComponent(email)}&sig=${encodeURIComponent(sig)}`
        : "";
    fetch(`${import.meta.env.BASE_URL}api/shelf${query}`)
      .then(async (res) => {
        if (!res.ok) {
          if (!query) {
            // No link and no remembered session — show the sign-in form.
            setNeedsSignIn(true);
            return null;
          }
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Could not open your Shelf");
        }
        // Opened via signed link: the server has set the remember-me cookie,
        // so drop the link parameters from the address bar.
        if (query) window.history.replaceState(null, "", window.location.pathname);
        return res.json();
      })
      .then((d) => {
        if (d) setData(d);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  function requestLink(e: React.FormEvent) {
    e.preventDefault();
    if (!formEmail.trim() || sending) return;
    setSending(true);
    fetch(`${import.meta.env.BASE_URL}api/shelf/request-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: formEmail.trim() }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("request failed");
        const body = await res.json().catch(() => ({}));
        setSentMessage(
          body.message ?? "If that address has a membership, your private link is on its way.",
        );
      })
      .catch(() => setSentMessage("Something went wrong — please try again in a minute."))
      .finally(() => setSending(false));
  }

  return (
    <div className="min-h-screen flex flex-col font-sans text-foreground">
      <Header />
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-serif font-bold tracking-tight mb-2">Your Shelf</h1>
        <p className="text-sm text-muted-foreground font-mono-data mb-10">
          EVERY ISSUE AND REPORT WE&apos;VE SENT YOU — YOURS TO KEEP
        </p>

        {error && (
          <div className="border border-border rounded-md p-6 bg-card">
            <p className="leading-relaxed">{error}</p>
            <p className="mt-3 text-sm text-muted-foreground">
              Lost your link? Email{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary underline">
                {SUPPORT_EMAIL}
              </a>{" "}
              from your membership address and we&apos;ll send a fresh one.
            </p>
          </div>
        )}

        {needsSignIn && !data && (
          <div className="border border-border rounded-md p-6 bg-card">
            {sentMessage ? (
              <>
                <p className="font-serif font-bold text-lg mb-2">Check your email</p>
                <p className="leading-relaxed text-sm text-muted-foreground">{sentMessage}</p>
                <p className="mt-3 text-sm text-muted-foreground">
                  Click the link in that email and this browser will remember you from then on.
                </p>
              </>
            ) : (
              <>
                <p className="font-serif font-bold text-lg mb-2">Open your Shelf</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Enter your membership email and we&apos;ll send you your private link. Once you
                  click it, this browser will remember you — no link needed next time.
                </p>
                <form onSubmit={requestLink} className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="flex-1 border border-border rounded-md px-3 py-2 bg-background"
                  />
                  <button
                    type="submit"
                    disabled={sending}
                    className="bg-primary text-primary-foreground rounded-md px-5 py-2 font-medium disabled:opacity-60"
                  >
                    {sending ? "Sending…" : "Email me my link"}
                  </button>
                </form>
                <p className="mt-3 text-xs text-muted-foreground">
                  Trouble getting in? Email{" "}
                  <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary underline">
                    {SUPPORT_EMAIL}
                  </a>
                  .
                </p>
              </>
            )}
          </div>
        )}

        {!error && !needsSignIn && !data && (
          <p className="text-muted-foreground">Opening your Shelf…</p>
        )}

        {data && (
          <>
            <section className="mb-12">
              <h2 className="text-2xl font-serif font-bold mb-1">Special Reports</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Your three Special Reports, included with your membership. These are yours
                permanently.
              </p>
                {data.reports.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Your reports are being prepared — they&apos;ll appear here as soon as they&apos;re
                    ready.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {data.reports.map((r) => (
                      <li key={r.slug} className="border border-border rounded-md bg-card p-4">
                        <a
                          href={r.url}
                          className="font-serif font-bold text-lg text-primary hover:underline"
                        >
                          {r.title}
                        </a>
                        <span className="ml-2 text-xs text-muted-foreground font-mono-data">
                          PDF
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
            </section>

            <section>
              <h2 className="text-2xl font-serif font-bold mb-1">The Wire</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Every weekly issue sent during your membership, newest first.
              </p>
              {data.issues.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Your first issue arrives Tuesday morning — it will appear here as soon as it&apos;s
                  sent.
                </p>
              ) : (
                <ul className="space-y-4">
                  {data.issues.map((issue) => (
                    <li key={issue.weekKey} className="border border-border rounded-md bg-card">
                      <details>
                        <summary className="cursor-pointer p-4">
                          <span className="font-serif font-bold text-lg">{issue.subject}</span>
                          <span className="block text-xs text-muted-foreground font-mono-data mt-1">
                            WEEK OF {issueDate(issue.weekKey).toUpperCase()}
                          </span>
                        </summary>
                        <div className="px-4 pb-4 border-t border-border pt-4 whitespace-pre-wrap leading-relaxed">
                          {issue.bodyText}
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
