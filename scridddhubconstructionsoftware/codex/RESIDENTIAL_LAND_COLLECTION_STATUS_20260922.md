# Collection status — 22 September 2026

Priority: Mumbai, Thane, Kalyan (including Khadakpada). The full multi-source task remains incomplete.

**Updated 23 September:** the historical counts below are retained as the prior
batch record. All 20 saved PropertyWala details are now reviewed; RealEstateIndia
first pages for Mumbai, Thane, Kalyan West and Khadakpada and two details have been
captured; Reeltor Khadakpada has been diagnosed. See the authoritative
[23 September continuation](RESIDENTIAL_LAND_COLLECTION_STATUS_20260923.md).
The reviewed benchmark remains 364 rows, hash-unchanged. All 34 tests pass.

## Priority batch results

| Website | Requested market | Saved observations | New source IDs vs previous dataset | Result |
|---|---|---:|---:|---|
| MagicBricks | mumbai | 75 | 5 | All 4 reported pages fetched |
| MagicBricks | thane | 30 | 1 | Page 1 saved; published page 2 still HTTP 404 (208 advertised results) |
| MagicBricks | kalyan | 2 | 0 | Single reported page fetched; no resolved Khadakpada listing |
| PropertyWala | Mumbai | 20 | 20 source IDs | One results page captured; eligibility review pending |
| PropertyWala | Thane search, including wider district | 45 | 45 source IDs | Both results pages captured; eligibility review pending |
| PropertyWala | Kalyan | 1 | 0 additional beyond Thane batch | Same P243109329 appears in Thane; one detail page captured |
| PropertyWala detail pages | Mumbai, Thane, Kalyan | 20 | 20 distinct IDs | All HTTP 200; raw detail evidence retained, review pending |

MagicBricks now contains 996 observations / 580 distinct source IDs. Today added 107 observations but only 6 previously unseen source IDs (Mumbai 5, Thane 1, Kalyan 0).

PropertyWala contains 66 observations / 65 distinct IDs. Source IDs are not verified independent parcels. 60 observations have a single numeric price and explicit convertible area; this does not establish eligibility. 18 cards trigger building/commercial-description review and 3 trigger land-use review. Price ranges and missing prices remain null. Mumbai also has repeated 100-crore advertisements requiring duplicate and plausibility review. None entered the unchanged 364-row benchmark.

Kalyan detail P243109329 names Near kalyan station, Kalyan, Thane; the card asks INR 1,500,000 for 1,050 sqft (recomputed INR 1,428.57/sqft). This is not independently located in Khadakpada. Coordinates shown by the source are explicitly approximate.

The current MagicBricks Khadakpada all-property page returned HTTP 200 but its plot links lead to the existing general Kalyan route. Its mixed-property results were not added as plots. The current saved Thane page still publishes the same page-2 URL that returned 404.

## Every target region — MagicBricks

Counts below distinguish latest-run rows from distinct historical source IDs in each requested market. Overlapping searches mean region counts must not be summed as independent properties. Pagination completion is not exhaustive market coverage.

