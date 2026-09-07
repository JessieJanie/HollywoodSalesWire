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

## Instantly lead upload format (v2)
- One POST per lead to `POST /api/v2/leads`
- Body: `{ campaign: "<uuid>", email, first_name?, last_name?, company_name? }`
- **The field is `campaign`, NOT `campaign_id`** — `campaign_id` is silently accepted and ignored, orphaning the lead.
- NOT a batch array — sending `leads: [array]` returns "Email is required" error
- 150ms sleep between posts to avoid rate limiting

**Why:** Apollo's film/TV industry coverage is strong for named BD/sales people at vendors. Snov and Skim both failed for this niche. The keyword-per-company approach with client-side title filtering is the reliable pattern.
