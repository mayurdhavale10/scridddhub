# Offline residential plot data audit

Processing version: 1.0.0; evidence reference: 2026-09-20T11:57:16.454433+00:00

- Observations: 889; distinct source IDs: 574.
- Provisional snapshot: 392 latest-per-source-ID rows.
- Recovered fields from original raw pages: {'url': 2, 'seller_type': 2, 'description': 2}.
- Cross-ID duplicate candidate groups: 7.

## Rules and limits

The snapshot is for investigation, not production valuation. Source labels do not verify residential buildability.
No physical-property count is claimed. Same-ID history is grouped; exact coordinate/area/price matches across IDs require review.
Coordinates are screened against a broad box (17.5-20.5 N, 72-74.5 E), not resolved to parcel/locality boundaries.
Rate disagreement threshold: greater than max(1 INR/sqft, 5% of recomputed rate).
Area above 10,000 sqft, project inventory and land-use keywords require review, not deletion.
Listing age above 180 days requires review. Date semantics remain unverified; age uses observation time.
Snapshot selects latest observed row per ID across history, including IDs absent from newer searches. This does not establish active availability.
Missing coordinates do not exclude a locality-only experiment. Approximate/shared pins cannot support parcel distances.
JSONL is used instead of Parquet to avoid introducing package dependencies; all source values and evidence pointers are retained.

## Flag counts (observations, including repeats)

| Flag | Count |
|---|---:|
| coordinates_outside_target_box | 1 |
| cross_id_duplicate_candidate | 24 |
| invalid_area | 1 |
| invalid_coordinates | 335 |
| invalid_price | 12 |
| invalid_source_rate | 13 |
| land_use_keyword_review | 19 |
| large_parcel_review | 171 |
| project_inventory_review | 82 |
| rate_disagreement | 10 |
| shared_coordinate_pin | 328 |

## Latest-run page reconciliation

| Market | Reported | Raw cards | Repeated accepted cards | Distinct raw IDs | Saved | Missing from saved |
|---|---:|---:|---:|---:|---:|---:|
| kalyan | None | 2 | 0 | 2 | 2 | 0 |
| mumbai | 94 | 94 | 19 | 75 | 75 | 0 |
| thane | 205 | 30 | 0 | 30 | 30 | 0 |
| navi-mumbai | 292 | 292 | 25 | 267 | 267 | 0 |
| dombivli | 1 | 1 | 0 | 1 | 1 | 0 |
| ulhasnagar | 4 | 4 | 0 | 4 | 4 | 0 |
| ambernath | 1 | 1 | 0 | 1 | 1 | 0 |
| badlapur | 2 | 2 | 0 | 2 | 2 | 0 |
| shahad | None | 0 | 0 | 0 | 0 | 0 |
| titwala | 1 | 1 | 0 | 1 | 1 | 0 |
| mira-bhayandar | 3 | 3 | 0 | 3 | 3 | 0 |
| vasai | 1 | 1 | 0 | 1 | 1 | 0 |
| virar | 2 | 2 | 0 | 2 | 2 | 0 |
| naigaon | 2 | 2 | 0 | 2 | 2 | 0 |
| nalasopara | 1 | 1 | 0 | 1 | 1 | 0 |
| bhiwandi | 5 | 5 | 0 | 5 | 5 | 0 |
| panvel | 89 | 89 | 15 | 74 | 74 | 0 |
| new-panvel | 5 | 5 | 0 | 5 | 5 | 0 |
| taloja | 2 | 2 | 0 | 2 | 2 | 0 |
| kharghar | 12 | 12 | 0 | 12 | 12 | 0 |
| dronagiri | 14 | 14 | 0 | 14 | 14 | 0 |
| kalamboli | 1 | 1 | 0 | 1 | 1 | 0 |
| kamothe | 0 | 0 | 0 | 0 | 0 | 0 |
| rasayani | 0 | 0 | 0 | 0 | 0 | 0 |
| karjat | 18 | 18 | 0 | 18 | 18 | 0 |
| neral | 23 | 23 | 0 | 23 | 23 | 0 |
| khopoli | 9 | 9 | 0 | 9 | 9 | 0 |
| shahapur | 55 | 55 | 10 | 45 | 45 | 0 |
| asangaon | 4 | 4 | 0 | 4 | 4 | 0 |
| vasind | 0 | 0 | 0 | 0 | 0 | 0 |
| murbad | 23 | 23 | 0 | 23 | 23 | 0 |
| palghar | 43 | 43 | 7 | 36 | 36 | 0 |
| boisar | 4 | 4 | 0 | 4 | 4 | 0 |
| alibag | 32 | 32 | 2 | 30 | 30 | 0 |
| pen | 3 | 3 | 0 | 3 | 3 | 0 |
| uran | 32 | 32 | 0 | 32 | 32 | 0 |

Reported totals are source metadata. A gap between reported totals and delivered unique IDs is not proof of a collector defect.
Review coverage_reconciliation.csv before deciding whether another page request would add useful evidence.

## Collection priorities

1. Resolve Thane pagination and verify published Shahad/locality routes.
2. Pilot Kalyan/Khadakpada and empty-market routes only where allowed and accessible.
3. Choose second-source pilots from low-coverage localities; count incremental usable properties, not cards.
4. Revisit selected markets on a later date for longitudinal evidence; do not treat same-day repeats as new properties.
