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

// scripts/skim-prospects.ts
var TARGETS = [
  // ── UK Payroll / Production Finance ──────────────────────────────────────
  { url: "https://www.sargent-disc.com/contact", company: "Sargent-Disc", category: "payroll-uk" },
  { url: "https://www.sargent-disc.com/about/our-team", company: "Sargent-Disc", category: "payroll-uk" },
  { url: "https://www.castandcrew.com/contact-us/", company: "Cast & Crew", category: "payroll" },
  { url: "https://www.ep.com/contact/", company: "Entertainment Partners", category: "payroll" },
  { url: "https://www.wrapbook.com/contact", company: "Wrapbook", category: "payroll" },
  { url: "https://www.greenslate.com/contact", company: "GreenSlate", category: "payroll" },
  // ── UK Equipment Rental ──────────────────────────────────────────────────
  { url: "https://www.procamtake2.co.uk/contact", company: "Procam Take 2", category: "equipment-uk" },
  { url: "https://www.thecamerastore.co.uk/about-us", company: "The Camera Store UK", category: "equipment-uk" },
  { url: "https://www.vfguk.com/contact/", company: "VFG UK", category: "equipment-uk" },
  { url: "https://www.hireacamera.com/en-gb/contact/", company: "Hire A Camera UK", category: "equipment-uk" },
  { url: "https://www.shootblue.co.uk/contact", company: "Shoot Blue", category: "equipment-uk" },
  { url: "https://www.arclighting.co.uk/contact/", company: "Arc Lighting UK", category: "lighting-uk" },
  { url: "https://www.panalux.tv/contact-us/", company: "Panalux", category: "lighting-uk" },
  { url: "https://www.bebob.de/en/branches/london/", company: "Bebob UK", category: "equipment-uk" },
  // ── UK Post Production ────────────────────────────────────────────────────
  { url: "https://www.molinare.co.uk/contact/", company: "Molinare", category: "post-uk" },
  { url: "https://www.halo.co.uk/contact/", company: "Halo", category: "post-uk" },
  { url: "https://www.splicetv.co.uk/contact/", company: "Splice TV", category: "post-uk" },
  { url: "https://www.sohonet.com/contact/", company: "Sohonet", category: "post-tech-uk" },
  { url: "https://www.filmfacilities.co.uk/contact/", company: "Film Facilities", category: "post-uk" },
  // ── UK Production Insurance ───────────────────────────────────────────────
  { url: "https://www.frontrowinsurance.com/contact-us/", company: "Front Row Insurance", category: "insurance-uk" },
  { url: "https://www.aig.co.uk/content/aig/uk/en/business/entertainment.html", company: "AIG Entertainment UK", category: "insurance-uk" },
  { url: "https://www.dewittstern.com/contact/", company: "DeWitt Stern", category: "insurance" },
  // ── UK Stage / Studio ─────────────────────────────────────────────────────
  { url: "https://www.3millsStudios.co.uk/contact", company: "3 Mills Studios", category: "stage-uk" },
  { url: "https://www.twickenhamstudios.com/contact/", company: "Twickenham Studios", category: "stage-uk" },
  { url: "https://www.thefilmgroup.co.uk/contact-us/", company: "The Film Group UK", category: "stage-uk" },
  // ── UK Catering ──────────────────────────────────────────────────────────
  { url: "https://www.locationcatering.co.uk/contact/", company: "Location Catering", category: "catering-uk" },
  { url: "https://www.bsfilmcatering.co.uk/contact/", company: "BS Film Catering", category: "catering-uk" },
  // ── UK Production Software / Tech ─────────────────────────────────────────
  { url: "https://www.yamdu.com/contact/", company: "Yamdu", category: "production-tech" },
  { url: "https://www.studiobinder.com/contact/", company: "StudioBinder", category: "production-tech" },
  { url: "https://www.celtx.com/en/contact.html", company: "Celtx", category: "production-tech" },
  // ── CA/US Payroll (primary market) ────────────────────────────────────────
  { url: "https://www.mediaservices.com/contact/", company: "Media Services", category: "payroll-us" },
  { url: "https://www.mypsr.com/contact", company: "PSR (Production payroll)", category: "payroll-us" }
];
async function readSafe(url) {
  try {
    const r = await skimRead(url);
    if ((r.wordCount ?? 0) < 60) {
      const r2 = await skimReadJs(url);
      return { markdown: r2.markdown ?? "", words: r2.wordCount ?? 0 };
    }
    return { markdown: r.markdown ?? "", words: r.wordCount ?? 0 };
  } catch {
    try {
      const r2 = await skimReadJs(url);
      return { markdown: r2.markdown ?? "", words: r2.wordCount ?? 0 };
    } catch (e2) {
      return { markdown: "", words: 0 };
    }
  }
}
var EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
function extractEmails(text) {
  const found = text.match(EMAIL_RE) ?? [];
  return [...new Set(found)].filter(
    (e) => !e.includes("example.") && !e.includes("@sentry") && !e.includes("wix.") && !e.endsWith(".png") && !e.endsWith(".jpg") && !e.endsWith(".svg") && !e.endsWith(".gif") && !e.endsWith(".webp") && !/noreply|no-reply|donotreply|bounce|mailer-daemon|postmaster/i.test(e)
  );
}
function nearbyName(markdown, email) {
  const lines = markdown.split("\n");
  const idx = lines.findIndex((l) => l.includes(email));
  if (idx < 0) return void 0;
  for (let i = Math.max(0, idx - 8); i < idx; i++) {
    const l = lines[i].replace(/[*#\[\]`>]/g, "").trim();
    if (/^[A-Z][a-z]+ [A-Z][a-z]+/.test(l) && l.split(" ").length <= 4 && l.length < 50) {
      return l;
    }
  }
  return void 0;
}
async function main() {
  const leads = [];
  const seen = /* @__PURE__ */ new Set();
  for (const target of TARGETS) {
    process.stderr.write(`${target.company} \u2014 ${target.url}
`);
    const { markdown, words } = await readSafe(target.url);
    if (!markdown || words < 20) {
      process.stderr.write(`  SKIP (${words} words)
`);
      continue;
    }
    const emails = extractEmails(markdown);
    if (emails.length === 0) {
      process.stderr.write(`  words:${words}  no emails  PREVIEW: ${markdown.slice(0, 200).replace(/\n+/g, " ")}
`);
      continue;
    }
    for (const email of emails) {
      if (seen.has(email)) continue;
      seen.add(email);
      const fullName = nearbyName(markdown, email);
      const [first_name, ...rest] = (fullName ?? "").split(" ");
      const last_name = rest.join(" ");
      leads.push({
        email,
        first_name: first_name || void 0,
        last_name: last_name || void 0,
        company: target.company,
        category: target.category,
        source: target.url
      });
      process.stderr.write(`  + ${email}${fullName ? ` (${fullName})` : ""}
`);
    }
  }
  process.stdout.write(JSON.stringify(leads, null, 2) + "\n");
  process.stderr.write(`
=== Total unique leads: ${leads.length} ===
`);
}
main();
