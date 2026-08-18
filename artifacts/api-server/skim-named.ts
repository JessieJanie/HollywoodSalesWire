/**
 * Named-contact prospecting via Skim.
 * Strategy: read team/about pages and PDFs instead of contact forms.
 * Also reads Companies House filings from this week's entity formations
 * to find director names + companies = ideal prospects already in the Wire.
 */
import { skimRead, skimReadJs } from "./src/lib/skim.js";

const TARGETS = [
  // Companies House — entity formations from this week's Wire
  // (UK co's just incorporated = about to buy production services)
  { url: "https://find-and-update.company-information.service.gov.uk/search?q=ticket+to+ride+productions+2026", label: "CH: Ticket to Ride entity" },
  { url: "https://find-and-update.company-information.service.gov.uk/search?q=film+production+ltd&incorporation-from=2026-08-01", label: "CH: recent film LTDs" },
  { url: "https://find-and-update.company-information.service.gov.uk/search?q=television+productions+ltd&incorporation-from=2026-08-10", label: "CH: recent TV LTDs" },

  // Team/about pages (named individuals, often with emails)
  { url: "https://www.sargent-disc.com/about/our-team/", label: "Sargent-Disc team" },
  { url: "https://www.sohonet.com/about/team/", label: "Sohonet team" },
  { url: "https://www.sohonet.com/about/", label: "Sohonet about" },
  { url: "https://www.halo.co.uk/about/", label: "Halo Post about" },
  { url: "https://www.twickenhamstudios.com/about/", label: "Twickenham about" },
  { url: "https://www.elstreestudios.co.uk/about/", label: "Elstree about" },
  { url: "https://www.productionpark.co.uk/our-team/", label: "Production Park team" },

  // PDFs — industry directories / conference programs with named contacts
  { url: "https://www.ukscreenalliance.co.uk/wp-content/uploads/UKSA-Members-2024.pdf", label: "UKSA members PDF" },
  { url: "https://www.screenskills.com/media/4727/2023-screen-skills-annual-review.pdf", label: "ScreenSkills annual PDF" },
  { url: "https://britishfilmcommission.org.uk/wp-content/uploads/2024/01/BFC-Service-Finder-2024.pdf", label: "BFC service finder PDF" },

  // Production companies that recently filed (from Wire entity formations signal)
  { url: "https://find-and-update.company-information.service.gov.uk/company/15878432", label: "CH filing 1" },
  { url: "https://find-and-update.company-information.service.gov.uk/company/15878433", label: "CH filing 2" },

  // Spotlight UK — team page (contacts publicly listed)
  { url: "https://www.spotlight.com/about-us/our-team/", label: "Spotlight team" },

  // Pact (trade body) — board and staff with emails
  { url: "https://www.pact.co.uk/about-us/our-team.html", label: "PACT team" },

  // Production Guild UK — member directory overview
  { url: "https://www.productionguild.com/about/our-council/", label: "Production Guild council" },

  // BFI industry contacts
  { url: "https://www.bfi.org.uk/about-bfi/contact-us", label: "BFI contact" },

  // Film London vendor contacts
  { url: "https://filmlondon.org.uk/about/our-team", label: "Film London team" },
];

async function readSafe(url: string) {
  try {
    const r = await skimRead(url);
    if ((r.wordCount ?? 0) < 60) {
      const r2 = await skimReadJs(url);
      return { md: r2.markdown ?? "", w: r2.wordCount ?? 0 };
    }
    return { md: r.markdown ?? "", w: r.wordCount ?? 0 };
  } catch {
    try {
      const r2 = await skimReadJs(url);
      return { md: r2.markdown ?? "", w: r2.wordCount ?? 0 };
    } catch { return { md: "", w: 0 }; }
  }
}

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
// Name-like: "First Last" pattern, 2-4 words, each title-cased
const NAME_RE = /^[A-Z][a-z]{1,20}(?: [A-Z][a-z]{1,20}){1,3}$/;

function extractEmails(text: string) {
  return [...new Set((text.match(EMAIL_RE) ?? []).map(e => e.toLowerCase()))].filter(e =>
    !e.endsWith(".png") && !e.endsWith(".jpg") && !e.endsWith(".svg") && !e.endsWith(".gif") &&
    !/noreply|no-reply|donotreply|bounce|postmaster|sentry|wix\.|example\.|privacy/i.test(e)
  );
}

function nearbyName(md: string, email: string) {
  const lines = md.split("\n");
  const idx = lines.findIndex(l => l.includes(email));
  if (idx < 0) return {};
  for (let i = Math.max(0, idx - 10); i < idx + 3; i++) {
    const l = lines[i]?.replace(/[*#\[\]`>|]/g, "").trim() ?? "";
    if (NAME_RE.test(l)) {
      const parts = l.split(" ");
      return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
    }
  }
  return {};
}

async function main() {
  const leads: any[] = [];
  const seen = new Set<string>();

  for (const t of TARGETS) {
    process.stderr.write(`${t.label}\n`);
    const { md, w } = await readSafe(t.url);
    if (!md || w < 20) { process.stderr.write(`  SKIP (${w}w)\n`); continue; }

    const emails = extractEmails(md);
    if (!emails.length) {
      process.stderr.write(`  no emails (${w}w) — preview: ${md.slice(0, 200).replace(/\n+/g," ")}\n`);
      continue;
    }

    for (const email of emails) {
      if (seen.has(email)) continue;
      seen.add(email);
      const name = nearbyName(md, email);
      const lead = { email, ...name, source_label: t.label, source_url: t.url };
      leads.push(lead);
      process.stderr.write(`  + ${email}${name.first_name ? ` — ${name.first_name} ${name.last_name}` : ""}\n`);
    }
  }

  process.stdout.write(JSON.stringify(leads, null, 2) + "\n");
  process.stderr.write(`\n=== Named leads found: ${leads.filter(l=>l.first_name).length} / ${leads.length} total ===\n`);
}
main();
