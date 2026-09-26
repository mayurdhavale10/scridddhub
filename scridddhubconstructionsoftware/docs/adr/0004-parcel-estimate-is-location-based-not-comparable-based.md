# 0004. Parcel value estimates are location-based against external data, never comparable-based

## Context

The "Just checking a location" flow (Screen 4.2) offers an "Estimate Value" feature for a parcel
the user hasn't priced yet. The first implementation attempt (and a proposed follow-up
improvement) computed this estimate by comparing the entered parcel against other `LandParcel`
records already in the same project/org database — narrowing, then widening, the comparison pool
as a "tier" system.

This was corrected, on the record, by the user: an estimate must not depend on what other parcels
happen to exist in this app's own database, at any scope. A user's first parcel must be
estimable, and the number must mean the same thing regardless of how much or how little other
data this particular org has entered. Comparing against internal data conflates "what we happen
to have on file" with "what this land is actually worth" — those are different things, and only
the second one is a valid estimate.

A related idea was also raised and rejected: having an LLM "search the web and estimate" at query
time. Real automated valuation models (Zillow/HouseCanary/Redfin-class) do not do this — they run
a statistical model over data that was already licensed and ingested on a schedule (MLS listings,
county tax assessor records), not fetched live per query. An LLM guessing a price from general
knowledge is not a verified fact, and this project's standing rule is to never present an
unverified fact as verified.

## Decision

The estimate is computed from real, external, government-published reference data for the
parcel's own location — starting with Maharashtra's Ready Reckoner Rate (RRR / e-ASR), the
state's own annually-published minimum land value per village/zone, used for stamp duty. The
calculation is `matched location's official rate × entered area` (FSI-adjusted where relevant),
with the source and its effective date disclosed alongside the number.

This data is ingested into our own reference table on a schedule (matching the RRR's own annual
refresh), not queried against other parcels in the app, and not fetched via live web search or
LLM recall.

Full research, sources, and the phased implementation plan live in
`services/estimatedparcelvalue/README.md` — this ADR records the decision; that doc tracks the
working detail as the feature is built.

## Consequences

- A user's very first parcel, with zero other data in the app, can still get a real estimate —
  the feature does not depend on org-level data density.
- Requires building and maintaining a real ingestion pipeline for external government data,
  starting with one state (Maharashtra) — a genuinely larger undertaking than a database query,
  and scoped as such rather than treated as a quick addition.
- Expanding to states beyond Maharashtra is a distinct, separate scoping decision each time, since
  each state publishes its own rate data under its own name, portal, and format.
- The hardest remaining problem is location matching (free-text input → the reference data's own
  village/zone naming), not the valuation math itself — flagged as an open question in the
  services doc, not yet decided.
