/**
 * Time-boxed Skim prospecting run (cost measurement + directory crawl).
 * Reads directory-style pages (trade bodies, film-commission vendor guides,
 * rental-house location pages) and follows same-site listing links, extracting
 * named people + work emails. Stops hard at the time budget.
 *
 *   node --experimental-strip-types scripts/skim-prospects-timed.ts 20 > /tmp/skim-timed.json
 */
import { skimRead, skimReadJs } from "../src/lib/skim.ts";

const MINUTES = Number(process.argv[2] ?? "20");
const DEADLINE = Date.now() + MINUTES * 60_000;
const READ_PRICE = 0.005;

const FOLLOW = /\/(team|our-team|meet|about|people|staff|contact|contacts|locations?|offices?|leadership|sales|rentals?|who-we-are|management)\b/i;
const F = (url: string, label: string) => ({ url, label, follow: FOLLOW, max: 6 });
const SEEDS: Array<{ url: string; label: string; follow?: RegExp; max?: number }> = [
  // Georgia
  F("https://www.pce-atlanta.com/", "PC&E"), F("https://www.cinelease.com/", "Cinelease"), F("https://www.trilithstudios.com/", "Trilith"),
  F("https://www.blackhallstudios.com/", "Shadowbox/Blackhall"), F("https://www.stageworksatl.com/", "Stageworks ATL"), F("https://www.ameriquip.com/", "Ameriquip"),
  F("https://www.tylerperrystudios.com/", "Tyler Perry Studios"), F("https://www.easterneffects.com/", "Eastern Effects"), F("https://www.moonshine-post.com/", "Moonshine Post"),
  F("https://www.sixteen19.com/", "Sixteen19"), F("https://www.crewstarstudios.com/", "Crew Star"), F("https://www.cofilm.com/", "Cofilm"),
  // New Mexico / Texas
  F("https://www.abqstudios.com/", "Albuquerque Studios"), F("https://www.garsonstudios.com/", "Garson"), F("https://www.i-25studios.com/", "I-25 Studios"),
  F("https://www.nmgrip.com/", "NM Grip"), F("https://www.mpe-rentals.com/", "MP&E"), F("https://www.austinstudios.org/", "Austin Studios"),
  F("https://www.texasgrip.com/", "Texas Grip"), F("https://www.gearheadgrip.com/", "Gearhead"), F("https://www.lonestarstudios.com/", "Lone Star Studios"),
  // New York / NJ
  F("https://www.kaufmanastoria.com/", "Kaufman Astoria"), F("https://www.silvercupstudios.com/", "Silvercup"), F("https://www.steinerstudios.com/", "Steiner"),
  F("https://www.broadwaystages.com/", "Broadway Stages"), F("https://www.csc.tv/", "Camera Service Center"), F("https://www.handheldfilms.com/", "Hand Held Films"),
  F("https://www.tcsfilm.com/", "TCS"), F("https://www.cinemaworldstudios.com/", "Cinema World"), F("https://www.lionsgatestudiosyonkers.com/", "Lionsgate Yonkers"),
  F("https://www.eastsideprod.com/", "Eastside Productions"), F("https://www.lightingrentals.com/", "Eastern Lighting"), F("https://www.gothamsound.com/", "Gotham Sound"),
  // UK / Ireland
  F("https://www.procamtake2.com/", "Procam Take 2"), F("https://www.vfguk.com/", "VFG"), F("https://www.shootblue.co.uk/", "Shoot Blue"),
  F("https://www.panalux.tv/", "Panalux"), F("https://www.moviemachine.co.uk/", "Movie Machine"), F("https://www.mediaservicesuk.com/", "Media Services UK"),
  F("https://www.pinewoodgroup.com/", "Pinewood"), F("https://www.elstreestudios.co.uk/", "Elstree"), F("https://www.3millsstudios.co.uk/", "3 Mills"),
  F("https://www.troubadour-theatres.com/", "Troubadour"), F("https://www.sohonet.com/", "Sohonet"), F("https://www.molinare.co.uk/", "Molinare"),
  F("https://www.halo.co.uk/", "Halo"), F("https://www.envy.tv/", "Envy"), F("https://www.ardmore.ie/", "Ardmore"), F("https://www.troystudios.com/", "Troy Studios"),
  F("https://www.belfastharbourstudios.com/", "Belfast Harbour Studios"), F("https://www.wolfstudios.wales/", "Wolf Studios Wales"),
  // Canada
  F("https://www.williamfwhite.com/", "William F. White"), F("https://www.sim.ca/", "SIM"), F("https://www.cinespace.com/", "Cinespace"),
  F("https://www.mels-studios.com/", "MELS"), F("https://www.bridgestudios.com/", "Bridge Studios"), F("https://www.northshorestudios.com/", "North Shore"),
  F("https://www.martinistudios.com/", "Martini Film Studios"), F("https://www.vancouverfilmstudios.com/", "Vancouver Film Studios"), F("https://www.pinewoodtorontostudios.com/", "Pinewood Toronto"),
  F("https://www.revolverfilms.com/", "Revolver"), F("https://www.mavrikmedia.com/", "Mavrik"),
  // Payroll / insurance / software (US)
  F("https://www.mediaservices.com/", "Media Services"), F("https://www.wrapbook.com/", "Wrapbook"), F("https://www.capspayroll.com/", "CAPS"),
  F("https://www.momentousins.com/", "Momentous"), F("https://www.gallagherentertainment.com/", "Gallagher Ent."), F("https://www.studiobinder.com/", "StudioBinder"),
  F("https://www.setkeeper.com/", "SetKeeper"), F("https://www.scenechronize.com/", "Scenechronize"), F("https://www.yamdu.com/", "Yamdu"),
];


