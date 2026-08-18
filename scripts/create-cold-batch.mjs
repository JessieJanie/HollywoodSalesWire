#!/usr/bin/env node
/**
 * create-cold-batch.mjs
 * Creates a new HSW Founding Offer cold outreach campaign in Instantly.
 *
 * Usage:
 *   node scripts/create-cold-batch.mjs            # start date = today, auto-calculates deadline
 *   node scripts/create-cold-batch.mjs 2026-09-02 # start date = Sep 2, deadline = Sep 9
 *
 * The script:
 *   1. Calculates the E5 deadline (start date + 7 days)
 *   2. Substitutes [DATE TOKEN] in all 5 emails
 *   3. Creates the campaign in Instantly (paused, status 0 — activate manually)
 *   4. PATCHes the campaign with HTML-formatted email bodies
 *   5. Prints the campaign ID and a link to Instantly to add leads
 *
 * Daily sending limit: 30 emails/day shared across ALL active campaigns.
 * Recommended: no more than 10 leads per batch at current limit.
 * To scale further, add a second warmed Instantly mailbox.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INSTANTLY_API_KEY = process.env.INSTANTLY_API_KEY;
if (!INSTANTLY_API_KEY) {
  console.error("ERROR: INSTANTLY_API_KEY environment variable is not set.");
  process.exit(1);
}

// ── Configuration ────────────────────────────────────────────────────────────

const SENDING_ACCOUNT = "karilyn@hollywoodsaleswires.com";
const ORG_ID = "eb13be48-1e9c-40d9-ad9a-697f9d7e257b";
const TIMEZONE = "Etc/GMT+12"; // Only validated value in Instantly (= weekday window works fine)
const COUNTER_FILE = path.join(__dirname, "../marketing/cold-batch-counter.json");
const COPY_FILE = path.join(__dirname, "../marketing/cold-campaign-draft1.txt");

// Email step delays in days: E1=Day0, E2=+1, E3=+1, E4=+2, E5=+3 → E5 lands Day 7
const STEP_DELAYS = [0, 1, 1, 2, 3];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Return the next batch number and persist it. */
function nextBatchNumber() {
  let counter = { lastBatch: 0 };
  if (fs.existsSync(COUNTER_FILE)) {
    try { counter = JSON.parse(fs.readFileSync(COUNTER_FILE, "utf8")); } catch {}
  }
  counter.lastBatch = (counter.lastBatch || 0) + 1;
  fs.writeFileSync(COUNTER_FILE, JSON.stringify(counter, null, 2));
  return counter.lastBatch;
}

