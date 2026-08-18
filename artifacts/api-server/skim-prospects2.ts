/**
 * Prospect research — second batch.
 * Targeting: UK grip/rigging, VFX, security, CA production tech, more post.
 */

import { skimRead, skimReadJs } from "./src/lib/skim.js";

const TARGETS: Array<{ url: string; company: string; category: string }> = [
  // ── UK Equipment Rental ───────────────────────────────────────────────────
  { url: "https://www.lfrentals.co.uk/contact", company: "LF Rentals", category: "equipment-uk" },
  { url: "https://www.panavision.com/contact-us", company: "Panavision", category: "equipment" },
  // ── UK VFX / Post (smaller) ───────────────────────────────────────────────
  { url: "https://www.cinesite.com/contact/", company: "Cinesite", category: "vfx-uk" },
  { url: "https://www.edit.co.uk/contact/", company: "Edit (post)", category: "post-uk" },
  { url: "https://www.clearcut.tv/contact/", company: "Clear Cut Pictures", category: "post-uk" },
  { url: "https://www.mcmlondon.com/contact", company: "MCM London", category: "post-uk" },
  { url: "https://www.envy.co.uk/contact/", company: "Envy Post", category: "post-uk" },
  { url: "https://www.outpost-vfx.com/contact/", company: "Outpost VFX", category: "vfx-uk" },
  // ── UK Production Insurance ───────────────────────────────────────────────
  { url: "https://www.filminsurance.co.uk/contact-us/", company: "Film Insurance UK", category: "insurance-uk" },
  { url: "https://www.tvinsurance.co.uk/contact/", company: "TV Insurance UK", category: "insurance-uk" },
  { url: "https://www.media-insurance.co.uk/contact-us/", company: "Media Insurance UK", category: "insurance-uk" },
  // ── UK Stage / Studio ─────────────────────────────────────────────────────
  { url: "https://www.twickenhamstudios.com/contact/", company: "Twickenham Studios", category: "stage-uk" },
  { url: "https://www.3mills.com/contact/", company: "3 Mills Studios", category: "stage-uk" },
  { url: "https://www.elstreestudios.co.uk/contact/", company: "Elstree Studios", category: "stage-uk" },
  // ── UK Catering ──────────────────────────────────────────────────────────
  { url: "https://www.bsfilmcatering.com/contact", company: "BS Film Catering", category: "catering-uk" },
  { url: "https://www.filmcatering.co.uk/contact/", company: "Film Catering UK", category: "catering-uk" },
  // ── UK Production Support ─────────────────────────────────────────────────
  { url: "https://www.unitbase.co.uk/contact/", company: "Unit Base UK", category: "services-uk" },
  { url: "https://www.productionpark.co.uk/contact/", company: "Production Park", category: "stage-uk" },
  { url: "https://www.mediahireuk.com/contact/", company: "Media Hire UK", category: "equipment-uk" },
  // ── CA / US Production Services ───────────────────────────────────────────
  { url: "https://www.hollywoodlighting.biz/contact/", company: "Hollywood Lighting", category: "lighting-us" },
  { url: "https://www.lexingtonscenery.com/contact", company: "Lexington Scenery", category: "stage-us" },
  { url: "https://www.lightingdesigngroup.com/contact", company: "Lighting Design Group", category: "lighting-us" },
  { url: "https://www.handcraftedfilms.com/contact", company: "Handcrafted Films", category: "services-us" },
  // ── Production Tech / SaaS ────────────────────────────────────────────────
  { url: "https://www.scriptation.com/contact", company: "Scriptation", category: "production-tech" },
  { url: "https://www.setkeeper.com/contact", company: "SetKeeper", category: "production-tech" },
  { url: "https://www.noon.works/contact", company: "Noon (scheduling)", category: "production-tech" },
  { url: "https://www.scenios.com/contact", company: "Scenios", category: "production-tech" },
  // ── UK Music / Sound ──────────────────────────────────────────────────────
  { url: "https://www.sync.music/contact", company: "Sync Music UK", category: "music-uk" },
  { url: "https://www.audiosocket.com/contact", company: "Audiosocket", category: "music" },
  { url: "https://www.soundsnap.com/contact", company: "Soundsnap", category: "sfx" },
  // ── UK Casting / Talent Platforms ────────────────────────────────────────
  { url: "https://www.spotlight.com/help/contact-us", company: "Spotlight UK", category: "casting-uk" },
  { url: "https://www.mandy.com/help/contact", company: "Mandy.com", category: "crewportal-uk" },
];

async function readSafe(url: string): Promise<{ markdown: string; words: number }> {
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
    } catch {
      return { markdown: "", words: 0 };
    }
  }
}

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
function extractEmails(text: string): string[] {
  return [...new Set((text.match(EMAIL_RE) ?? []).map(e => e.toLowerCase()))].filter(e =>
    !e.includes("example.") && !e.endsWith(".png") && !e.endsWith(".jpg") &&
    !e.endsWith(".svg") && !e.endsWith(".gif") &&
    !/noreply|no-reply|donotreply|bounce|postmaster|sentry|privacy|wix\./i.test(e)
  );
}

interface Lead { email: string; company: string; category: string; source: string }

async function main() {
  const leads: Lead[] = [];
  const seen = new Set<string>();

  for (const target of TARGETS) {
    process.stderr.write(`${target.company}\n`);
    const { markdown, words } = await readSafe(target.url);
    if (!markdown || words < 20) { process.stderr.write(`  SKIP\n`); continue; }
    const emails = extractEmails(markdown);
    if (!emails.length) { process.stderr.write(`  no emails (${words}w)\n`); continue; }
    for (const email of emails) {
      if (seen.has(email)) continue;
      seen.add(email);
      leads.push({ email, company: target.company, category: target.category, source: target.url });
      process.stderr.write(`  + ${email}\n`);
    }
  }

  process.stdout.write(JSON.stringify(leads, null, 2) + "\n");
  process.stderr.write(`\nBatch 2 total: ${leads.length}\n`);
}

main();
