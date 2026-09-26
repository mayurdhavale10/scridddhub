> Review counts are superseded by [the review and promotion status](RESIDENTIAL_LAND_REVIEW_STATUS_20260923.md): 78 REI candidates triaged; actual new benchmark 365 rows. Raw inventory below remains historical evidence. Broad collection is paused.

# Residential land growth batch — 23 September 2026

This report supersedes the earlier September 23 pilot totals. The user requested continued collection toward a provisional 5,000–10,000 reviewed-row target. The full task remains incomplete.

## Verified collection totals

| Source | Observations | Distinct source IDs | Status |
|---|---:|---:|---|
| MagicBricks | 996 | 580 | Existing data unchanged; 364-row research benchmark preserved |
| PropertyWala | 66 | 65 | All 65 IDs have detail review; 25 additional unique documents captured |
| RealEstateIndia | 1167 | 1079 | 951 IDs new since previous 128-ID pilot; detail/eligibility review incomplete |
| Reeltor | 20 | 20 | Wrong-locality diagnostic; unchanged |
| NoBroker | 10 | 10 | Diagnostic; unchanged |

RealEstateIndia added 1028 search observations and 951 previously unseen source IDs. Repeated appearances are linked in a unique-listing index; IDs are not verified independent parcels.

| Requested market | Card/link observations | Distinct source IDs |
|---|---:|---:|
| kalyan | 45 | 31 |
| kalyan-khadakpada | 21 | 21 |
| mumbai | 601 | 600 |
| thane | 500 | 477 |

Counts include related links and broad district results; do not add market ID counts as independent properties. Source locality is retained separately.

## Pagination and access outcomes

- RealEstateIndia thane: 19/19 reported pages saved; 0 empty result sets, 0 repeated result sets.
- RealEstateIndia mumbai: 22/22 reported pages saved; 0 empty result sets, 0 repeated result sets.
- Pagination uses the exact public scroll/load-more form in the saved HTML, including city, page number and other parameters. Robots permits this endpoint. No private/authenticated endpoint was used.
- An individual RealEstateIndia detail returned HTTP 503 after six successful details. That detail batch stopped. Later, after a cooldown and alternate-source work, a distinct public pagination pilot succeeded. The failed detail was not retried.
- CommonFloor robots request returned HTTP 403; no further CommonFloor requests.
- 360plot Kalyan and Thane pages returned HTTP 200 but contained no usable listing cards in the saved HTML. “50+” in an SEO title was not counted as 50 listings.

## Reviewed eligibility

PropertyWala decisions across all 65 IDs:
- candidate_pending_locality_and_duplicates: 1.
- hold_price_and_related_ads: 9.
- exclude_category_conflict: 1.
- hold_project_configuration: 28.
- hold_building_category_conflict: 19.
- candidate_pending_project_and_duplicates: 1.
- hold_area_and_locality_conflict: 2.
- hold_price_basis_and_locality: 1.
- exclude_agricultural_description: 3.

Ten Mirador IDs share one project document; three Diviana Park IDs have an agricultural-land description. Many older Mumbai/Thane cards are apartment or mall projects. Generic project configurations remain on hold.

Six new RealEstateIndia details were reviewed: one pending Badlapur candidate and five holds for mixed use, price-display conflicts, rates or related projects. Rustomjee Belle Vue overlaps PropertyWala evidence. Two earlier Khadakpada details remain excluded for building-category conflicts.

There are 78 RealEstateIndia IDs with numeric card price and explicit plot area; this is a screening count, not approved training data. 0 IDs have conflicting numeric observations.

**Approved additions: 0.** The historical 364-row benchmark is unchanged. Progress against the provisional planning range remains 3.64%–7.28%, leaving 4,636–9,636 approved rows. Raw scraping growth must not be presented as reviewed-dataset completion.

## Evidence and validation

Paths relative to `services/estimatedparcelvalue/pipeline/`:

- Authoritative review: `residential_land_pilots/growth_review_20260923T063928956961Z/`.
- `propertywala_all_id_reviews.jsonl`: one review per saved PropertyWala ID.
- `realestateindia_observations.jsonl`: all saved search observations.
- `realestateindia_unique_listings.jsonl`: deduplicated source-ID index, evidence paths and conflicts.
- `realestateindia_new_detail_reviews.jsonl`: six new per-ID decisions.
- `cross_source_project_groups.json`: related-project candidates, not confirmed same-parcel assertions.
- Raw responses: `residential_land_pilots/<source>/20260923_*/*/body.bin`; metadata and timestamps in sibling `response.json` files. Request plans and batch manifests preserve GET/POST parameters.
- Validation: `residential_land_pilots/growth_review_20260923T063928956961Z/validation/`; 41 tests passed and 78 new raw-response hashes verified. Both benchmark snapshots and historical observation files remain hash-unchanged.

## Next work / remaining

1. Review the new RealEstateIndia unique-ID queue, prioritizing actual Mumbai/Thane-city/Kalyan addresses, fresh explicit total price and plot area. Exclude buildings, agricultural/commercial offers and generic configurations; resolve project/parcel duplicate candidates before approval.
2. Review published additional Kalyan/Thane locality pagination and relevant unvisited details; the 503 detail and unattempted detail-plan entries remain unresolved. Reuse all successful evidence.
3. MagicBricks: six September 22 IDs need review; Thane pagination, Shahad and Khadakpada gaps remain. Prior zero-result markets remain unresolved across sources.
4. Other 33-market searches for alternate websites remain largely uncollected. NoBroker/Housing/99acres/Square Yards historical access or reuse issues remain; Reeltor property routes remain robots-disallowed. MahaRERA is supporting project evidence, not a plot-price feed.
5. Expand only through relevant permitted sources. Reassess the 5,000–10,000 planning target against actual usable inventory and locality-level model support; do not relax quality to reach it.