/** Format a Date as "Tuesday, September 9" for the [DATE TOKEN]. */
function formatDeadline(date) {
  return date.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** Add N calendar days to a date (returns a new Date). */
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** Convert plain text → HTML paragraphs (Instantly requires HTML). */
function toHtml(plain) {
  return plain.split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("\n");
}

/** Extract the body text between two markers in the copy file. */
function extractBody(txt, startMarker, endMarker) {
  const start = txt.indexOf(startMarker);
  if (start === -1) throw new Error(`Marker not found: ${startMarker}`);
  const end = endMarker ? txt.indexOf(endMarker) : txt.indexOf("Production notes");
  return txt.slice(start + startMarker.length, end).trim();
}

async function instantly(method, path_, body) {
  const r = await fetch(`https://api.instantly.ai/api/v2${path_}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${INSTANTLY_API_KEY}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await r.json();
  if (!r.ok) throw new Error(`Instantly ${method} ${path_} → ${r.status}: ${JSON.stringify(json)}`);
  return json;
}

// ── Main ─────────────────────────────────────────────────────────────────────

const startArg = process.argv[2];
const startDate = startArg ? new Date(`${startArg}T12:00:00`) : new Date();
if (isNaN(startDate.getTime())) {
  console.error(`ERROR: Invalid start date "${startArg}". Use YYYY-MM-DD format.`);
  process.exit(1);
}

const deadlineDate = addDays(startDate, 7);
const deadlineLabel = formatDeadline(deadlineDate);
const batchNum = nextBatchNumber();
const campaignTag = `hsw-cold-${batchNum}`;

console.log(`\n📧  HSW Cold Outreach Batch ${batchNum}`);
console.log(`    Start date : ${startDate.toDateString()}`);
console.log(`    E5 deadline: ${deadlineLabel}`);
console.log(`    UTM tag    : ${campaignTag}`);
console.log(`    Account    : ${SENDING_ACCOUNT}\n`);

// Load and personalize copy
const rawCopy = fs.readFileSync(COPY_FILE, "utf8");
const copy = rawCopy
  .replace(/\[DATE TOKEN\]/g, deadlineLabel)
  .replace(/hsw-cold-1/g, campaignTag);

// Extract 5 email subjects and bodies
const emails = [
  {
    subj: "The lead list your competitors bought is already dead",
    body: extractBody(copy, "Subject: The lead list your competitors bought is already dead\n\n", "EMAIL 2"),
  },
  {
    subj: "Why your close rate is a math problem, not a talent problem",
    body: extractBody(copy, "Subject: Why your close rate is a math problem, not a talent problem\n\n", "EMAIL 3"),
  },
  {
    subj: "A job posting told us a nine-figure budget had landed",
    body: extractBody(copy, "Subject: A job posting told us a nine-figure budget had landed\n\n", "EMAIL 4"),
  },
  {
    subj: "Everything this membership includes (and the guarantee that removes the risk)",
    body: extractBody(copy, "Subject: Everything this membership includes (and the guarantee that removes the risk)\n\n", "EMAIL 5"),
  },
  {
    subj: `Midnight tonight: the founding rate goes away`,
    body: extractBody(copy, "Subject: Midnight tonight: the founding rate goes away\n\n", null),
  },
];

// Step 1: Create the campaign (structure only — bodies don't save on POST)
const campName = `HSW Founding Offer — Cold Batch ${batchNum} (deadline ${deadlineLabel})`;
console.log(`Creating campaign: "${campName}" ...`);

const created = await instantly("POST", "/campaigns", {
  name: campName,
  status: 0, // draft / paused — activate manually in Instantly after adding leads
  email_list: [SENDING_ACCOUNT],
  campaign_schedule: {
    schedules: [{
      name: "Weekdays",
      timing: { from: "08:00", to: "18:00" },
      days: { "0": false, "1": true, "2": true, "3": true, "4": true, "5": true, "6": false },
      timezone: TIMEZONE,
    }],
  },
  stop_on_reply: true,
  open_tracking: false,
  first_email_text_only: true,
  prioritize_new_leads: true,
  sequences: [{
    steps: emails.map((e, i) => ({
      type: "email",
      delay: STEP_DELAYS[i],
      delay_unit: "days",
      variants: [{ subject: e.subj, body: "" }], // bodies set via PATCH below
    })),
  }],
});

const campaignId = created.id;
console.log(`✓ Campaign created: ${campaignId}`);

// Step 2: PATCH with HTML bodies (required — plain text is silently dropped)
console.log("Setting email bodies ...");
const patched = await instantly("PATCH", `/campaigns/${campaignId}`, {
  sequences: [{
    steps: emails.map((e, i) => ({
      type: "email",
      delay: STEP_DELAYS[i],
      delay_unit: "days",
      variants: [{ subject: e.subj, body: toHtml(e.body) }],
    })),
  }],
});

// Verify bodies saved
const steps = patched.sequences?.[0]?.steps ?? [];
const allSaved = steps.every((s) => (s.variants?.[0]?.body?.length ?? 0) > 100);
if (!allSaved) {
  console.error("⚠️  WARNING: Some email bodies may not have saved. Check Instantly.");
  steps.forEach((s, i) => {
    console.error(`   E${i + 1}: ${s.variants?.[0]?.body?.length ?? 0} chars`);
  });
} else {
  steps.forEach((s, i) => {
    console.log(`✓ E${i + 1} saved (${s.variants?.[0]?.body?.length} chars) — ${s.variants?.[0]?.subject}`);
  });
}

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅  Batch ${batchNum} ready in Instantly (status: paused)
    Campaign ID : ${campaignId}
    Deadline    : midnight Eastern, ${deadlineLabel}
    
Next steps:
  1. Add leads in Instantly → Campaigns → this campaign → Leads tab
  2. Keep total leads across all active campaigns ≤ 10 each (30/day shared limit)
  3. Activate the campaign when leads are loaded (toggle to Active in Instantly)
  4. Instantly will send on weekdays, 8am–6pm, stop-on-reply

View in Instantly:
  https://app.instantly.ai/app/campaigns/${campaignId}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
