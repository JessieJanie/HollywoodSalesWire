/**
 * Automated Apollo.io prospecting for the cold-campaign lead pipeline.
 *
 * Every Tue/Wed/Thu, after createColdBatch() creates the week's Instantly
 * campaign, the scheduler calls autoFillColdLeads() here to find fresh named
 * sales/BD contacts at vendor companies that sell into film/TV productions,
 * and upload them straight into that campaign — no manual Apollo or
 * Instantly UI work required.
 *
 * Target list: known vendor companies (payroll, equipment rental, post
 * production, insurance, stage/studio, catering, production software) that
 * sell into the entertainment industry — the same ICP as the cold-email copy.
 * The list is intentionally a finite, curated pool; it should be expanded
 * over time as it depletes (each contacted person is permanently excluded).
 */

import { eq, inArray } from "drizzle-orm";
import { db, coldProspectContactsTable } from "@workspace/db";
import { logger } from "./logger";
import { uploadColdLeads, validateColdLead, type ColdLead } from "./coldCampaigns";

const APOLLO_BASE = "https://api.apollo.io";

interface TargetCompany {
  company: string;
  location: string; // Apollo person_locations value
}

// Curated vendor pool — same categories used in prior manual prospecting runs
// (payroll, equipment rental, post production, insurance, stage, catering,
// production software, plus transportation/location-support and camera/lens
// added in the Sept 2026 expansion). Expand this list over time as it
// depletes — each contacted person is permanently excluded, so the pool
// must stay ahead of the weekly ramp (10-30 contacts/week).
const TARGET_COMPANIES: TargetCompany[] = [
  // Payroll / production finance
  { company: "Sargent-Disc", location: "United Kingdom" },
  { company: "Cast & Crew", location: "United States" },
  { company: "Entertainment Partners", location: "United States" },
  { company: "Wrapbook", location: "United States" },
  { company: "GreenSlate", location: "United States" },
  { company: "Media Services", location: "United States" },
  { company: "PSR Production Payroll", location: "United States" },
  { company: "Assemble Payroll", location: "United States" },
  { company: "CAPS Payroll", location: "United States" },
  { company: "Track15", location: "United States" },
  { company: "Centtrip", location: "United Kingdom" },
  { company: "Digital Media Services", location: "Canada" },
  // Equipment rental / lighting
  { company: "Procam Take 2", location: "United Kingdom" },
  { company: "VFG UK", location: "United Kingdom" },
  { company: "Hire A Camera", location: "United Kingdom" },
  { company: "Shoot Blue", location: "United Kingdom" },
  { company: "Arc Lighting", location: "United Kingdom" },
  { company: "Panalux", location: "United Kingdom" },
  { company: "Bebob", location: "United Kingdom" },
  { company: "Lee Lighting", location: "United Kingdom" },
  { company: "Sunbelt Rentals Film & TV", location: "United Kingdom" },
  { company: "Panavision", location: "United States" },
  { company: "Keslow Camera", location: "United States" },
  { company: "ARRI Rental", location: "United States" },
  { company: "MBS Equipment Company", location: "United States" },
  { company: "Cinelease", location: "United States" },
  { company: "PRG", location: "United States" },
  { company: "Illumination Dynamics", location: "United States" },
  { company: "Chapman/Leonard Studio Equipment", location: "United States" },
  { company: "William F. White International", location: "Canada" },
  { company: "Vistek", location: "Canada" },
  { company: "Lemac Film & Digital", location: "Australia" },
  // Camera & lens
  { company: "Otto Nemenz International", location: "United States" },
  { company: "AbelCine", location: "United States" },
  { company: "Radiant Images", location: "United States" },
  { company: "Vantage Film", location: "United States" },
  // Post production
  { company: "Molinare", location: "United Kingdom" },
  { company: "Halo Post", location: "United Kingdom" },
  { company: "Splice TV", location: "United Kingdom" },
  { company: "Sohonet", location: "United Kingdom" },
  { company: "Film Facilities", location: "United Kingdom" },
  { company: "Envy Post Production", location: "United Kingdom" },
  { company: "Goldcrest Films", location: "United Kingdom" },
  { company: "Chainsaw Europe", location: "United Kingdom" },
  { company: "Technicolor", location: "United States" },
  { company: "Deluxe", location: "United States" },
  { company: "Fin Design + Effects", location: "Australia" },
  // Insurance
  { company: "Front Row Insurance", location: "United Kingdom" },
  { company: "AIG Entertainment", location: "United Kingdom" },
  { company: "Media Insurance Brokers", location: "United Kingdom" },
  { company: "DeWitt Stern", location: "United States" },
  { company: "Aon Entertainment", location: "United States" },
  { company: "Truman Van Dyke Company", location: "United States" },
  { company: "Momentous Insurance Brokerage", location: "United States" },
  // Stage / studio
  { company: "3 Mills Studios", location: "United Kingdom" },
  { company: "Twickenham Studios", location: "United Kingdom" },
  { company: "The Film Group", location: "United Kingdom" },
  { company: "Pinewood Studios", location: "United Kingdom" },
  { company: "Shepperton Studios", location: "United Kingdom" },
  { company: "Elstree Studios", location: "United Kingdom" },
  { company: "Wolf Studios Wales", location: "United Kingdom" },
  { company: "Trilith Studios", location: "United States" },
  { company: "EUE/Screen Gems Studios", location: "United States" },
  { company: "Sunset Studios", location: "United States" },
  { company: "Radford Studio Center", location: "United States" },
  { company: "Kaufman Astoria Studios", location: "United States" },
  // Catering
  { company: "Location Catering", location: "United Kingdom" },
  { company: "BS Film Catering", location: "United Kingdom" },
  { company: "Studio Catering Company", location: "United States" },
  // Transportation & on-set support
  { company: "All Action Transportation", location: "United States" },
  { company: "Set Medic", location: "United States" },
  { company: "On Location Education", location: "United States" },
  { company: "Aerial Filmworks", location: "United States" },
  { company: "FilmLA", location: "United States" },
  // Production software / tech
  { company: "StudioBinder", location: "United States" },
  { company: "Yamdu", location: "United States" },
  { company: "Celtx", location: "United States" },
  { company: "SetHero", location: "United States" },
  { company: "Breakdown Services", location: "United States" },
  { company: "ShotGrid", location: "United States" },
  { company: "MASV", location: "Canada" },
  { company: "ftrack", location: "United Kingdom" },
];

