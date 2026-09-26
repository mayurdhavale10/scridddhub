# 0007. Planned infrastructure: a shared, human-approved list matched by distance

## Context

Screen 5 ("Planned Infrastructure") must answer: *for any property, what new infrastructure is
coming nearby?* — metro stations, highways, airports — with a source and a "verified" date, as in
the wireframe ("Metro Line 3 station — est. 2028 · source: state metro corp portal · verified 3
days ago").

What was checked on 2026-09-26 before deciding:

- **No public dataset lists planned infrastructure by location.** OpenStreetMap had *nothing*
  planned within 5 km of Khadakpada, Kalyan, even though Metro Lines 5 and 12 are both under
  construction there (the same query did return the existing railway stations, so the query was
  not the problem).
- **Official agencies publish project facts, but rarely geodata.** MMRDA publishes a KML with all
  17 Metro Line 5 station coordinates; for Metro Line 12 it publishes only a route description and
  progress figures — no coordinates, and no completion date (press dates disagree: Dec 2027 vs
  May 2028).
- **Free-text locations can be geocoded.** Nominatim resolved "Khadakpada, Kalyan" and
  "Raunak City" to the right places. ADR-0006 already chose geocoding over name matching for
  location resolution, and left the production provider as an open, cost-bearing decision.

## Decision

1. **One shared reference list** (`infrastructure_projects`), maintained like
   `ready_reckoner_rates`: reference data, not a per-parcel business entity, so no ADR-0002 audit
   trail and not editable through the app. Verify a project once; every property near it benefits.
2. **Every project carries its evidence**: `source_name`, `source_url`, `verified_at`,
   `verified_by`. Facts must be on the source page itself; press-only figures go in the free-text
   description, labelled as press, never in `expected_completion`.
3. **AI drafts, a human approves.** `review_status` is `pending | approved | rejected`; only
   `approved` projects are ever shown on a property. (Drafting pipeline and review UI: next phases.)
4. **Match by distance when positions are known.** The property's text is geocoded (cached in
   `geocode_cache`, never written onto the audited `land_parcels` row); each project's stations are
   `infrastructure_project_points` with a `coord_source` (`official_file | approximate | manual`).
   Results are straight-line km to the nearest point within 10 km, nearest first. A measured
   distance always wins over an administrative match.
5. **Fall back honestly when positions aren't known.** A project with no located points matches by
   taluka — the property's structured taluka, its typed text, or the geocoder's resolved address —
   and the UI says it is a taluka match, not a distance.
6. **Show where the location resolved to**, including when only part of the text was found
   ("Godrej Hill, Khadakpada" → measured from "Khadakpada"), so a wrong geocode is visible instead
   of silently producing wrong distances.
7. **Works without a parcel**: `GET /reference/planned-infrastructure?location=…` answers the same
   question for any typed location; `GET /land-parcels/{id}/planned-infrastructure` wraps it.

## Consequences

- Coverage equals the size of the approved list. Today: 2 projects (MMRDA Metro Lines 5 and 12),
  so most of MMR correctly shows "nothing on the list" — which is not the same as "nothing
  planned". Growing the list (AI drafting + review) is the main remaining work.
- Distances are straight-line, not road distance.
- **The public Nominatim service is development-only** (≤1 request/second, no bulk use, ODbL
  attribution required). The production geocoder remains ADR-0006's open question (Google /
  Mappls are paid and need explicit sign-off; self-hosted Nominatim is the free alternative).
- Scaling limits and their planned fixes are in `services/plannedinfrastructure/README.md`.

## Alternatives rejected

- **Per-parcel manual entry** — the same metro line re-typed for every nearby parcel, with no
  single place to update when a timeline slips.
- **LLM answers directly** — the Estimate Value work showed an LLM will confidently invent
  specifics (a ₹525 Cr estimate from a mis-placed location); infrastructure claims without a
  checkable source would be worse than none.
- **OpenStreetMap as the project source** — checked; it lacks the planned projects that matter here.
