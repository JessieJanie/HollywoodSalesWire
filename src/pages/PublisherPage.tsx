import { useRef, useState } from "react";
import { WireRenderer } from "../components/WireRenderer";
import {
  usePublisherStatus,
  usePublisherDraft,
  usePublisherSend,
  usePublisherWireLatest,
  usePublisherWireRun,
  usePublisherWireSave,
  usePublisherPaidSend,
  usePublisherReports,
  usePublisherReportsUploadUrl,
  usePublisherReportsConfirm,
  usePublisherCompMember,
} from "@workspace/api-client-react";
import {
  Loader2,
  Send,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Copy,
  ExternalLink,
  Upload,
  FileText,
} from "lucide-react";

/**
 * Private weekly-preview console. Reached only via the publisher's bookmarked
 * link (/publisher?key=...); every API call re-verifies the key server-side.
 */
const PUBLISHER_KEY_STORAGE = "hsw-publisher-key";

/** Read the key from the URL (and remember it), else from this browser's storage. */
function resolvePublisherKey(): string {
  const urlKey = new URLSearchParams(window.location.search).get("key") ?? "";
  if (urlKey) {
    try {
      localStorage.setItem(PUBLISHER_KEY_STORAGE, urlKey);
      // Only drop the key from the address bar once the browser has
      // actually remembered it (private browsing may block storage —
      // in that case keep the key in the URL so refresh still works).
      window.history.replaceState(null, "", window.location.pathname);
    } catch {
      /* private browsing — keep key in URL */
    }
    return urlKey;
  }
  try {
    return localStorage.getItem(PUBLISHER_KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

export default function PublisherPage() {
  const [key] = useState(resolvePublisherKey);
  const status = usePublisherStatus(
    { key },
    { query: { queryKey: ["publisher-status", key], enabled: key !== "", retry: false } },
  );
  const draft = usePublisherDraft();
  const send = usePublisherSend();
  const paidSend = usePublisherPaidSend();

  const [wireText, setWireText] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [sentCount, setSentCount] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [paidSubject, setPaidSubject] = useState("");
  const [paidBody, setPaidBody] = useState("");
  const [paidSentCount, setPaidSentCount] = useState<number | null>(null);
  const [wireEditText, setWireEditText] = useState<string | null>(null); // null = not in edit mode
  const [wireSaved, setWireSaved] = useState(false);
  const wireSave = usePublisherWireSave();

  // Complimentary member
  const compMember = usePublisherCompMember();
  const [compEmail, setCompEmail] = useState("");
  const [compPlan, setCompPlan] = useState("founding-individual");
  const [compResult, setCompResult] = useState<string | null>(null);

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

  // Special Reports
  const reports = usePublisherReports(
    { key },
    { query: { queryKey: ["publisher-reports", key], enabled: key !== "", retry: false } },
  );
  const getUploadUrl = usePublisherReportsUploadUrl();
  const confirmUpload = usePublisherReportsConfirm();
  const [uploadingSlug, setUploadingSlug] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedSlugs, setUploadedSlugs] = useState<Set<string>>(new Set());
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function handleFileSelect(slug: string, file: File) {
    setUploadingSlug(slug);
    setUploadError(null);
    try {
      // 1. Get presigned URL
      const { uploadUrl } = await getUploadUrl.mutateAsync({ data: { key, slug } });

      // 2. Upload directly to GCS
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
        body: file,
      });
      if (!putRes.ok) throw new Error(`Upload failed: ${putRes.status}`);

      // 3. Confirm with our server
      await confirmUpload.mutateAsync({ data: { key, slug, uploadedUrl: uploadUrl } });

      setUploadedSlugs((prev) => new Set([...prev, slug]));
      reports.refetch();
    } catch (err) {
      console.error("upload error:", err);
      setUploadError(`Upload failed for "${slug}" — please try again.`);
    } finally {
      setUploadingSlug(null);
    }
  }

  if (!key || status.isError) {
    // A stored key that no longer verifies is stale — forget it so the next
    // click on the emailed link starts clean.
    try {
      localStorage.removeItem(PUBLISHER_KEY_STORAGE);
    } catch {
      /* ignore */
    }
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

  const handlePaidSend = () => {
    const n = status.data?.memberCount ?? 0;
    if (!window.confirm(`Send the full paid Wire "${paidSubject}" to ${n} member${n === 1 ? "" : "s"} now? This can only be done once per week.`)) return;
    paidSend.mutate(
      { data: { key, subject: paidSubject, bodyText: paidBody } },
      { onSuccess: (r) => { setPaidSentCount(r.sent); status.refetch(); } },
    );
  };

  const handleSend = () => {
    const n = status.data?.subscriberCount ?? 0;
    if (!window.confirm(`Send "${subject}" to ${n} subscriber${n === 1 ? "" : "s"} now?`)) return;
    send.mutate(
      { data: { key, subject, bodyText } },
      { onSuccess: (r) => { setSentCount(r.sent); status.refetch(); } },
    );
  };

  const allReportsUploaded =
    reports.data?.reports.every((r) => r.uploaded || uploadedSlugs.has(r.slug)) ?? false;

  return (
    <div className="min-h-screen bg-[#F6F5F2] font-sans text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <p className="font-mono-data text-xs tracking-widest text-muted-foreground mb-2">
          HOLLYWOOD SALES WIRE — PUBLISHER CONSOLE
        </p>
        <h1 className="text-3xl font-serif font-bold mb-8">Publisher Console</h1>

        {/* ---------------------------------------------------------------- */}
        {/* Special Reports                                                   */}
        {/* ---------------------------------------------------------------- */}
        <div className="bg-card border border-border p-6 mb-6 shadow-sm">
          <h2 className="font-serif font-bold text-lg mb-1">Special Reports</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Upload a PDF for each report. Once all three are uploaded, any members who
            haven't received them yet will be emailed automatically. New members are
            emailed immediately after purchase.
          </p>

          {reports.isLoading && (
            <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </p>
          )}

          {reports.data && (
            <>
              <div className="space-y-3 mb-4">
                {reports.data.reports.map((report) => {
                  const isUploaded = report.uploaded || uploadedSlugs.has(report.slug);
                  const isUploading = uploadingSlug === report.slug;
                  return (
                    <div
                      key={report.slug}
                      className="flex items-center justify-between gap-4 border border-border p-4 bg-background"
                    >
                      <div className="flex items-center gap-3">
                        <FileText
                          className={`w-5 h-5 flex-shrink-0 ${isUploaded ? "text-primary" : "text-muted-foreground"}`}
                        />
                        <div>
                          <p className="font-medium text-sm">{report.title}</p>
                          {isUploaded && report.uploadedAt && (
                            <p className="text-xs text-muted-foreground">
                              Uploaded {new Date(report.uploadedAt).toLocaleDateString()}
                            </p>
                          )}
                          {isUploaded && uploadedSlugs.has(report.slug) && !report.uploadedAt && (
                            <p className="text-xs text-muted-foreground">Just uploaded</p>
                          )}
                          {!isUploaded && (
                            <p className="text-xs text-amber-700">Not yet uploaded</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isUploaded && (
                          <span className="inline-flex items-center gap-1 text-xs text-primary font-medium">
                            <CheckCircle2 className="w-4 h-4" /> Ready
                          </span>
                        )}
                        <input
                          ref={(el) => { fileInputRefs.current[report.slug] = el; }}
                          type="file"
                          accept=".pdf,application/pdf"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void handleFileSelect(report.slug, file);
                            e.target.value = "";
                          }}
                        />
                        <button
                          onClick={() => fileInputRefs.current[report.slug]?.click()}
                          disabled={isUploading}
                          className="inline-flex items-center gap-1.5 border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-40"
                        >
                          {isUploading ? (
                            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…</>
                          ) : (
                            <><Upload className="w-3.5 h-3.5" /> {isUploaded ? "Replace" : "Upload PDF"}</>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {uploadError && (
                <p className="text-sm text-red-700 mb-3">{uploadError}</p>
              )}

              {allReportsUploaded && (
                <p className="inline-flex items-center gap-2 text-sm text-primary font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  All three reports are uploaded and will be delivered automatically to members.
                  {(reports.data.pendingMemberCount ?? 0) > 0 && (
                    <> {reports.data.pendingMemberCount} member{reports.data.pendingMemberCount === 1 ? "" : "s"} will receive them now.</>
                  )}
                </p>
              )}
            </>
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Complimentary member                                              */}
        {/* ---------------------------------------------------------------- */}
        <div className="bg-card border border-border p-6 mb-6 shadow-sm">
          <h2 className="font-serif font-bold text-lg mb-1">Add a Complimentary Member</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Adds a member without billing. They get the standard welcome email with their Shelf
            link, the three Special Reports (once uploaded), and the latest Wire issue.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              value={compEmail}
              onChange={(e) => setCompEmail(e.target.value)}
              placeholder="member@example.com"
              className="flex-1 border border-border bg-background px-3 py-2 text-sm"
            />
            <select
              value={compPlan}
              onChange={(e) => setCompPlan(e.target.value)}
              className="border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="founding-individual">Founding — Individual</option>
              <option value="founding-team">Founding — Team</option>
              <option value="individual">Individual</option>
              <option value="team">Team</option>
            </select>
            <button
              onClick={() =>
                compMember.mutate(
                  { data: { key, email: compEmail.trim(), plan: compPlan as never } },
                  {
                    onSuccess: (r) => {
                      setCompResult(
                        r.welcomed
                          ? `Added ${compEmail.trim()} — welcome email sent.`
                          : `${compEmail.trim()} is already a member — nothing re-sent.`,
                      );
                      setCompEmail("");
                    },
                    onError: () => setCompResult("Could not add the member — please try again."),
                  },
                )
              }
              disabled={compMember.isPending || compEmail.trim() === ""}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {compMember.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Add member
            </button>
          </div>
          {compResult && <p className="mt-3 text-sm text-primary">{compResult}</p>}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Free subscribers status                                           */}
        {/* ---------------------------------------------------------------- */}
        <p className="font-mono-data text-xs tracking-widest text-muted-foreground mb-2">
          WEEKLY FREE EDITION
        </p>
        <p className="text-muted-foreground mb-6">
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
                    void navigator.clipboard.writeText(wireEditText ?? wire.data?.wireMarkdown ?? "");
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary"
                  data-testid="button-copy-wire"
                >
                  <Copy className="w-3 h-3" /> {copied ? "Copied!" : "Copy"}
                </button>
                {wireEditText === null ? (
                  <button
                    onClick={() => { setWireEditText(wire.data?.wireMarkdown ?? ""); setWireSaved(false); }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    Edit
                  </button>
                ) : (
                  <>
                    <button
                      disabled={wireSave.isPending}
                      onClick={() => {
                        wireSave.mutate(
                          { data: { key, wireMarkdown: wireEditText } },
                          {
                            onSuccess: () => {
                              void wire.refetch();
                              setWireSaved(true);
                              setTimeout(() => setWireSaved(false), 3000);
                            },
                          },
                        );
                      }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary disabled:opacity-50"
                    >
                      {wireSave.isPending ? "Saving…" : wireSaved ? "Saved ✓" : "Save"}
                    </button>
                    <button
                      onClick={() => { setWireEditText(null); setWireSaved(false); }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
              {wireEditText === null ? (
                <WireRenderer markdown={wire.data.wireMarkdown} />
              ) : (
                <textarea
                  value={wireEditText}
                  onChange={(e) => setWireEditText(e.target.value)}
                  rows={20}
                  className="w-full border border-border bg-background p-3 text-sm font-mono leading-relaxed focus:outline-none"
                  data-testid="text-wire-draft"
                />
              )}
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <button
                  onClick={() => {
                    setWireText(wireEditText ?? wire.data?.wireMarkdown ?? "");
                    if (wire.data?.freeSubject) setSubject(wire.data.freeSubject);
                    if (wire.data?.freeBody) setBodyText(wire.data.freeBody);
                    setSentCount(null);
                  }}
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 text-sm font-serif font-bold"
                  data-testid="button-use-drafts"
                >
                  <Sparkles className="w-4 h-4" /> Load the HSW Weekly Brief draft below
                </button>
                <button
                  onClick={() => {
                    setPaidBody(wireEditText ?? wire.data?.wireMarkdown ?? "");
                    if (wire.data?.weekKey) setPaidSubject(`Hollywood Sales Wire — Week of ${wire.data.weekKey}`);
                    setPaidSentCount(null);
                  }}
                  className="inline-flex items-center gap-2 border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
                  data-testid="button-load-paid-wire"
                >
                  <Send className="w-4 h-4" /> Load as this week&rsquo;s paid Wire
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

        {/* Paid Wire send */}
        <div className="bg-card border border-border p-6 mb-6 shadow-sm">
          <h2 className="font-serif font-bold text-lg mb-2">Send the paid Wire to members</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {status.data
              ? <>You have <strong>{status.data.memberCount}</strong> paying member{status.data.memberCount === 1 ? "" : "s"}.{status.data.lastPaidSubject && <> Last paid send: &ldquo;{status.data.lastPaidSubject}&rdquo;.</>}{" "}The full Wire goes out exactly as you paste it — one send per week, and nothing goes out until you click send.</>
              : "Loading…"}
          </p>
          {status.data?.paidSentThisWeek ? (
            <p className="inline-flex items-center gap-2 text-primary font-medium" data-testid="text-paid-already-sent">
              <CheckCircle2 className="w-5 h-5" /> This week&rsquo;s paid Wire has already gone out to members.
            </p>
          ) : (
            <>
              <label className="block text-xs font-mono-data tracking-widest text-muted-foreground mb-1">
                SUBJECT LINE
              </label>
              <input
                value={paidSubject}
                onChange={(e) => setPaidSubject(e.target.value)}
                placeholder="Hollywood Sales Wire — Week of …"
                className="w-full border border-border bg-background p-3 text-base font-serif mb-4 focus:outline-none focus:ring-2 focus:ring-primary/40"
                data-testid="input-paid-subject"
              />
              <label className="block text-xs font-mono-data tracking-widest text-muted-foreground mb-1">
                FULL WIRE (plain paragraphs — the email adds your member-edition branding)
              </label>
              <textarea
                value={paidBody}
                onChange={(e) => setPaidBody(e.target.value)}
                rows={12}
                placeholder="Paste the full text of this week's paid issue here…"
                className="w-full border border-border bg-background p-3 text-base leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/40"
                data-testid="input-paid-body"
              />
              <div className="mt-4 flex items-center gap-4">
                <button
                  onClick={handlePaidSend}
                  disabled={
                    paidSend.isPending ||
                    paidSubject.trim().length < 3 ||
                    paidBody.trim().length < 100 ||
                    (status.data?.memberCount ?? 0) === 0
                  }
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 font-serif font-bold disabled:opacity-40"
                  data-testid="button-paid-send"
                >
                  {paidSend.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {paidSend.isPending ? "Sending…" : `Send to ${status.data?.memberCount ?? "…"} member${(status.data?.memberCount ?? 0) === 1 ? "" : "s"}`}
                </button>
                {paidSentCount !== null && (
                  <span className="inline-flex items-center gap-2 text-primary font-medium">
                    <CheckCircle2 className="w-5 h-5" /> Sent to {paidSentCount}!
                  </span>
                )}
              </div>
              {paidSend.isError && (
                <p className="mt-3 text-sm text-red-700" data-testid="text-paid-send-error">
                  {(paidSend.error as { data?: { error?: string } })?.data?.error ??
                    "Sending failed — please try again."}
                </p>
              )}
            </>
          )}
        </div>

        {/* Step 1 */}
        <div className="bg-card border border-border p-6 mb-6 shadow-sm">
          <h2 className="font-serif font-bold text-lg mb-2">1. Paste this week's full Wire</h2>
          <p className="text-sm text-muted-foreground mb-4">
            The system drafts a condensed HSW Weekly Brief — no buyer names, no contacts, no deal
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
            {draft.isPending ? "Drafting…" : "Draft the Weekly Brief"}
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
