> Current problem statement (23 September 2026): turn saved source observations into a deduplicated, evidence-backed residential-land asking-price research benchmark, prioritising Mumbai, Thane and Kalyan and explicitly measuring the Khadakpada gap. Raw-volume growth is paused. Review and admission quality, not scraped IDs, measure progress. The original 364-row reference is preserved; the new version has 365 rows, not verified independent parcels. See [current decisions and remaining work](RESIDENTIAL_LAND_REVIEW_STATUS_20260923.md).

# Problem statement

## Revised collection objective — 23 September 2026

Build a provenance-backed dataset for estimating **residential vacant/buildable
plot asking rates in INR/sq ft**, initially prioritizing **Mumbai, Thane and
Kalyan, including Khadakpada**, then the existing 36-market scope. Asking rates
are not transaction valuations. Geographic coverage alone is not completion.

Use **5,000–10,000 reviewed, deduplicated usable rows** as a provisional planning
target, adopted from the user's requested order-of-magnitude estimate. It is
not a measured count of available plots, a statistically established minimum,
or a promise that these markets contain that many accessible eligible ads.
The existing 364-row research benchmark represents **3.64%–7.28%** of that
planning range, leaving **4,636–9,636** additional usable rows at this checkpoint.
Those 364 rows are experimental reviewed records, not independently confirmed
parcels. Do not use raw-card counts or the 32/36 market coverage ratio as the
percentage of the data objective completed.

Count progress in separate stages: raw observations; distinct source IDs;
detail-reviewed records; category/price/area/locality-qualified candidates;
deduplicated approved dataset rows; independent parcel/project groups. Preserve
the 364-row benchmark as a reproducible reference and put any subsequent
approved dataset in a new version. Price/area conflicts, apartments, commercial
or agricultural land, stale/unknown-price offers, generic configurations and
unresolved duplicate candidates must not inflate the usable-row count.

Success requires local support across area/price bands, sources, sellers and
projects; inspect locality-level coverage and abstain from an estimate when
support is inadequate. A global row target cannot establish sufficient
Khadakpada evidence or model reliability. Evaluate the target as collection
yield and held-out performance become measurable; do not widen geography or
relax eligibility merely to reach the number.

Execution: resume saved evidence, select unique permitted detail URLs, review
each capped batch, then expand published locality/pagination routes that yield
relevant new IDs. Retain raw responses, UTC timestamps, SHA-256 hashes and
explicit stop reasons. Stop at source access restrictions instead of bypassing
them. Report actual additions and the remaining gap after every batch.

The sections below retain the historical September 20 experiment and counts;
use the collection guide and newest status report for current inventory.

Latest collection checkpoint: [23 September growth report](RESIDENTIAL_LAND_GROWTH_STATUS_20260923.md).
RealEstateIndia has 1,079 source IDs after adding 951 newly seen IDs; PropertyWala
detail review covers all 65 saved IDs. These raw/diagnostic advances do not change
the 364-row benchmark or the approved-row planning gap above.

**Baseline follow-up, 20 September 2026:** reviewed duplicate, rate, geography and land-use flags and ran the first offline comparable-listing benchmark. See [the baseline review](RESIDENTIAL_LAND_BASELINE_REVIEW_20260920.md): 364 experimental records, 66 held-out estimates, 298 abstentions, and 31.54% median absolute percentage error on scored records only. A reference experiment now exists; reliable valuation and deployment remain unproven. Earlier descriptions of the baseline as planned are historical.

**Follow-up, 20 September 2026:** an automated offline audit, versioned derived datasets, missing-field recovery, page reconciliation, and targeted live pilots have now been completed. See [the scraping follow-up status](RESIDENTIAL_LAND_SCRAPING_STATUS_20260920.md) for outputs and current blockers. Human review, exact geographic resolution, physical-property verification, model validation and deployment remain pending. The historical collection totals below remain unchanged.

Build an AI/ML Automated Valuation Model (AVM) for **residential vacant/buildable land plots in Maharashtra**. A user enters a location, such as **Khadakpada, Kalyan**, and receives an estimated current land rate in **INR per square foot**, a reasonable price range, and an explanation of the estimate's reliability.

Start with the 36 selected Mumbai Metropolitan Region (MMR) markets and nearby growth corridors, collecting **one market at a time**. Agricultural, commercial, and industrial land belong in separate future datasets and models.

The immediate objective is a trustworthy training dataset containing asking price, plot area and unit, rate per square foot, coordinates, locality, ownership, transaction type, road width, dimensions, project/seller type, listing date, and provenance.

