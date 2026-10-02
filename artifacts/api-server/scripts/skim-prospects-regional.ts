/**
 * Skim prospecting — regional production vendors (GA / NM / TX / NY / UK / Canada).
 * Reads team / sales-contact pages via Skim and extracts named people + emails.
 * Run from artifacts/api-server:
 *   node --experimental-strip-types scripts/skim-prospects-regional.ts > /tmp/skim-regional.json
 */
import { skimRead, skimReadJs } from "../src/lib/skim.ts";

const TARGETS: Array<{ url: string; company: string; region: string }> = [
  // ── Georgia ──
  { url: "https://www.pce-atlanta.com/about/", company: "PC&E Atlanta", region: "GA" },
  { url: "https://www.pce-atlanta.com/contact/", company: "PC&E Atlanta", region: "GA" },
  { url: "https://easterneffects.com/contact/", company: "Eastern Effects", region: "GA" },
  { url: "https://easterneffects.com/about/", company: "Eastern Effects", region: "GA" },
  { url: "https://www.mbseco.com/locations/atlanta/", company: "MBS Equipment Atlanta", region: "GA" },
  { url: "https://trilithstudios.com/contact/", company: "Trilith Studios", region: "GA" },
  { url: "https://www.assemblystudios.com/contact", company: "Assembly Studios", region: "GA" },
  { url: "https://www.mailingavenuestageworks.com/contact", company: "Mailing Avenue Stageworks", region: "GA" },
  { url: "https://www.cinelease.com/locations/atlanta", company: "Cinelease Atlanta", region: "GA" },
  { url: "https://www.crafty-apes.com/contact", company: "Crafty Apes", region: "GA" },
  { url: "https://www.moonshine-post.com/contact", company: "Moonshine Post", region: "GA" },
  { url: "https://www.georgiaproduction.org/our-team", company: "Georgia Production Partnership", region: "GA" },
  // ── New Mexico ──
  { url: "https://www.abqstudios.com/contact", company: "Albuquerque Studios", region: "NM" },
  { url: "https://www.garsonstudios.com/contact", company: "Garson Studios", region: "NM" },
  { url: "https://www.hollywoodrentals.com/locations/albuquerque/", company: "Hollywood Rentals NM", region: "NM" },
  { url: "https://www.keslowcamera.com/locations/", company: "Keslow Camera", region: "multi" },
  { url: "https://www.nmfilm.com/contact-us/", company: "NM Film Office", region: "NM" },
  { url: "https://www.i-25studios.com/contact", company: "I-25 Studios", region: "NM" },
  { url: "https://www.santafestudios.com/contact", company: "Santa Fe Studios", region: "NM" },
  // ── Texas ──
  { url: "https://mpe-rentals.com/contact/", company: "MP&E Camera & Lighting", region: "TX" },
  { url: "https://www.austinstudios.org/contact", company: "Austin Studios", region: "TX" },
  { url: "https://www.texasfilmcommission.com/contact", company: "Texas Film Commission", region: "TX" },
  { url: "https://www.panavision.com/contact-us", company: "Panavision", region: "multi" },
  { url: "https://www.gearheadgrip.com/contact", company: "Gearhead Grip", region: "TX" },
  { url: "https://www.texaspictures.com/contact", company: "Texas Pictures", region: "TX" },
  { url: "https://www.cinelease.com/locations", company: "Cinelease", region: "multi" },
  // ── New York ──
  { url: "https://www.kaufmanastoria.com/contact/", company: "Kaufman Astoria Studios", region: "NY" },
  { url: "https://www.silvercupstudios.com/contact/", company: "Silvercup Studios", region: "NY" },
  { url: "https://www.steinerstudios.com/contact", company: "Steiner Studios", region: "NY" },
  { url: "https://www.broadwaystages.com/contact", company: "Broadway Stages", region: "NY" },
  { url: "https://www.csc.tv/contact", company: "Camera Service Center", region: "NY" },
  { url: "https://www.abelcine.com/about-us/contact", company: "AbelCine", region: "NY" },
  { url: "https://www.handheldfilms.com/contact", company: "Hand Held Films", region: "NY" },
  { url: "https://www.postnewyork.org/our-team", company: "Post New York Alliance", region: "NY" },
  { url: "https://www.harbor.co/contact", company: "Harbor", region: "NY" },
  { url: "https://www.goldcrestpost.com/contact", company: "Goldcrest Post", region: "NY" },
  { url: "https://www.eastsideprod.com/contact", company: "Eastside Productions", region: "NY" },
  // ── UK ──
  { url: "https://www.panavision.com/locations/panavision-london", company: "Panavision London", region: "UK" },
  { url: "https://www.arrirental.com/en/locations/london", company: "ARRI Rental London", region: "UK" },
  { url: "https://www.moviemachine.co.uk/contact", company: "Movie Machine", region: "UK" },
  { url: "https://www.procamtake2.com/about-us/our-team", company: "Procam Take 2", region: "UK" },
  { url: "https://www.sargent-disc.com/about-us/our-people", company: "Sargent-Disc", region: "UK" },
  { url: "https://www.pinewoodgroup.com/contact-us", company: "Pinewood Group", region: "UK" },
  { url: "https://www.shepperton-studios.com/contact-us", company: "Shepperton Studios", region: "UK" },
  { url: "https://www.leavesdenstudios.com/contact-us", company: "Warner Bros. Studios Leavesden", region: "UK" },
  { url: "https://www.skystudioselstree.com/contact", company: "Sky Studios Elstree", region: "UK" },
  { url: "https://www.mediacityuk.co.uk/contact/", company: "MediaCity UK", region: "UK" },
  { url: "https://www.the-farm.tv/contact", company: "The Farm Group", region: "UK" },
  { url: "https://www.envy.tv/contact", company: "Envy Post", region: "UK" },
  { url: "https://www.pictureshop.com/contact", company: "Picture Shop", region: "multi" },
  { url: "https://www.mediasense.co.uk/contact/", company: "Media Sense", region: "UK" },
  { url: "https://www.cinelab.co.uk/contact", company: "Cinelab Film & Digital", region: "UK" },
  { url: "https://www.chapmanleonard.com/contact", company: "Chapman Leonard", region: "multi" },
  // ── Canada ──
  { url: "https://www.williamfwhite.com/contact", company: "William F. White", region: "CAN" },
  { url: "https://www.sim.ca/contact", company: "SIM", region: "CAN" },
  { url: "https://www.pinewoodtorontostudios.com/contact", company: "Pinewood Toronto Studios", region: "CAN" },
  { url: "https://www.cinespace.com/contact/", company: "Cinespace Studios", region: "CAN" },
  { url: "https://www.mels-studios.com/en/contact", company: "MELS Studios", region: "CAN" },
  { url: "https://www.bridgestudios.com/contact", company: "Bridge Studios", region: "CAN" },
  { url: "https://www.northshorestudios.com/contact", company: "North Shore Studios", region: "CAN" },
  { url: "https://www.deluxe.com/contact-us/", company: "Deluxe", region: "multi" },
  { url: "https://www.cfpiweb.ca/contact", company: "Canadian Film Production Insurance", region: "CAN" },
  { url: "https://frontrowinsurance.com/about/our-team", company: "Front Row Insurance", region: "CAN" },
];

