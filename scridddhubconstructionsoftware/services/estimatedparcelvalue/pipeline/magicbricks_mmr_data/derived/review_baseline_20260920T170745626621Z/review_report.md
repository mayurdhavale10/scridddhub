# Evidence review and first comparable-listing benchmark

This is an offline investigation, not a current land valuation service.

Reviewed 8 distinct rate-disagreement IDs (10 observations) and 7 duplicate candidate groups.
Raw fields conflict or lack unique parcel identifiers. All ambiguous cases remain excluded; no source values were silently corrected.
One geographic outlier has a plausible reversed coordinate pair. Swapping was not applied without independent location evidence.

## Baseline rules

- Canonicalize case/whitespace and remove an exact trailing source-city suffix. No fuzzy locality merges; city-only labels excluded.
- Match source locality, area band (up to 1,500 / 1,500-3,000 / 3,000-10,000 sqft), and named-project versus individual/unknown segment.
- Cluster shared project names within source city and pins rounded to four decimals, transitively, across all source IDs including excluded rows.
- One median asking rate per evidence cluster, then the median across clusters. Cluster grouping does not prove physical identity.
- Require five supporting clusters; otherwise abstain. This is a fixed experiment threshold, not a release criterion.
- Five deterministic group-held-out folds. Compute all comparable medians from the training fold only. Target price is never a matching input.
- P10/P90 is the spread of comparable cluster medians, not a calibrated prediction interval.
- Unknown duplicates and approximate pins remain possible; no temporal or unseen-locality performance claim is made.
- Listing rows with missing coordinates remain allowed for source-locality experiments; no parcel distances are calculated.

## Results

Original provisional rows: 392; benchmark rows: 363.
Evidence clusters: 244; supported locality/area/segment combinations: 9.

```json
{
  "total": 363,
  "scored": 66,
  "abstained": 297,
  "scored_evidence_clusters": 50,
  "mae_inr_sqft": 554.0091386882498,
  "median_absolute_percentage_error": 31.54174847906519,
  "cluster_balanced_mae": 580.0134113238672
}
```

Pooled metrics describe only non-abstained observations; consult locality_evaluation.csv and abstention counts. No accuracy threshold was selected or passed for release.

## Next work

Review source conflicts with independent parcel evidence; target additional collection to unsupported locality/area segments. Kalyan/Khadakpada must not inherit a nearby locality estimate silently.
Before production, verify locality/land-use definitions, build stronger property groups, obtain later observations and agree performance/release criteria.