**Status as of 20 September 2026:** collection has progressed; a reliable valuation model has not yet been demonstrated. This document records completed work and proposes the next steps. The full audit, additional-source collection, model training, and deployment described below are not completed work.

### Source investigation

We investigated MagicBricks, 99acres, Housing.com, NoBroker, Square Yards, and MahaRERA. The saved investigation notes describe earlier access failures, extraction experiments, and source limitations. Those observations are historical; they are not a claim about every site's current accessibility.

MagicBricks is the only source currently contributing to the normalized residential-plot dataset. MahaRERA exploration produced project-search evidence, not a plot-price training dataset. Other investigated portals have not contributed normalized observations.

An earlier MagicBricks Thane exploration saved a 30-listing raw sample in `seo_state.json`. That exploratory file is separate from the production dataset; do not add its row count to the totals below.

### Collector implementation and live collection

- Built a Playwright collector accepting one market per invocation.
- Established a working installed-Chrome configuration with a visible window and a fresh browser context. This did not prove the exact cause of earlier headless-browser refusals.
- Added early HTTP checks, failure diagnostics, raw HTML/JSON retention, per-market crawl state, and run timestamps.
- Collected the original two Kalyan observations, then attempted all 35 remaining markets sequentially.
- Corrected several market URLs using published MagicBricks links, including city-qualified locality names.
- Replaced query-based pagination with the site's observed `/page-N` links. Repeated pages are now reported as incomplete rather than successful completion.
- Added fallbacks for detail URLs, seller type, and descriptions available under different source field names.
- Fixed duplicate handling within a page and added explicit checks for malformed results and pagination metadata.
- Saved a report of coverage and basic quality. Offline checks and saved-record integrity checks passed.

The collector retains repeated observations across runs and markets for provenance. These must not automatically become independent training examples.

### Dataset totals

| Measure | Verified count | Meaning |
|---|---:|---|
| Observations before the expanded collection | 2 | Original Kalyan records |
| New observations added | 887 | Includes repeated listings across markets/runs |
| Total observations in `records.jsonl` | 889 | Collection history |
| Distinct source listing IDs across all observations | 574 | Not necessarily 574 distinct physical parcels |
| Observations in each market's latest run, combined | 732 | Excludes earlier Mumbai/Navi Mumbai partial runs |
| Distinct listing IDs across latest market runs | 562 | Still requires property-level deduplication |
| Duplicate market/run/listing keys | 0 | This narrow integrity check passed |

The difference between 574 and 562 reflects listing IDs found in earlier runs but absent from the latest-run selection. Do not silently discard history or assume all older observations are still current. Select a documented snapshot for each modeling experiment.

### City-by-city latest-run coverage

“Collected” means the collector processed the site's reported pages. It does not guarantee all properties in that city were advertised or captured, and search-market names do not establish exact property locations.

| Market | Saved observations in latest run | Outcome |
|---|---:|---|
| Mumbai | 75 | Collected |
| Thane | 30 | Partial: page 2 returned HTTP 404 |
| Navi Mumbai | 267 | Collected |
| Kalyan | 2 | Collected earlier |
| Dombivli | 1 | Collected |
| Ulhasnagar | 4 | Collected |
| Ambernath | 1 | Collected |
| Badlapur | 2 | Collected |
| Shahad | 0 | Unresolved: configured URL returned HTTP 404 |
| Titwala | 1 | Collected |
| Mira-Bhayandar | 3 | Collected |
| Vasai | 1 | Collected |
| Virar | 2 | Collected |
| Naigaon | 2 | Collected |
| Nalasopara | 1 | Collected |
| Bhiwandi | 5 | Collected |
| Panvel | 74 | Collected |
| New Panvel | 5 | Collected |
| Taloja | 2 | Collected |
| Kharghar | 12 | Collected |
| Dronagiri | 14 | Collected |
| Kalamboli | 1 | Collected |
| Kamothe | 0 | Valid page, zero direct results |
| Rasayani | 0 | Valid page, zero direct results |
| Karjat | 18 | Collected |
| Neral | 23 | Collected |
| Khopoli | 9 | Collected |
| Shahapur | 45 | Collected |
| Asangaon | 4 | Collected |
| Vasind | 0 | Valid page, zero direct results |
| Murbad | 23 | Collected |
| Palghar | 36 | Collected |
| Boisar | 4 | Collected |
| Alibag | 30 | Collected |
| Pen | 3 | Collected |
| Uran | 32 | Collected |

Zero direct results means zero results on the requested source page at collection time, not that the market has no plots for sale. Nearby recommendations were not added as direct results for the three empty markets.

## 2. What we know about data quality