const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const NAME_RE = /^[A-Z][a-zA-Z'\-]{1,20}(?: [A-Z][a-zA-Z'\-]{1,20}){1,3}$/;
const GENERIC = /^(info|hello|hi|sales|contact|enquiries|inquiries|rentals?|bookings?|office|admin|support|press|media|jobs|careers|hr|marketing|accounts?|billing|team|hire|general|mail|reception|service|services|help|events|production|post|vfx|customerservice|studio|studios|stages?|membership|members|crew|london|atlanta|ny|nyc|la|uk|us|hello\w*)@/i;
const LINK_RE = /\]\((https?:\/\/[^)\s]+)\)/g;

const seen = new Set<string>();
const visited = new Set<string>();
const leads: any[] = [];
let reads = 0, charged = 0, blocked = 0;

function timeLeft() { return Date.now() < DEADLINE; }

async function read(url: string) {
  if (visited.has(url)) return null; visited.add(url);
  try {
    reads++; const r = await skimRead(url); charged++;
    if ((r.wordCount ?? 0) < 60 && timeLeft()) { reads++; const r2 = await skimReadJs(url); charged++; return r2.markdown ?? ""; }
    return r.markdown ?? "";
  } catch (e: any) { blocked++; return ""; }
}

function harvest(md: string, label: string, url: string) {
  const emails = [...new Set((md.match(EMAIL_RE) ?? []).map(e => e.toLowerCase()))]
    .filter(e => !/\.(png|jpe?g|svg|gif|webp|css|js)$/.test(e) && !/noreply|no-reply|donotreply|bounce|postmaster|sentry|wix\.|example\.|privacy|unsubscribe|abuse|@.*\.(gov|edu)$/i.test(e) && !GENERIC.test(e));
  const lines = md.split("\n");
  for (const email of emails) {
    if (seen.has(email)) continue; seen.add(email);
    let first = "", last = "";
    const idx = lines.findIndex(l => l.toLowerCase().includes(email));
    if (idx >= 0) {
      const line = lines[idx]!.replace(/[*#`>|_]/g, "");
      const m = line.match(/\[([A-Z][a-zA-Z'\-]+ [A-Z][a-zA-Z'\-]+(?: [A-Z][a-zA-Z'\-]+)?)\]\(mailto/i) ?? line.match(/([A-Z][a-zA-Z'\-]+ [A-Z][a-zA-Z'\-]+)[^@\n]{0,40}$/);
      if (m) { const p = m[1].split(" "); first = p[0]; last = p.slice(1).join(" "); }
      else for (let i = idx - 1; i >= Math.max(0, idx - 6); i--) { const l = lines[i]!.replace(/[*#\[\]`>|_]/g, "").replace(/\(.*?\)/g, "").trim(); if (NAME_RE.test(l)) { const p = l.split(" "); first = p[0]; last = p.slice(1).join(" "); break; } }
    }
    leads.push({ email, first_name: first, last_name: last, source_label: label, source_url: url });
    process.stderr.write(`   + ${email}${first ? ` — ${first} ${last}` : ""}\n`);
  }
  return emails.length;
}

async function main() {
  const t0 = Date.now();
  outer: for (const s of SEEDS) {
    if (!timeLeft()) break;
    const md = await read(s.url);
    if (md === null) continue;
    const n = md ? harvest(md, s.label, s.url) : 0;
    process.stderr.write(`[${((Date.now() - t0) / 60000).toFixed(1)}m] ${s.label}: ${md ? md.split(/\s+/).length + "w" : "blocked"}, ${n} named emails\n`);
    if (!md || !s.follow) continue;
    const links = [...new Set([...md.matchAll(LINK_RE)].map(m => m[1].split("#")[0]))].filter(u => s.follow!.test(u) && u !== s.url).slice(0, s.max ?? 10);
    for (const u of links) {
      if (!timeLeft()) break outer;
      const sub = await read(u); if (!sub) continue;
      const k = harvest(sub, s.label, u);
      if (k) process.stderr.write(`[${((Date.now() - t0) / 60000).toFixed(1)}m]   ↳ ${u}: ${k} named emails\n`);
    }
  }
  process.stdout.write(JSON.stringify(leads, null, 2) + "\n");
  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  process.stderr.write(`\n=== ${mins} min | ${reads} read attempts, ${charged} successful (charged), ${blocked} blocked/uncharged | est. $${(charged * READ_PRICE).toFixed(3)} | ${leads.length} named-looking emails (${leads.filter(l => l.first_name).length} with names) ===\n`);
}
main();