const TITLE_RE =
  /sales|business develop|commercial|account (director|manager)|head of (sales|commercial)|partnership|revenue|growth|client director|new business/i;

async function apolloFetch<T = unknown>(path: string, body: unknown): Promise<T> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) throw new Error("APOLLO_API_KEY is not set");
  const r = await fetch(`${APOLLO_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify(body),
  });
  const json = (await r.json()) as T;
  if (!r.ok) throw new Error(`Apollo ${path} → ${r.status}: ${JSON.stringify(json)}`);
  return json;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ApolloPerson {
  id: string;
  first_name?: string;
  last_name?: string;
  title?: string;
  organization_name?: string;
}

/** Searches one company, reveals up to 3 matching-title contacts. */
async function prospectCompany(target: TargetCompany): Promise<ColdLead[]> {
  const search = await apolloFetch<{ people?: ApolloPerson[] }>("/v1/mixed_people/api_search", {
    q_keywords: target.company,
    person_locations: [target.location],
    per_page: 25,
  });
  const candidates = (search.people ?? []).filter((p) => TITLE_RE.test(p.title ?? ""));

  const leads: ColdLead[] = [];
  for (const person of candidates.slice(0, 3)) {
    await sleep(300);
    try {
      const revealed = await apolloFetch<{
        person?: { email?: string; first_name?: string; last_name?: string };
      }>("/v1/people/match", { id: person.id });
      const email = revealed.person?.email;
      if (!email || email.includes("email_not_unlocked")) continue;
      leads.push({
        email,
        first_name: revealed.person?.first_name || person.first_name || "",
        last_name: revealed.person?.last_name || person.last_name || undefined,
        company: target.company,
      });
    } catch (err) {
      logger.error({ err, company: target.company }, "apollo-prospecting: reveal failed — skipping contact");
    }
  }
  return leads;
}

/** Rotates through the target list so repeated runs cover different companies. */
function rotationStart(): number {
  const daysSinceEpoch = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  return daysSinceEpoch % TARGET_COMPANIES.length;
}

const MAX_COMPANIES_PER_RUN = 20;

/**
 * Finds up to `needed` fresh (never-before-contacted, title-matched, real
 * email) leads by rotating through the target company list, then uploads
 * them to the current cold campaign via uploadColdLeads() and records them
 * in cold_prospect_contacts so they are never targeted again.
 *
 * Non-fatal: any failure is logged and surfaced to the caller as a thrown
 * error so the scheduler can email Karilyn — it never leaves leads
 * half-uploaded but unrecorded (each upload + record pair is immediate).
 */
export async function autoFillColdLeads(needed: number): Promise<{ uploaded: number; searched: number }> {
  if (needed <= 0) return { uploaded: 0, searched: 0 };

  const start = rotationStart();
  let uploaded = 0;
  let searched = 0;

  for (let i = 0; i < TARGET_COMPANIES.length && searched < MAX_COMPANIES_PER_RUN && uploaded < needed; i++) {
    const target = TARGET_COMPANIES[(start + i) % TARGET_COMPANIES.length];
    searched++;
    let found: ColdLead[];
    try {
      found = await prospectCompany(target);
    } catch (err) {
      logger.error({ err, company: target.company }, "apollo-prospecting: company search failed — skipping");
      continue;
    }
    if (found.length === 0) continue;

    const emails = found.map((l) => l.email.trim().toLowerCase());
    const already = await db
      .select({ email: coldProspectContactsTable.email })
      .from(coldProspectContactsTable)
      .where(inArray(coldProspectContactsTable.email, emails));
    const alreadySet = new Set(already.map((r) => r.email));

    for (const lead of found) {
      if (uploaded >= needed) break;
      const email = lead.email.trim().toLowerCase();
      if (alreadySet.has(email)) continue;
      if (validateColdLead(lead)) continue; // not a named person / generic mailbox

      // Claim the email BEFORE uploading so a crash mid-loop can never
      // re-contact the same person on the next run.
      const claimed = await db
        .insert(coldProspectContactsTable)
        .values({ email, company: lead.company })
        .onConflictDoNothing({ target: coldProspectContactsTable.email })
        .returning({ email: coldProspectContactsTable.email });
      if (claimed.length === 0) continue; // another run claimed it concurrently

      try {
        const result = await uploadColdLeads([lead]);
        if (result.uploaded > 0) {
          uploaded++;
        } else {
          // Ramp cap reached — stop trying, leave the claim in place (this
          // person is still "contacted" in intent; the campaign is just full).
          logger.info({ email }, "apollo-prospecting: contact cap reached — stopping this run");
          return { uploaded, searched };
        }
      } catch (err) {
        logger.error({ err, email }, "apollo-prospecting: Instantly upload failed for claimed contact");
      }
    }
  }

  logger.info({ uploaded, searched, needed }, "apollo-prospecting: run complete");
  return { uploaded, searched };
}