**The dataset is useful for investigation, but it is not yet validated for reliable land valuation.** The checks performed so far establish basic integrity and field availability, not predictive accuracy.

These counts apply to all **889 observations**, including repeated listing IDs:

| Check | Result | Implication |
|---|---|---|
| Coordinates | 554 have nonzero coordinates within global numeric bounds; 335 fail | The 554 have not been checked for geographic accuracy |
| Positive numeric price, area, and listed rate | 876 pass; 13 fail | Positivity does not establish unit consistency or price correctness |
| Ownership missing | 361 | Missing information; do not assume freehold |
| Road width missing | 434 | Reduces parcel-specific explanatory power |
| Dimensions missing | 534 | Reduces parcel-specific explanatory power |
| Detail URL / seller type missing | 2 each | The two original Kalyan rows predate the field-mapping fix |
| Raw listing date missing | 0 | Date semantics, parsing, age, and staleness still need checking |
| Area units | 623 `Sq-ft`, 265 `sqft`, 1 `Acre` | Need a canonical area in square feet |
| Saved-record integrity | Every observation has corresponding raw evidence | Enables reproducible reprocessing |

### Questions the full audit must answer

1. Are total price and plot area numeric, correctly scaled, and expressed in compatible units? Does `price / area_sqft` agree with the advertised rate?
2. Are zero, placeholder, “call for price,” deposit, per-unit, or project starting prices being mistaken for a total plot price?
3. Do coordinates belong to the claimed locality and target region? Are many listings pinned to the same city centre?
4. Are listings actually vacant/buildable residential plots, rather than agricultural land, developed properties, or ambiguous large land parcels?
5. Are different listing IDs advertising the same physical parcel or the same development's generic inventory?
6. How recent are the observations and advertisements? Does a posted/updated date represent a new listing or a refresh?
7. Is sufficient independent evidence available in each locality and area band?
8. Are seller, project, and source effects inflating apparent sample size or rates?

Examples requiring review include the original 590,000-sq-ft, INR 180-crore Dombivli listing. Its arithmetic is consistent, but that does not make it comparable to a small individual plot. Flag unusual records for review; do not delete them solely because they are expensive or large.

### Step 1: Preserve the collection history

Keep raw HTML/JSON and original observations unchanged. Build derived, versioned datasets with a processing version and a link back to each source observation. Recover the original Kalyan fields from saved raw data through reprocessing rather than another live request.

### Step 2: Standardize values

Create canonical fields such as:

- `price_inr`, `area_sqft`, `asking_rate_inr_sqft`, and `source_rate_inr_sqft`.
- `listing_id`, `source`, `run_id`, `observed_at`, and parsed listing dates.
- `requested_market`, source locality/city, and independently resolved locality.
- Standardized ownership, transaction type, and seller category, retaining original values.

For confirmed area units: square yards multiply by 9; square metres by approximately 10.7639; acres by 43,560. Preserve the original unit. Unknown or ambiguous units must remain unresolved rather than silently treated as square feet.

Recompute the rate from verified total price and normalized area. Flag disagreements using a documented tolerance that accounts for rounding. Inspect gross disagreements manually before setting final rules.

### Step 3: Deduplicate properties and select observations

First group repeated source IDs. Then identify possible cross-ID and cross-source duplicates using available location, area, price, project, dimensions, text, and legitimate listing references. Fuzzy matches are candidates for review, not automatic proof of identity.

Assign a `property_group_id` where possible, with matching evidence and confidence. A project-level advertisement may not identify a unique parcel; mark it accordingly. Preserve history, but select or weight observations intentionally for model training so repeatedly advertised properties do not dominate.

### Step 4: Resolve geography

Validate existing coordinates against the intended region and locality. Geocode missing locations only when necessary, cache results, and retain provider, query, result granularity, and match quality.

Distinguish plot-level coordinates from project, locality, and city centroids. A locality centroid can support coarse location analysis but cannot justify precise parcel distances. Do not present an approximate geocode as an exact plot location.

### Step 5: Review land category and segment

Add explicit states such as `residential_supported`, `ambiguous`, and `out_of_scope`, together with evidence. Source labels and description keywords can help triage, but neither alone verifies legal buildability.

Keep individual resale plots, plotted-development inventory, and large development parcels identifiable. Where approval information is available, record its source and verification status; do not infer approval from the word “residential.”

### Step 6: Produce a report and review queue

Recommended outputs under the pipeline data directory:

| Proposed output | Purpose |
|---|---|
| `clean_observations.parquet` | Standardized observations with provenance |
| `property_groups.csv` | Duplicate candidates, group IDs, and matching evidence |
| `review_queue.csv` | Ambiguous land use, units, prices, coordinates, and unusual parcels |
| `model_snapshot.parquet` | A documented eligible modeling sample |
| `quality_audit.md` | Counts before/after every rule and coverage by locality |

These are proposed artifacts, not existing files. Different experiments may have different eligibility rules: a locality median does not need the same coordinate precision as a model using distance to a railway station.

**Decision after the audit:** identify exactly how many independent, correctly priced residential observations remain, and which locations have enough evidence for an experiment. There is no defensible universal row count that guarantees a useful AVM.

## 4. Should we collect data from other sites?

**Yes, where it adds independent coverage or better attributes. First establish the clean schema and measure the current gaps.** The next portal should be selected by a small pilot, not by its apparent listing count.

| Source | What it could contribute | What is actually established so far |
|---|---|---|
| MagicBricks | More coverage, corrected routes, later observations, richer details where available | Current normalized dataset exists; Thane and Shahad remain unresolved |
| 99acres / Housing.com / Square Yards | Potential additional residential plot listings | Earlier access attempts encountered refusals; no normalized dataset collected |
| NoBroker | Potential owner listings and additional locations | Earlier exploration found extraction/access-path limitations; no normalized dataset collected |
| MahaRERA | Potential project identification and supporting project attributes | Project-search evidence saved; usable plot-level pricing not established |
| Ready Reckoner / other benchmark data already available to the project | Separate comparison or contextual feature, if correctly matched | Must not be substituted for observed market transactions |

For each new source:

1. Choose one poorly covered market and a small pilot sample.
3. Map it into the same schema, preserving source-specific raw fields.
4. Run the same quality and property-deduplication checks.
5. Measure **new usable properties**, geographic coverage, field completeness, and collection effort.

Two portals advertising the same plot do not provide two independent sale observations. Cross-source collection can also expose different asking prices for the same property; retain and investigate that discrepancy.

### Initial target: advertised asking rate

With the present source data, the supervised target is an **advertised residential plot asking rate**, calculated from a verified total asking price and area. Do not call model accuracy on these labels accuracy against completed transaction values.

To support a claim about actual market value, obtain independently usable transaction evidence or an appropriately designed external appraisal/valuation benchmark. Do not invent a fixed negotiation discount from asking to sale price.

### Location-only input versus a specific plot

A location alone does not identify plot size, access, approval status, ownership, project amenities, or exact position. Even within one locality, these can change the rate materially.

The location-only interface should initially return a **typical rate for a clearly defined residential-plot segment**, the supporting area range, and the evidence date. Use a documented representative profile or a distribution of eligible comparables; do not silently feed invented parcel attributes into a model.

Offer optional plot area and other known attributes for a more specific estimate. A total-price estimate requires an area. If the evidence is insufficient, show “insufficient data” or an explicitly broader-area estimate rather than a precise-looking number.

### Start with a baseline

Build a transparent comparable-listing baseline using independent eligible observations: a recent locality median, or a suitably weighted nearby-comparable estimate where location precision permits it. Keep geographic distance, freshness, plot size, and segment assumptions inspectable.

This baseline establishes whether a more complicated model adds value. A city with one listing cannot support a trustworthy city-specific learned model just because a training library can fit it.

### Then test simple models

Use a small experiment sequence: regularized regression on log asking rate, followed by a tree-based gradient-boosting candidate. Avoid deep learning and large tuning searches at this stage. Select the model using validation results, not reputation.

Candidate inputs include normalized location, log plot area, ownership, resale/new transaction type, seller/project segment, road width with a known unit, facing, corner/boundary indicators, date, and later well-supported accessibility features. Represent missingness explicitly and fit transformations on training data only.

**Leakage checks:** when predicting `price / area`, do not supply the total price, advertised price-per-square-foot, or text containing the target price as model inputs. Locality price aggregates must be computed using training-fold observations only. Source and seller effects can be diagnostic without necessarily becoming production inputs.

### Validate on the task we intend to serve

- Keep all observations of a physical property group on one side of an evaluation split. Consider project-level grouping for generic project advertisements.
- Hold out geographic groups to test performance in locations the model has not seen. Report this separately from performance within well-covered locations.
- Once enough distinct collection dates exist, train on earlier evidence and evaluate later evidence. Repeated captures within one day do not establish temporal generalization.
- Keep a final test set untouched during model and feature selection. Fit imputers, encoders, and other learned preprocessing only within training folds.

