import { useState } from "react";
import {
  usePublisherStatus,
  usePublisherDraft,
  usePublisherSend,
} from "@workspace/api-client-react";
import { Loader2, Send, Sparkles, CheckCircle2 } from "lucide-react";

/**
 * Private weekly-preview console. Reached only via the publisher's bookmarked
 * link (/publisher?key=...); every API call re-verifies the key server-side.
 */
export default function PublisherPage() {
  const key = new URLSearchParams(window.location.search).get("key") ?? "";
  const status = usePublisherStatus(
    { key },
    { query: { queryKey: ["publisher-status", key], enabled: key !== "", retry: false } },
  );
  const draft = usePublisherDraft();
  const send = usePublisherSend();

  const [wireText, setWireText] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [sentCount, setSentCount] = useState<number | null>(null);

  if (!key || status.isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F6F5F2] font-sans">
        <p className="text-muted-foreground">This page requires your private publisher link.</p>
      </div>
    );
  }

  const handleDraft = () =>
    draft.mutate(
      { data: { key, wireText } },
      {
        onSuccess: (d) => {
          setSubject(d.subject);
          setBodyText(d.bodyText);
          setSentCount(null);
        },
      },
    );

  const handleSend = () => {
    const n = status.data?.subscriberCount ?? 0;
    if (!window.confirm(`Send "${subject}" to ${n} subscriber${n === 1 ? "" : "s"} now?`)) return;
    send.mutate(
      { data: { key, subject, bodyText } },
      { onSuccess: (r) => { setSentCount(r.sent); status.refetch(); } },
    );
  };

  return (
    <div className="min-h-screen bg-[#F6F5F2] font-sans text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <p className="font-mono-data text-xs tracking-widest text-muted-foreground mb-2">
          HOLLYWOOD SALES WIRE — PUBLISHER CONSOLE
        </p>
        <h1 className="text-3xl font-serif font-bold mb-2">Weekly Free Edition</h1>
        <p className="text-muted-foreground mb-8">
          {status.data
            ? <>Your free list has <strong>{status.data.subscriberCount}</strong> active subscriber{status.data.subscriberCount === 1 ? "" : "s"}.{status.data.lastSubject && <> Last sent: &ldquo;{status.data.lastSubject}&rdquo;.</>}</>
            : "Loading…"}
        </p>

        {/* Step 1 */}
        <div className="bg-card border border-border p-6 mb-6 shadow-sm">
          <h2 className="font-serif font-bold text-lg mb-2">1. Paste this week's full Wire</h2>
          <p className="text-sm text-muted-foreground mb-4">
            The system drafts a condensed free edition — no buyer names, no contacts, no deal
            specifics. You review everything before it goes anywhere.
          </p>
          <textarea
            value={wireText}
            onChange={(e) => setWireText(e.target.value)}
            rows={10}
            placeholder="Paste the full text of this week's paid issue here…"
            className="w-full border border-border bg-background p-3 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            onClick={handleDraft}
            disabled={wireText.trim().length < 100 || draft.isPending}
            className="mt-4 inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-3 font-serif font-bold disabled:opacity-40"
          >
            {draft.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {draft.isPending ? "Drafting…" : "Draft the free edition"}
          </button>
          {draft.isError && (
            <p className="mt-3 text-sm text-red-700">Drafting failed — please try again.</p>
          )}
        </div>

        {/* Step 2 */}
        {(subject || bodyText) && (
          <div className="bg-card border border-border p-6 mb-6 shadow-sm">
            <h2 className="font-serif font-bold text-lg mb-4">2. Review &amp; edit</h2>
            <label className="block text-xs font-mono-data tracking-widest text-muted-foreground mb-1">
              SUBJECT LINE
            </label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full border border-border bg-background p-3 text-base font-serif mb-4 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <label className="block text-xs font-mono-data tracking-widest text-muted-foreground mb-1">
              BODY (plain paragraphs — the email adds your branding, button, and unsubscribe link)
            </label>
            <textarea
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              rows={14}
              className="w-full border border-border bg-background p-3 text-base leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/40"
            />

            <div className="mt-6 flex items-center gap-4">
              <button
                onClick={handleSend}
                disabled={send.isPending || subject.trim().length < 3 || bodyText.trim().length < 50}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 font-serif font-bold disabled:opacity-40"
              >
                {send.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {send.isPending ? "Sending…" : `Send to ${status.data?.subscriberCount ?? "…"} subscribers`}
              </button>
              {sentCount !== null && (
                <span className="inline-flex items-center gap-2 text-primary font-medium">
                  <CheckCircle2 className="w-5 h-5" /> Sent to {sentCount}!
                </span>
              )}
            </div>
            {send.isError && (
              <p className="mt-3 text-sm text-red-700">
                Sending failed — nothing (or not everything) went out. Please try again.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