| Region | Latest run rows | Historical distinct IDs | Latest outcome / remaining |
|---|---:|---:|---|
| mumbai | 75 | 89 | Reported pagination fetched; broader source coverage remains |
| thane | 30 | 34 | Partial; page 2 HTTP 404 |
| navi-mumbai | 267 | 276 | Reported pagination fetched; broader source coverage remains |
| kalyan | 2 | 2 | Reported pagination fetched; broader source coverage remains |
| dombivli | 1 | 1 | Reported pagination fetched; broader source coverage remains |
| ulhasnagar | 4 | 4 | Reported pagination fetched; broader source coverage remains |
| ambernath | 1 | 1 | Reported pagination fetched; broader source coverage remains |
| badlapur | 2 | 2 | Reported pagination fetched; broader source coverage remains |
| shahad | 0 | 0 | Route unresolved; HTTP 404 |
| titwala | 1 | 1 | Reported pagination fetched; broader source coverage remains |
| mira-bhayandar | 3 | 3 | Reported pagination fetched; broader source coverage remains |
| vasai | 1 | 1 | Reported pagination fetched; broader source coverage remains |
| virar | 2 | 2 | Reported pagination fetched; broader source coverage remains |
| naigaon | 2 | 2 | Reported pagination fetched; broader source coverage remains |
| bhiwandi | 5 | 5 | Reported pagination fetched; broader source coverage remains |
| panvel | 74 | 74 | Reported pagination fetched; broader source coverage remains |
| new-panvel | 5 | 5 | Reported pagination fetched; broader source coverage remains |
| taloja | 2 | 2 | Reported pagination fetched; broader source coverage remains |
| kharghar | 12 | 12 | Reported pagination fetched; broader source coverage remains |
| karjat | 18 | 18 | Reported pagination fetched; broader source coverage remains |
| neral | 23 | 23 | Reported pagination fetched; broader source coverage remains |
| khopoli | 9 | 9 | Reported pagination fetched; broader source coverage remains |
| palghar | 36 | 36 | Reported pagination fetched; broader source coverage remains |
| boisar | 4 | 4 | Reported pagination fetched; broader source coverage remains |
| alibag | 30 | 30 | Reported pagination fetched; broader source coverage remains |
| pen | 3 | 3 | Reported pagination fetched; broader source coverage remains |
| uran | 32 | 32 | Reported pagination fetched; broader source coverage remains |
| shahapur | 45 | 45 | Reported pagination fetched; broader source coverage remains |
| asangaon | 4 | 4 | Reported pagination fetched; broader source coverage remains |
| vasind | 0 | 0 | Zero direct results; other sources remain |
| murbad | 23 | 23 | Reported pagination fetched; broader source coverage remains |
| nalasopara | 1 | 1 | Reported pagination fetched; broader source coverage remains |
| dronagiri | 14 | 14 | Reported pagination fetched; broader source coverage remains |
| kalamboli | 1 | 1 | Reported pagination fetched; broader source coverage remains |
| kamothe | 0 | 0 | Zero direct results; other sources remain |
| rasayani | 0 | 0 | Zero direct results; other sources remain |

## Websites still remaining

| Website | Collected scope | Remaining scope / blocker |
|---|---|---|
| MagicBricks | Data in 32 of 36 requested markets | Thane pagination; Khadakpada locality evidence; Shahad unresolved; Kamothe, Rasayani, Vasind zero direct results. New observations still need review. |
| PropertyWala | Mumbai, Thane, Kalyan results batch; one Kalyan detail | Eligibility, freshness, locality and cross-source duplicate review; other 33 target-market searches uncollected. District search cards are not separate completed regional searches. |
| NoBroker | Historical Khadakpada pilot: 3 direct + 7 nearby cards, 3 details | Additional Kalyan and all other 35 target-market searches; prior review unresolved. Not re-requested today. |
| 99acres | None | All 36 markets; historical HTTP 403. Not retried today. |
| Housing.com | Diagnostic evidence only | All 36 markets; historical challenge. Not retried today. |
| Square Yards | No usable listing dataset | All 36 markets; historical HTTP 403 and earlier terms-review stop. Not retried today. |
| RealEstateIndia | None | All 36 markets; earlier HTTP 429, extraction untested. Not retried today. |
| CommonFloor | None | All 36 markets; published navigation discovered, extraction pending. |
| 360plot | None | All 36 markets; local listing availability/extraction pending. |
| Reeltor | No saved usable listing dataset | All 36 markets; search-visible routes require local extraction and locality/area consistency review. |
| MahaRERA | Historical project-search evidence | Supporting track only; usable plot-level price/area data not established. |

1acre.in remains a geospatial feature API candidate, not a listing-price collection target.

## Evidence and checks

- MagicBricks batch: `services/estimatedparcelvalue/pipeline/magicbricks_mmr_data/batch_20260922T111922Z.json`.
- MagicBricks recount: `magicbricks_mmr_data/coverage_quality_20260922T113100Z.json` and CSV under the pipeline.
- PropertyWala raw responses, extracted observations, links and this machine-readable report: `residential_land_pilots/propertywala/20260922_priority/`.
- PropertyWala detail batch: `residential_land_pilots/propertywala/20260922_priority/detail_batch_20260922/manifest.json` (20/20 HTTP 200).
- Khadakpada navigation evidence: `residential_land_pilots/magicbricks/20260922_priority/khadakpada_navigation/`.
- Collection timestamps are retained per response; MagicBricks uses 10-second inter-page and 20-second inter-market waits. PropertyWala requests were sequential and separated by more than 10 seconds (more than 20 between market searches).
- Three offline parser checks cover conversions, price ranges, missing units, category warnings and refusal handling. Raw HTML hashes and source URLs are retained.
- Historical MagicBricks observations are an unchanged prefix of the append-only file; new data does not overwrite the reviewed benchmark.

Next work: review the six new MagicBricks IDs and PropertyWala candidates; investigate an alternative published Thane pagination route if one appears; collect the untested sources in Mumbai/Thane/Kalyan before expanding further.
