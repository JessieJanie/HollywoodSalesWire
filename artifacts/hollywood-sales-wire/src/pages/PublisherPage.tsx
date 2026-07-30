import { useState } from "react";
import {
  usePublisherStatus,
  usePublisherDraft,
  usePublisherSend,
  usePublisherWireLatest,
  usePublisherWireRun,
} from "@workspace/api-client-react";
import { Loader2, Send, Sparkles, CheckCircle2, RefreshCw, Copy, ExternalLink } from "lucide-react";

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
  const [copied, setCopied] = useState(false);

  const wire = usePublisherWireLatest(
    { key },
    {
      query: {
        queryKey: ["publisher-wire", key],
        enabled: key !== "",
        retry: false,
        refetchInterval: (q) => (q.state.data?.status === "running" ? 15000 : false),
      },
    },
  );
  const runWire = usePublisherWireRun();

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

        {/* Monday auto-draft */}
        <div className="bg-card border border-border p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between gap-4 mb-2">
            <h2 className="font-serif font-bold text-lg">This week's Tuesday Wire draft</h2>
            <button
              onClick={() =>
                runWire.mutate({ data: { key } }, { onSuccess: () => wire.refetch() })
              }
              disabled={runWire.isPending || wire.data?.status === "running"}
              className="inline-flex items-center gap-2 border border-border px-3 py-2 text-sm font-medium disabled:opacity-40 hover:bg-muted"
              data-testid="button-run-research"
            >
              <RefreshCw className={`w-4 h-4 ${wire.data?.status === "running" ? "animate-spin" : ""}`} />
              Run research now
            </button>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Researched and drafted automatically every Monday at 5:00 PM Pacific. Every item
            carries its source link; anything tagged SINGLE SOURCE — VERIFY needs your eye.
          </p>

          {(!wire.data || wire.data.status === "none") && (
            <p className="text-sm text-muted-foreground">No run yet this week.</p>
          )}
          {wire.data?.status === "running" && (
            <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Researching — this takes a few
              minutes. The page updates itself.
            </p>
          )}
          {wire.data?.status === "failed" && (
            <p className="text-sm text-red-700">
              Last run failed{wire.data.error ? `: ${wire.data.error}` : "."} Press "Run
              research now" to retry.
            </p>
          )}
          {wire.data?.status === "ready" && wire.data.wireMarkdown && (
            <>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-mono-data tracking-widest text-muted-foreground">
                  PAID WIRE DRAFT — WEEK OF {wire.data.weekKey}
                </span>
                <button
                  onClick={() => {
                    void navigator.clipboard.writeText(wire.data?.wireMarkdown ?? "");
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary"
                  data-testid="button-copy-wire"
                >
                  <Copy className="w-3 h-3" /> {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <textarea
                readOnly
                value={wire.data.wireMarkdown}
                rows={16}
                className="w-full border border-border bg-background p-3 text-sm font-mono leading-relaxed focus:outline-none"
                data-testid="text-wire-draft"
              />
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <button
                  onClick={() => {
                    setWireText(wire.data?.wireMarkdown ?? "");
                    if (wire.data?.freeSubject) setSubject(wire.data.freeSubject);
                    if (wire.data?.freeBody) setBodyText(wire.data.freeBody);
                    setSentCount(null);
                  }}
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 text-sm font-serif font-bold"
                  data-testid="button-use-drafts"
                >
                  <Sparkles className="w-4 h-4" /> Load the Free Edition draft below
                </button>
              </div>
              {Array.isArray(wire.data.sources) && wire.data.sources.length > 0 && (
                <details className="mt-4">
                  <summary className="text-sm font-medium cursor-pointer">
                    Sources read this run ({wire.data.sources.length})
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {wire.data.sources.map((s) => (
                      <li key={s.url} className="text-xs text-muted-foreground">
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {s.label}
                        </a>{" "}
                        — {s.wordCount} words, {s.status}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </div>

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
