# Residential land promotion — 23 September 2026

Latest completed work: final saved-evidence review of RealEstateIndia **1476394**, Garden k Avenue, Virar West. **One actual admission** creates a new **366-row / 247-evidence-cluster research benchmark**. Both prior snapshots (364 and 365 rows) remain hash-unchanged. No new network requests were made.

## Admission evidence and limits

- Explicit residential-plot description in the saved detail, with source-reported leasehold tenure; project name alone does not establish a built apartment or a size-range offer.
- 595 sqft, Rs 50 lakh total and displayed Rs 8,403/sqft agree (computed Rs 8,403.36/sqft).
- Explicit source-card date: 16 April 2026, within 180 days at the saved detail capture. Detail-page date omission does not invalidate the card's date.
- Locality remains source-reported Virar West, Mumbai; no independently verified address, coordinates, legal status or approval-body claim is adopted.
- Duplicate screening covers all saved observations in the 580-ID MagicBricks corpus, 1,079-ID REI corpus and 65-ID PropertyWala corpus: **1,724 source IDs**. No other normalized project/seller match or similar-size Virar match was found. A Rs 50 lakh MagicBricks offer advertises 2,500 sqft; matching price alone is insufficient to identify the parcel.
- Admission is **one research asking-price observation**, not certification of an independent physical parcel. Its project evidence cluster must be reused if future Garden k Avenue offers are linked.

## Benchmark and validation

Source composition: **364 MagicBricks + 1 PropertyWala + 1 RealEstateIndia = 366 rows**. These rows are not 366 verified independent parcels.

Current snapshot, relative to `services/estimatedparcelvalue/pipeline/`:
`residential_land_pilots/benchmark_rei_promotion_20260923/benchmark_snapshot.jsonl`

SHA-256: `c8b13e95976df42142b304c06cbae5d88ab937319082ee9bc5c4b743f46f7b93`.

The same directory contains the approved-addition record, raw evidence manifest, duplicate-screen findings, predictions, summary, remaining dated action ledger and validation logs.

**54 tests passed**: 25 MagicBricks, 6 PropertyWala and 23 exploration. Tests cover preserved snapshots, one source-qualified addition, date/area/rate admission failures, duplicate signals and cluster-separated folds. Referenced evidence hashes verified.

Evaluation: **66 scored / 300 abstained**, median absolute percentage error **31.54%**, unchanged. The new observation has insufficient local comparables, so no accuracy improvement is claimed.

## Remaining work, after admission

Of the original 78 numeric REI candidates, **77 remain unadmitted**:

| Queue | Remaining |
|---|---:|
| Above 10,000 sqft | 46 |
| Within size, missing date | 12 |
| Dated and within size | 19 |

The 19 dated candidates are not 19 automatic new requests. Their current action ledger separates built properties (exclude without another fetch), the prior 503 (no retry), generic project offers (need parcel-specific evidence), and actual price/locality/land-use conflicts (need corrected or independent evidence). The ledger preserves the latest captured findings instead of reverting to stale card-only reasons.

Action counts: `{"exclude_built_property_no_detail_request": 4, "needs_corrected_or_independent_evidence_of_recorded_conflict": 10, "needs_parcel_specific_offer_not_another_generic_page": 4, "prior_503_no_retry": 1}`.

**Next priority:** obtain genuinely new, permitted Khadakpada residential-plot evidence or a published correction/parcel-specific document for one of the remaining dated candidates. Do not blindly fetch details for the 12 undated or 46 oversized rows. Khadakpada verified coverage is still **zero**. Broad scraping, MagicBricks Thane pagination and Shahad remain deferred. Existing cross-source project exclusions and one-representative caps remain in force.