const SKIP_COMPANY_DOMAINS = new Set(["castandcrew.com","greenslate.com","gslate.com","pictureshop.com","formosagroup.com","mbseco.com","arrirental.com","4wall.com","the-mbsgroup.com","iscmga.com","keslowcamera.com","ottonemenz.com","cinelease.com","panalux.com","sargent-disc.com","frontrowinsurance.com","sohonet.com"]);

async function readSafe(url: string) {
  try {
    const r = await skimRead(url);
    if ((r.wordCount ?? 0) < 60) { const r2 = await skimReadJs(url); return { md: r2.markdown ?? "", w: r2.wordCount ?? 0, reads: 2 }; }
    return { md: r.markdown ?? "", w: r.wordCount ?? 0, reads: 1 };
  } catch (e: any) {
    return { md: "", w: 0, reads: 0, err: String(e?.response?.status ?? e?.message ?? e).slice(0, 80) };
  }
}

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const NAME_RE = /^[A-Z][a-zA-Z'\-]{1,20}(?: [A-Z][a-zA-Z'\-]{1,20}){1,3}$/;
const GENERIC = /^(info|hello|sales|contact|enquiries|inquiries|rentals|rental|bookings|booking|office|admin|support|press|media|jobs|careers|hr|marketing|accounts|billing|team|hire|london|atlanta|nyc|newyork|la|studio|studios|general|mail|reception|service|help|events|production|post|vfx|customerservice)@/i;

function extractEmails(text: string) {
  return [...new Set((text.match(EMAIL_RE) ?? []).map(e => e.toLowerCase()))].filter(e =>
    !/\.(png|jpg|jpeg|svg|gif|webp)$/.test(e) && !/noreply|no-reply|donotreply|bounce|postmaster|sentry|wix\.|example\.|privacy|unsubscribe|abuse/i.test(e)
  );
}

function nearbyName(md: string, email: string) {
  const lines = md.split("\n");
  const idx = lines.findIndex(l => l.includes(email));
  if (idx < 0) return {};
  for (let i = idx; i >= Math.max(0, idx - 8); i--) {
    const l = lines[i]?.replace(/[*#\[\]`>|_]/g, "").replace(/\(.*?\)/g, "").trim() ?? "";
    if (NAME_RE.test(l)) { const p = l.split(" "); return { first_name: p[0], last_name: p.slice(1).join(" ") }; }
  }
  // title/name on same line before email
  const line = lines[idx]!.replace(/[*#\[\]`>|_]/g, "");
  const m = line.match(/([A-Z][a-zA-Z'\-]+ [A-Z][a-zA-Z'\-]+)[^@]{0,60}$/);
  if (m) { const p = m[1].split(" "); return { first_name: p[0], last_name: p[1] }; }
  return {};
}

async function main() {
  const leads: any[] = []; const seen = new Set<string>(); let reads = 0;
  for (const t of TARGETS) {
    const r = await readSafe(t.url); reads += r.reads;
    if (!r.md || r.w < 20) { process.stderr.write(`${t.company}: SKIP (${r.w}w${r.err ? " " + r.err : ""})\n`); continue; }
    const emails = extractEmails(r.md);
    const named = emails.filter(e => !GENERIC.test(e) && !SKIP_COMPANY_DOMAINS.has(e.split("@")[1]));
    process.stderr.write(`${t.company}: ${r.w}w, ${emails.length} emails, ${named.length} named-looking\n`);
    for (const email of named) {
      if (seen.has(email)) continue; seen.add(email);
      const name = nearbyName(r.md, email);
      leads.push({ email, ...name, company_name: t.company, region: t.region, source_url: t.url });
      process.stderr.write(`   + ${email}${name.first_name ? ` — ${name.first_name} ${name.last_name}` : ""}\n`);
    }
  }
  process.stdout.write(JSON.stringify(leads, null, 2) + "\n");
  process.stderr.write(`\n=== ${leads.length} candidate contacts (${leads.filter(l => l.first_name).length} with names) from ${reads} paid reads ≈ $${(reads * 0.005).toFixed(2)} ===\n`);
}
main();
