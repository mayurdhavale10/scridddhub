# 0005. Future pricing-model training data is pooled and cross-org, never a per-org comparison

## Context

The Estimate Value feature (ADR-0004) currently returns Maharashtra's Ready Reckoner Rate — a
real, government-published number, but a legal *floor* for stamp duty, not a market estimate (see
`services/estimatedparcelvalue/README.md`). Closing that gap for real means building something
closer to how Zillow/HouseCanary/Redfin actually work: a statistical (hedonic pricing) model
trained on real transaction records with price variance to learn from — the RRR floor rate has
none, since it's one fixed number per village per year.

Research into Maharashtra's second public data source — the Index-II registered-transaction search
(`freesearchigrservice.maharashtra.gov.in`) — confirmed it requires already knowing a specific
survey/property number; it has no date-range search, no list view, no bulk export. It cannot be
used to discover unknown transactions in bulk, only to verify one already known. This is a real,
structural gap in India's public land-records data, not a tooling limitation on our side — it's
the reason commercial aggregators (PropEquity, Zapkey, 99acres, Housing.com) exist as businesses.

This raised a real risk: the only realistic near-term source of real, varying transaction prices
is data our own users enter (a parcel's `cost_rupees`). ADR-0004 already rejected using other
parcels as live comparables — the user explicitly ruled out "compare against other parcels in your
own project/org, at any scope." A naive reading could make any use of parcel price data look like a
reversal of that decision. It is not, and the difference needs to be on the record before anything
is built on it.

## Decision

Future training data for a real pricing model is:

1. **Pooled and anonymized across all orgs**, never scoped to the requesting user's own
   project/org. A live per-request lookup of "other parcels in your project" (rejected in
   ADR-0004) is fundamentally different in kind from an offline-trained, versioned statistical
   model built from many orgs' real closed transactions — the same relationship US AVMs have to
   MLS data pooled across many unrelated sellers, not a live "check your neighbor's asking price."
2. **Built from CLOSED/transacted prices, not asking prices.** `LandParcel.cost_rupees` today is
   an asking price captured once at creation — often aspirational, never updated as a deal
   progresses. Using it as ground truth for a valuation model would repeat the exact category
   mistake ADR-0004's own investigation caught between the Ready Reckoner Rate (floor) and a
   built-flat rate (a different thing entirely): asking price is not market truth either. A
   `closed_price_rupees` + `closed_at` pair, set only when a deal genuinely closes, is the real
   signal.
3. **Never trained or shown to any individual org until there is real statistical volume.** No
   regression is fit on a handful of points — that's overfitting dressed up as a model, the same
   category of dishonesty this project has repeatedly rejected elsewhere (never present an
   unverified fact as verified). A minimum sample-size gate is enforced before any model-backed
   estimate replaces the plain RRR floor-value lookup.
4. **Versioned and disclosed.** Any future model-backed estimate must record which model version
   produced it (training date, sample size), the same way a Ready Reckoner Rate result discloses
   its source and effective year — never a black-box number.

## Consequences

- `LandParcel` needs structured `district`/`taluka`/`village` fields (nullable, populated only when
  known — e.g. the "Just checking a location" flow, which already collects them via the Ready
  Reckoner picker) so a closed transaction can be matched to a training bucket without solving
  free-text location matching first.
- `LandParcel` needs `closed_price_rupees`/`closed_at`, set through a dedicated action distinct
  from the original asking price — a deal closing is a real, separate event.
- A pooling query (real, cross-org, anonymized — price/area/location only, no org/project/party
  identity) is legitimate infrastructure to build now even with zero rows in it today; training a
  model on it is not legitimate until real volume exists. These are different milestones and must
  not be conflated.
- This does not change ADR-0004's core rule: an individual estimate request still never looks up
  or compares against specific named parcels. It only ever reads a versioned, pre-trained model
  (once one exists) or the plain RRR floor rate (today).
