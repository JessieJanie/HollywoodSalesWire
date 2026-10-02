/**
 * Curated named prospects sourced via Skim page reads (not Apollo).
 *
 * autoFillColdLeads() drains this pool FIRST each week, before falling back
 * to Apollo searches. Dedupe is handled by cold_prospect_contacts (each email
 * is claimed there before upload), so entries can stay in this file forever —
 * anyone already contacted is skipped automatically.
 *
 * Source run: Oct 2, 2026 — Skim read of the MBS Equipment worldwide
 * sound-stage directory (public studio/equipment booking contacts) plus
 * regional vendor contact pages. Stage operators sell stage space and
 * equipment packages into productions — same ICP as the cold-email copy.
 *
 * Rules for adding entries: named individuals only (no info@/sales@),
 * vendors that sell INTO productions (never studios/streamers themselves),
 * work email on the company's own domain (no personal ISP addresses).
 */

import type { ColdLead } from "./coldCampaigns";

export const SKIM_PROSPECTS: ColdLead[] = [
  // ── Georgia ──
  { email: "nick@roadtownenterprises.com", first_name: "Nick", last_name: "Smerigan", company: "Atlanta Metro Studios" },
  { email: "billy.stoll@cinespace.com", first_name: "Billy", last_name: "Stoll", company: "Cinespace Studios Atlanta" },
  { email: "dan@electricowlstudios.com", first_name: "Dan", last_name: "Rosenfelt", company: "Electric Owl Studios" },
  { email: "john@raulet.com", first_name: "John", last_name: "Raulet", company: "Mailing Avenue Stageworks" },
  { email: "mreams@ofsoptics.com", first_name: "Mike", last_name: "Reams", company: "URAGC Studios" },
  { email: "michael@techopolycap.com", first_name: "Michael", last_name: "Greenberg", company: "Pangaea Studios" },
  { email: "thomas@shadowboxstudios.com", first_name: "Thomas", last_name: "Laub", company: "Shadowbox Studios" },
  // ── New York ──
  { email: "pete@kaufmanastoria.com", first_name: "Peter", last_name: "Romano", company: "Kaufman Astoria Studios" },
  { email: "lisa@silvercup.nyc", first_name: "Lisa", last_name: "Sanchez", company: "Silvercup Studios" },
  { email: "james_arata@insightequipment.com", first_name: "James", last_name: "Arata", company: "Insight Equipment (Gold Coast / Grumman Studios)" },
  // ── California ──
  { email: "dbromley@mbsmediacampus.com", first_name: "Dana", last_name: "Bromley", company: "MBS Media Campus" },
  { email: "macosta@mbsmediacampus.com", first_name: "Manny", last_name: "Acosta", company: "MBS Media Campus" },
  { email: "ilyanna_hernandez@theculverstudios.com", first_name: "Ilyanna", last_name: "Hernandez", company: "The Culver Studios" },
  { email: "jeremy@lahangar.com", first_name: "Jeremy", last_name: "Jacobs", company: "LA Hangar Studios" },
  { email: "arucho@raleighstudios.com", first_name: "Adam", last_name: "Rucho", company: "Raleigh Studios" },
  { email: "timothy.wong@tvcityla.com", first_name: "Timothy", last_name: "Wong", company: "Television City Studios" },
  // ── Other US ──
  { email: "john@chicagostudiocity.com", first_name: "John", last_name: "Crededio", company: "Chicago Studio City" },
  { email: "nick.pissios@cinespace.com", first_name: "Nick", last_name: "Pissios", company: "Cinespace Studios Chicago" },
  { email: "rosemary@knickpt.com", first_name: "RoseMary", last_name: "Prodonovich", company: "The Fields Studios" },
  { email: "mark@redsky-studios.com", first_name: "Mark", last_name: "Sacco", company: "Red Sky Studios" },
  { email: "amanda.starr@worldwidestages.com", first_name: "Amanda", last_name: "Starr", company: "Worldwide Stages" },
  // ── Canada ──
  { email: "megan.guy@cinespace.com", first_name: "Megan", last_name: "Guy", company: "Cinespace Studios Toronto" },
  { email: "stevehancock@mbseco.ca", first_name: "Steve", last_name: "Hancock", company: "MBS Equipment Canada" },
  { email: "peter@tribrostudios.com", first_name: "Peter", last_name: "Apostolopoulos", company: "TriBro Studios" },
  // ── UK / Ireland ──
  { email: "justin.bennett@mbseco.uk", first_name: "Justin", last_name: "Bennett", company: "MBS Equipment UK (Shinfield / Wycombe / Hoddesdon)" },
  { email: "sarah-jane.hawkins@mbseco.uk", first_name: "Sarah-Jane", last_name: "Hawkins", company: "MBS Equipment Belfast" },
  { email: "mark@teachsolais.com", first_name: "Mark", last_name: "O'Brien", company: "Teach Solais / Ardmore Studios" },
];