Group-aware and time-aware splitting address different evaluation problems; neither automatically guarantees spatial separation or resolves all leakage. Implement combinations deliberately. See the official [scikit-learn cross-validation guide](https://scikit-learn.org/stable/modules/cross_validation.html) and [common pitfalls guide](https://scikit-learn.org/stable/common_pitfalls.html).

Report absolute error in INR/sq ft, median absolute percentage error for strictly positive targets, log-scale error, and results by location, area band, segment, and data quality. Compare every candidate with the baseline under identical splits. Do not rely on one pooled R-squared score.

### Build an evidence-based range

Separate the spread of observed comparable asking prices from a prediction interval for a modeled target. They answer different questions.

Quantile regression is one candidate for conditional prediction intervals. Assess interval coverage and width on held-out observations, including geographic and temporal slices. A nominal 80% interval should contain approximately 80% of relevant held-out outcomes; it is not a promise for every individual plot. The official [gradient-boosting prediction-interval example](https://scikit-learn.org/stable/auto_examples/ensemble/plot_gradient_boosting_quantile.html) demonstrates quantile prediction and coverage measurement.

For asking-price labels, the interval concerns asking prices. It does not become a sale-value interval through formatting. If evidence is sparse or outside the training distribution, broaden the scope explicitly or abstain.

## 7. From an experiment to the user-facing product

Proposed flow:

`Entered location -> resolve location -> choose supported segment/profile -> retrieve eligible comparables -> baseline/model estimate -> calibrated range and evidence -> response`

The response should show:

- Resolved locality and whether its location is approximate.
- Estimated INR/sq ft and whether it describes asking rates or a separately validated valuation target.
- Price range with its meaning explained.
- Evidence count based on independent properties, geographic scope, and observation dates.
- Assumed plot segment/area profile and optional inputs for refinement.
- A clear insufficient-data outcome when the estimate is unsupported.

Version the model, feature processing, and dataset snapshot together. Log which version and evidence produced an estimate. Monitor freshness, missing fields, source changes, duplicate rates, locality coverage, prediction errors when new labels arrive, and interval coverage.

Release criteria must be agreed before evaluating the final test results: acceptable error, geographic scope, interval coverage/width, and abstention behaviour. Do not launch Maharashtra-wide claims from an MMR-only sample.

## 8. Practical order of work

| Order | Task | Deliverable / decision |
|---|---|---|
| 1 | Full audit and raw-data reprocessing | Clean fields, review queue, independent-property counts, coverage map/table |
| 2 | Resolve duplicates, geography, units, and land segments | Versioned eligible snapshot with reasons for exclusions |
| 3 | Targeted source expansion | Small new-source pilot evaluated on incremental useful coverage |
| 4 | Baseline estimate | Honest reference performance and insufficient-data rules |
| 5 | Simple ML experiments | Group/geographic evaluation; temporal evaluation when feasible |
| 6 | Range calibration and independent validation | Evidence supporting the exact claim the product will make |
| 7 | Limited pilot | Only supported locations/segments, with monitoring and versioning |

The immediate next task is **the full audit of the existing saved dataset**. It can run offline and should precede another broad collection batch. Additional source pilots can follow the measured gaps; a small baseline experiment can then help determine where more data would improve estimates.

## 9. Existing files and evidence

All links below are relative to this document:

- [Collector](../services/estimatedparcelvalue/pipeline/magicbricks/magicbricks_residential_plot_crawler.py)
- [Sequential market runner](../services/estimatedparcelvalue/pipeline/magicbricks/collect_magicbricks_markets.py)
- [Basic audit script](../services/estimatedparcelvalue/pipeline/magicbricks/audit_magicbricks_data.py)
- [Collected observations](../services/estimatedparcelvalue/pipeline/magicbricks_mmr_data/records.jsonl)
- [Raw evidence directory](../services/estimatedparcelvalue/pipeline/magicbricks_mmr_data/raw/)
- [Crawl state](../services/estimatedparcelvalue/pipeline/magicbricks_mmr_data/crawl_state.json)
- [Crawl log](../services/estimatedparcelvalue/pipeline/magicbricks_mmr_data/crawl.log)
- [Coverage and basic quality report](../services/estimatedparcelvalue/pipeline/magicbricks_mmr_data/coverage_quality_20260920T115911Z.json)
- [City coverage CSV](../services/estimatedparcelvalue/pipeline/magicbricks_mmr_data/coverage_quality_20260920T115911Z.csv)
- [Earlier source investigation notes](../services/estimatedparcelvalue/pipeline/docs/SCRAPING_INVESTIGATION.md)

The earlier investigation notes contain conclusions that were superseded by later successful MagicBricks collection. Use the saved run evidence and dated reports above for the current collection status.
