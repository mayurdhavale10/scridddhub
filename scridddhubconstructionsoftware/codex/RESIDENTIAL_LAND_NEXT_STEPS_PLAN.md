# Residential land AVM: next implementation plan

Created: 21 September 2026.
Status: current collection batch closed with gaps, 21 September 2026. No second-source observations admitted. At the user's subsequent request to move forward with ML, a first offline candidate comparison on the existing 364-row snapshot is complete; neither candidate beat the reference baseline. The original checklist below remains the acceptance criteria, not a blanket completion claim.

Latest: [collection status, code changes, ML results and remaining work](RESIDENTIAL_LAND_COLLECTION_AND_ML_STATUS_20260921.md). The exploratory ML comparison proceeded without claiming the improved-evidence milestone below had succeeded. Target-locality coverage and production validation remain unresolved.

## 21 September execution update

Deliverables: [pilot scope](../services/estimatedparcelvalue/pipeline/residential_land_pilots/nobroker/20260921T063915Z/pilot_scope.md), [source checks](../services/estimatedparcelvalue/pipeline/residential_land_pilots/nobroker/20260921T063915Z/source_checks.json), and [yield/review outcome](../services/estimatedparcelvalue/pipeline/residential_land_pilots/nobroker/20260921T063915Z/pilot_yield.md).

## Objective

Add usable, independently supported residential-plot evidence for **Khadakpada/Kalyan**, then measure whether the existing comparable-listing baseline gains coverage and accuracy. Start with one locality and a small additional-source pilot before expanding collection or trying more complex ML.

The initial target remains **advertised asking rate in INR/sq ft**, not verified transaction value. Khadakpada must return insufficient data until its evidence supports an experiment.

## Verified starting point

| Measure | Current result |
|---|---:|
| Original MagicBricks observations | 889 |
| Distinct MagicBricks listing IDs | 574 |
| Original provisional audit snapshot | 392 records |
| Reviewed baseline sample | 364 records |
| Baseline evidence groups | 245 |
| Held-out listings receiving an estimate | 66 |
| Held-out listings receiving insufficient data | 298 |
| Median absolute percentage error on the 66 scored listings | 31.54% |

Evidence groups are not verified physical parcels. Original records and raw evidence remain unchanged. The first baseline and review exist; this plan continues from them rather than rebuilding them.

Last observed collection limitations, from 20 September:

- Thane's published page-2 link returned HTTP 404.
- No working Shahad residential route was established.
- Kamothe, Rasayani and Vasind returned valid pages with zero direct listings.
- MagicBricks Kalyan returned two listings, without resolved Khadakpada coverage.
- Housing.com's Kalyan pilot returned a hidden Akamai challenge and no usable listings. The pilot stopped.

These are dated observations, not claims about today's accessibility.

## Phase 1: define locality and pilot source

- [x] Document the target locality, spelling variants and geographic evidence used to distinguish Khadakpada from broader Kalyan and nearby recommendations. Boundary verification remains unresolved and is recorded explicitly in the scope.
- [x] Keep `requested_market`, source locality and independently resolved locality separate. Record uncertain matches instead of assigning them to Khadakpada.
- [x] Inspect the existing source-investigation notes before choosing a portal. Candidates include NoBroker, Square Yards and 99acres; none is assumed accessible or usable.

**Deliverable:** `pilot_scope.md` and `source_checks.json`, identifying the exact locality, chosen source and stop conditions.

## Phase 2: collect a small source pilot

- [x] Retain raw evidence, source URL, listing ID, observation timestamp, run ID and outcome for every attempted page.
- [x] Keep direct locality results separate from nearby recommendations, ads and generic project inventory.
- [ ] Extract price, area and explicit unit, dates, locality, coordinates, property category, ownership, transaction/seller type and project details where available. Keep missing values explicit.

**Deliverable:** a timestamped pilot directory containing raw pages and `pilot_report.json`, including failures and unattempted work. Build a larger source adapter only if the sample contains usable listing evidence.

## Phase 3: normalize, review and measure useful additions

- [ ] Map source records into a common observation schema while preserving original field values and evidence references. Use `(source, listing_id)` as the source identity; listing IDs from different portals must not collide.
- [ ] Normalize supported area units, verify price meaning and recompute asking rate. Quarantine unit/price conflicts rather than guessing corrections.
- [ ] Validate locality evidence and coordinate granularity. A city or project centroid cannot support parcel-distance features.
- [ ] Separate individual/unknown plots, named projects, generic inventory and large development parcels. Review land-use evidence without treating a portal label as legal approval.
- [ ] Compare new records against the existing dataset using location, area, dimensions, project, descriptions and legitimate listing references. Price differences must not automatically establish distinct properties.
- [ ] Preserve uncertain cross-source matches as review candidates. Keep related advertisements together for evaluation even when parcel identity remains uncertain.

