import { useState } from "react";
import { useSubscribe } from "@workspace/api-client-react";
import { Mail, CheckCircle2 } from "lucide-react";

export default function PreviewSignup() {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState(""); // honeypot — hidden from real users
  const subscribe = useSubscribe();

  const done = subscribe.isSuccess;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || subscribe.isPending) return;
    subscribe.mutate({ data: { email: email.trim(), ...(company ? { company } : {}) } as never });
  };

  return (
    <div className="bg-secondary/30 border border-border p-8 my-16 not-prose">
      <h3 className="text-2xl mt-0 mb-2 flex items-center gap-3 font-serif font-bold">
        <Mail className="w-6 h-6 text-primary" />
        Get a Free Preview Briefing
      </h3>
      <p className="text-base text-muted-foreground mb-6">
        Not ready to join? Enter your email and I'll send you a preview of the
        Tuesday wire — plus a short series on how to read the signals yourself.
        Unsubscribe anytime.
      </p>
      {done ? (
        <div className="flex items-center gap-3 text-primary font-serif text-lg">
          <CheckCircle2 className="w-6 h-6" />
          You're on the list — the preview is on its way.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            name="company"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="hidden"
          />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="work@email.com"
            className="flex-1 px-4 py-3 border border-border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary/40"
            aria-label="Email address"
          />
          <button
            type="submit"
            disabled={subscribe.isPending}
            className="bg-primary text-primary-foreground px-6 py-3 font-sans text-sm font-semibold tracking-wide hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {subscribe.isPending ? "Sending…" : "Send Me the Preview"}
          </button>
        </form>
      )}
      {subscribe.isError && (
        <p className="text-sm text-destructive mt-3">
          Something went wrong — please check the address and try again.
        </p>
      )}
    </div>
  );
}
