---
name: Apollo prospecting setup
description: How to use the Apollo.io API to find named sales contacts for the Instantly cold campaign
---

# Apollo prospecting

## Auth
- Secret: `APOLLO_API_KEY` (x-api-key header)
- Base: `https://api.apollo.io`
- People search: `POST /v1/mixed_people/api_search`
- Email reveal: `POST /v1/people/match` with `{ id }` — costs 1 credit, returns full name + email
- Industry tag search (`/v1/tags/search`) returns empty for film/TV — don't bother

## What works
- `q_keywords: "company name"` + `person_locations: ["United Kingdom"]` or `["California, United States"]` finds real employees
- Filter client-side by title regex: `/sales|business develop|commercial|account (director|manager)|head of (sales|commercial)|partnership|revenue|growth|client director|new business/i`
- Reveal up to 3 per company; sleep 300ms between reveals to stay under rate limits
- Domain filter (`organization_domains`) does NOT work — returns all records; use q_keywords instead

## Snov.io (already tested, not useful)
- Auth endpoint: `POST /v1/oauth/access_token` with `grant_type=client_credentials`
- Domain search returns 404 for all UK film industry domains — database doesn't cover this niche

## August 2026 batch
- 54 named leads uploaded to campaign `98360956-f78a-4f96-b4f8-13088b2c506c` (Aug 26 deadline)
- 31 CA/US first, then 23 UK
- Companies covered: Otto Nemenz, Keslow, Cinelease, Mole-Richardson, Company 3, Picture Shop,
  Formosa, Todd-AO, Quixote, Cast & Crew, GreenSlate, Extreme Reach, Front Row Insurance,
  Momentous, Aon/NFP, ISS Props, Sohonet, Sargent-Disc, Shoot Blue, 3 Mills, Lee Filters,
  Panalux, Molinare, Clear Cut, Technicolor, Production Park, UK Screen Alliance, EP, Tysers

## Instantly lead upload format (v2)
- One POST per lead to `POST /api/v2/leads`
- Body: `{ campaign_id, email, first_name?, last_name?, company_name? }`
- NOT a batch array — sending `leads: [array]` returns "Email is required" error
- 150ms sleep between posts to avoid rate limiting

## Instantly v2 lead upload — known bug
`POST /api/v2/leads` with `campaign_id` consistently orphans leads (campaign: NONE) for HSW campaigns. Tried: active campaigns, paused campaigns, minimal fields — all orphan. The same endpoint works for RIA Wire campaigns (unclear why). The existing `uploadColdLeads()` in `artifacts/api-server/src/lib/coldCampaigns.ts` has the same bug and has never run successfully in production (cold_campaigns table shows leads_uploaded=0). **Workaround: upload via Instantly UI using the CSV at `exports/hsw-cold-leads-40.csv`.** Orphaned leads (campaign: NONE) from failed API attempts are in the org — Karilyn should bulk-delete them from the Instantly UI (filter by no campaign). Do not attempt more API uploads until the root cause is understood.

**Why:** Apollo's film/TV industry coverage is strong for named BD/sales people at vendors. Snov and Skim both failed for this niche. The keyword-per-company approach with client-side title filtering is the reliable pattern.
