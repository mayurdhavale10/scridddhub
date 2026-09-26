# 0006. Location search is a separate concern from price valuation

## Context

The Estimate Value feature (ADR-0004, ADR-0005) currently requires a user to pick District →
Taluka → Village through three cascading dropdowns, and only returns a real number for the one
village manually seeded so far (Kakadapada, Kalyan, Thane). This is honest but not the product —
the actual requirement is: a user types a location, and gets a price. Getting there by manually
seeding every village in Maharashtra one at a time does not scale.

The user proposed (and this ADR adopts) a re-architecture: stop treating "resolve what a user
typed into a real place" and "estimate what land is worth there" as one problem. They are two
different problems with two different solutions.

## Decision

1. **Location resolution is a geocoding problem, not a matching problem.** A user's free-text
   input (e.g. "Khadakpada, Kalyan") is resolved to real coordinates via a geocoding service —
   not by fuzzy-matching against our own seeded village list. This eliminates the free-text
   location-matching problem that was flagged as unsolved in every prior version of this feature's
   documentation. The mechanism (Google Places/Geocoding API, a self-hosted OSM Nominatim instance,
   or another provider) is a separate, explicit decision — see Open Questions. **Using Google's
   APIs at any real volume is a paid, metered service requiring a Google Cloud billing account —
   this is a vendor/cost decision requiring explicit sign-off, the same category as the commercial
   land-data licensing decision already declined once. Not yet approved.**
2. **Valuation runs on coordinates, not on administrative names.** Once a location resolves to
   `(lat, lon)`, the valuation model (once one exists) queries by geographic proximity — nearby
   real observations, nearby Ready Reckoner rate, nearby infrastructure — not by exact
   district/taluka/village string match. District/taluka/village become descriptive labels shown
   to the user, not the lookup key.
3. **A simple, interpretable geographic baseline comes before any ML model.** Before training
   anything, compute a distance- and recency-weighted average/median price from real nearby
   observations (grouped into H3/geohash cells internally, never shown to the user). Any future
   ML model must be evaluated against this baseline on held-out data and is only adopted if it
   genuinely beats it. This directly extends this project's existing "AI drafts, human decides"
   discipline into the modeling process itself: a model nobody can out-perform a transparent
   average is not worth the opacity.
4. **Model validation must be geographic and temporal, never a random split.** Real estate prices
   are spatially and temporally autocorrelated — a random train/test split lets nearby or
   time-adjacent observations leak between train and test, producing misleadingly high accuracy.
   Held-out test sets must be entire unseen geographic cells and/or a later time window.
5. **Every estimate discloses a confidence tier (High/Medium/Low), driven by real observation
   density/recency near that location — never a fabricated High shown just because a number came
   out of the model.** This is the same "never present an unverified fact as verified" rule
   already applied to the Ready Reckoner floor-value disclaimer, extended to model confidence.
6. **Rollout is phased by city-cluster, not attempted Maharashtra-wide at once.** Mumbai
   Metropolitan Region (Kalyan-Dombivli-Thane-Navi Mumbai-Mumbai-Panvel) first, as the proof of
   concept, then Pune/PCMC, Nashik, Nagpur, then remaining urban centers, then rural/agricultural
   land last (a genuinely different pricing problem, deferred deliberately).

## What this does NOT solve, on its own

This ADR fixes the *architecture*. It does not solve the actual bottleneck this project has hit
repeatedly: **where the real, varying-price training observations come from, legally and at
volume.** A source-viability survey (checking specific candidate sources hands-on, the same way
MagicBricks/MahaRERA were checked — not assumed) is required before any baseline or model can be
built, and is tracked as ongoing work in `services/estimatedparcelvalue/README.md`, not resolved
by this decision.

## Consequences

- The mobile app's District/Taluka/Village pickers become a fallback/manual-entry path, not the
  primary input — the primary path becomes a location search box once geocoding is wired in. This
  is a real, scoped UI change, not yet built.
- `ready_reckoner_rates` and `land_parcels` both need latitude/longitude to participate in a
  coordinate-based baseline/model — neither table has it today. A real schema addition, not yet
  built.
- The land-type scope narrows deliberately for the first working version: **residential land/
  plots only** — mixing in agricultural, commercial, and industrial land in one model would
  conflate genuinely different value drivers for the same coordinates.