**Deliverable:** clean pilot observations, a review queue, duplicate candidates and `pilot_yield.md`. Clearly distinguish usable new observations from proven new physical properties.

**Expansion decision:** expand only if the pilot adds relevant evidence or improves important missing attributes at reasonable collection effort. A blocked source or a pilot yielding only duplicates is a valid stop outcome; move to a documented alternative rather than repeating the same attempt.

## Phase 4: integrate a versioned multi-source snapshot

- [ ] Keep the original MagicBricks collection unchanged. Store source-specific pilot observations separately and combine them in a derived layer.
- [ ] Adapt the MagicBricks-specific raw-evidence reader in `build_clean_land_data.py` through explicit source adapters before processing another portal's schema.
- [ ] Review changed evidence before reusing manual decisions in `review_land_baseline.py`. Its current decisions are pinned to an audit hash; do not remove that guard to accept new data blindly.
- [ ] Preserve source-qualified identities, evidence groups, inclusion/exclusion reasons, processing versions and input hashes in the new snapshot.
- [ ] Add regression checks for source-ID collisions, unit conversion, cross-source duplicates, locality assignment and raw-data preservation.

**Deliverable:** a reproducible combined snapshot with a clear count of what changed from the 364-record experiment.

## Phase 5: rerun the baseline and compare fairly

- [ ] Freeze the existing benchmark artifacts as the reference result.
- [ ] Retain the baseline definition initially: source locality, area band, plot segment, equal evidence-group weighting and insufficient-data behavior.
- [ ] Keep related properties/projects on one side of evaluation splits. Audit cross-source matches before creating folds.
- [ ] Preserve test membership for a common comparison cohort where possible. If new links between groups force regrouping, rerun both old and expanded datasets under the same revised split and report the change; cluster hashes alone do not guarantee stable folds.
- [ ] Report scored and abstained counts, MAE in INR/sq ft, median absolute percentage error, and group-balanced error by locality/area/segment.
- [ ] Report results on new observations separately. A changed evaluation population must not be described as a direct accuracy improvement.
- [ ] Keep comparable-price spread distinct from a calibrated prediction interval. Retain insufficient data for Khadakpada if support remains inadequate.

**Deliverable:** `baseline_comparison.md`, held-out predictions, locality coverage and a clear expand/review/stop decision.

The current five-group minimum is an exploratory rule, not a universal sample-size target or a production acceptance threshold. Agree release criteria before selecting a production model or inspecting a final test set.

## Phase 6: later collection and model decisions

- [ ] After a source pilot succeeds, select markets and a refresh cadence based on useful yield and source limits; record the choice before installing a recurring schedule.
- [ ] Collect observations on genuinely later dates and retain advertisement history, including uncertainty about inactive listings.
- [ ] Attempt temporal evaluation only when enough later evidence exists. Same-day recaptures do not establish temporal generalization.
- [ ] Test simple ML candidates only after improved evidence and a meaningful baseline comparison justify them.
- [ ] Keep transaction-value claims and deployment out of scope until independently validated.

## Completion criteria for the next work package

This package is complete when one targeted source pilot has a documented outcome, all retrieved evidence has been reviewed, and the incremental yield is measured. If usable observations are obtained, also complete the versioned integration and baseline comparison. If access fails or no usable evidence is obtained, record the blocker and next source option without claiming that coverage improved.

The immediate first task is **Phase 1: define the Khadakpada locality scope and select one accessible additional-source pilot**.

## Existing context

- [Original AVM roadmap](RESIDENTIAL_LAND_AVM_ROADMAP.md)
- [Scraping audit and pilot status](RESIDENTIAL_LAND_SCRAPING_STATUS_20260920.md)
- [Reviewed baseline results and artifacts](RESIDENTIAL_LAND_BASELINE_REVIEW_20260920.md)
- [Earlier source investigation notes](../services/estimatedparcelvalue/pipeline/docs/SCRAPING_INVESTIGATION.md)
- [Current collection priorities](../services/estimatedparcelvalue/pipeline/magicbricks_mmr_data/derived/review_baseline_20260920T171020225465Z/collection_priorities.csv)

Suggested pilot output root: `services/estimatedparcelvalue/pipeline/residential_land_pilots/<source>/<run_id>/`. This is a proposed location; no new pilot has been run by creating this plan.
