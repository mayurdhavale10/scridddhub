# Residential-land scraping follow-up — 20 September 2026

## Completed in this follow-up

- Implemented and ran a reproducible offline audit of all 889 saved observations.
- Confirmed 574 distinct MagicBricks listing IDs. Physical-property identity remains unverified.
- Reprocessed original raw evidence to recover URLs, seller types and descriptions for both original Kalyan observations. Original source records were not edited.
- Normalized numeric prices and area units, recomputed asking rates, checked display-price scaling, and flagged ambiguous prices, units, dates, land-use descriptions, large parcels and project inventory.
- Screened coordinates against a broad target-region box and identified repeated pins. This does not resolve exact locality or parcel geography.
- Grouped repeated source IDs and flagged seven cross-ID duplicate candidate groups for review. These candidates were not automatically merged.
- Produced 392 provisional latest-per-source-ID observations for an investigation snapshot. They are not a validated training dataset or 392 proven distinct parcels.
- Reconciled source cards against saved records: Mumbai's 94 cards include 19 repeats, yielding 75 distinct IDs; Navi Mumbai's 292 cards include 25 repeats, yielding 267 distinct IDs. No additional page collection is needed to explain these differences.
- Ran a paced MagicBricks browser pilot and a one-page Housing.com pilot, retaining HTML, extracted state, links and outcome reports.
- Fixed response classification for HTTP 200 pages containing hidden challenge containers. Nine offline regression tests pass.
- Verified unchanged hashes for the original records and the audited raw JSON files.

## Live outcomes

| Check | Observed result | Consequence |
|---|---|---|
| Thane page 1 | HTTP 200; 30 cards; site reports 205 results / 7 pages | Existing first-page coverage confirmed |
| Thane published page-2 link | HTTP 404 | Source pagination remains unresolved; cannot claim complete Thane collection |
| Published Shahad east-facing navigation page | HTTP 404 | No working replacement residential route established |
| Kamothe | HTTP 200; zero direct results | Nearby recommendations excluded |
| Rasayani | HTTP 200; zero direct results | Nearby recommendations excluded |
| Vasind | HTTP 200; zero direct results | Nearby recommendations excluded |
| Kalyan | HTTP 200; two direct results | No Khadakpada-specific residential route found in this page's links |
| Housing.com Kalyan | HTTP 200 with hidden Akamai challenge; no listing content | Pilot stopped; zero normalized second-source observations |

## Audit findings requiring review

Counts below are observations and include repeated source IDs:

| Finding | Observations |
|---|---:|
| Missing/invalid coordinates | 335 |
| Coordinates outside broad target box | 1 |
| Shared coordinate pins (at least three distinct source IDs) | 328 |
| Recomputed rate differs materially from listed rate | 10 |
| Invalid numeric price | 12 |
| Ambiguous displayed price | 11 |
| Invalid source rate | 13 |
| Invalid area | 1 |
| Area above 10,000 sqft review threshold | 171 |
| Project inventory | 82 |
| Ambiguous land-use keywords | 19 |
| Observations in cross-ID duplicate candidates | 24 |

Flags overlap. Thresholds are review rules, not proof of an error or legal land classification. Road-width and dimension units remain unverified. Seller/project effects, exact geography, listing-date semantics, and physical-property identity still require substantive review.

## Outputs

All paths below are relative to this file.

- [Audit implementation](../services/estimatedparcelvalue/pipeline/magicbricks/build_clean_land_data.py)
- [Quality audit and documented rules](../services/estimatedparcelvalue/pipeline/magicbricks_mmr_data/derived/audit_20260920T163501642878Z/quality_audit.md)
- [Clean observations](../services/estimatedparcelvalue/pipeline/magicbricks_mmr_data/derived/audit_20260920T163501642878Z/clean_observations.jsonl)
- [Review queue](../services/estimatedparcelvalue/pipeline/magicbricks_mmr_data/derived/audit_20260920T163501642878Z/review_queue.csv)
- [Property groups](../services/estimatedparcelvalue/pipeline/magicbricks_mmr_data/derived/audit_20260920T163501642878Z/property_groups.csv)
- [Cross-ID duplicate candidates](../services/estimatedparcelvalue/pipeline/magicbricks_mmr_data/derived/audit_20260920T163501642878Z/duplicate_candidates.csv)
- [Provisional snapshot](../services/estimatedparcelvalue/pipeline/magicbricks_mmr_data/derived/audit_20260920T163501642878Z/model_snapshot_provisional.jsonl)
- [Locality coverage](../services/estimatedparcelvalue/pipeline/magicbricks_mmr_data/derived/audit_20260920T163501642878Z/locality_coverage.csv)
- [Page reconciliation](../services/estimatedparcelvalue/pipeline/magicbricks_mmr_data/derived/audit_20260920T163501642878Z/coverage_reconciliation.csv)
- [MagicBricks live pilot](../services/estimatedparcelvalue/pipeline/magicbricks_mmr_data/pilots/20260920T163111Z_magicbricks/report.json)
- [Housing.com pilot](../services/estimatedparcelvalue/pipeline/magicbricks_mmr_data/pilots/20260920T163457Z_housing/report.json)

JSONL is used for derived datasets instead of the proposed Parquet format so this audit needs no additional package installation. Each run gets a separate output directory and source hash.

## Remaining scraping work

1. Obtain a functioning published Thane pagination route and Shahad residential route. The current verified routes fail; changing slug strings without evidence would not establish a fix.
2. Find additional-source coverage for Kalyan/Khadakpada. Housing.com did not yield usable data in this pilot. Use captured listing evidence rather than cached search snippets for training observations.
3. Review the queue and resolve exact locations, possible cross-ID duplicates, project inventory and ambiguous parcels before deciding which detail pages would add value.
4. Collect later observations for selected markets to establish freshness and changes over time. A recurring schedule has not been installed; same-day repeated captures are not temporal validation.
5. Build a broader source adapter only after a small pilot delivers usable evidence. No second-source normalized records were added in this follow-up.

## Reproduce offline

From `services/estimatedparcelvalue/pipeline` in PowerShell:

```powershell
.\.venv\Scripts\python.exe -B build_clean_land_data.py
.\.venv\Scripts\python.exe -B -m unittest test_clean_land_data -v
```
