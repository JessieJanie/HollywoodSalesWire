"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/lib/skim.ts
var clientPromise = null;
async function getClient() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const key = process.env.HSW_AGENT_PRIVATE_KEY;
      if (!key) throw new Error("HSW_AGENT_PRIVATE_KEY is not set");
      const [{ withPaymentInterceptor }, { privateKeyToAccount }, axios] = await Promise.all([
        import("x402-axios"),
        import("viem/accounts"),
        import("axios").then((m) => m.default)
      ]);
      const wallet = privateKeyToAccount(key);
      return withPaymentInterceptor(
        axios.create({ baseURL: "https://skim402.com/api", timeout: 9e4 }),
        wallet
      );
    })();
    clientPromise.catch(() => {
      clientPromise = null;
    });
  }
  return clientPromise;
}
async function skimRead(url) {
  const skim = await getClient();
  const { data } = await skim.post("/v1/read", { url });
  const markdown = data.markdown ?? "";
  return { markdown, wordCount: markdown.split(/\s+/).filter(Boolean).length };
}
async function skimReadJs(url) {
  const skim = await getClient();
  const { data } = await skim.post("/v1/read/js", { url });
  const markdown = data.markdown ?? "";
  return { markdown, wordCount: markdown.split(/\s+/).filter(Boolean).length };
}

// skim-named.ts
var TARGETS = [
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
  { url: "https://filmlondon.org.uk/about/our-team", label: "Film London team" }
];
async function readSafe(url) {
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
    } catch {
      return { md: "", w: 0 };
    }
  }
}
var EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
var NAME_RE = /^[A-Z][a-z]{1,20}(?: [A-Z][a-z]{1,20}){1,3}$/;
function extractEmails(text) {
  return [...new Set((text.match(EMAIL_RE) ?? []).map((e) => e.toLowerCase()))].filter(
    (e) => !e.endsWith(".png") && !e.endsWith(".jpg") && !e.endsWith(".svg") && !e.endsWith(".gif") && !/noreply|no-reply|donotreply|bounce|postmaster|sentry|wix\.|example\.|privacy/i.test(e)
  );
}
function nearbyName(md, email) {
  const lines = md.split("\n");
  const idx = lines.findIndex((l) => l.includes(email));
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
  const leads = [];
  const seen = /* @__PURE__ */ new Set();
  for (const t of TARGETS) {
    process.stderr.write(`${t.label}
`);
    const { md, w } = await readSafe(t.url);
    if (!md || w < 20) {
      process.stderr.write(`  SKIP (${w}w)
`);
      continue;
    }
    const emails = extractEmails(md);
    if (!emails.length) {
      process.stderr.write(`  no emails (${w}w) \u2014 preview: ${md.slice(0, 200).replace(/\n+/g, " ")}
`);
      continue;
    }
    for (const email of emails) {
      if (seen.has(email)) continue;
      seen.add(email);
      const name = nearbyName(md, email);
      const lead = { email, ...name, source_label: t.label, source_url: t.url };
      leads.push(lead);
      process.stderr.write(`  + ${email}${name.first_name ? ` \u2014 ${name.first_name} ${name.last_name}` : ""}
`);
    }
  }
  process.stdout.write(JSON.stringify(leads, null, 2) + "\n");
  process.stderr.write(`
=== Named leads found: ${leads.filter((l) => l.first_name).length} / ${leads.length} total ===
`);
}
main();
