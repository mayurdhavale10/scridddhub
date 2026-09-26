# Residential land: reviewed evidence and first baseline

Completed 20 September 2026. This follows the collection audit and scraping pilots. No new scraping or production model deployment was performed in this step.

## Review results

- **Duplicate candidates:** seven groups, 15 distinct listing IDs, 24 observations. Reviewed descriptions, dimensions, project names and pins. None establishes unique physical-parcel identity; all remain excluded rather than merged. Two separate Vindhane groups share a pin and dimensions despite different prices, illustrating why price cannot define independent properties.
- **Rates:** ten flagged observations represent eight distinct listing IDs. Every one has a raw auto-description using Guntha alongside a structured square-foot area. Recomputed rates disagree with advertised rates. The source fields do not establish which is wrong; no automatic price or area correction was made.
- **Geography:** the Murud outlier has latitude 72.8679 and longitude 18.6555. Swapping produces a point within the broad target box, but exact locality remains unverified. The record stays excluded; no coordinate correction was applied.
- **Land-use flags:** reviewed 16 distinct listing IDs (19 observations). Two keyword hits were contextual, three descriptions explicitly conflict with vacant residential scope, and eleven remain ambiguous. “Non agricultural” is a negated keyword; “high commercial value” describes value rather than a land-use designation. These interpretations are not legal buildability verification.
- One contextual-keyword record was returned to the experimental sample. The other still lacks a usable locality. Existing audit outputs and raw observations remain unchanged; review decisions are applied in a separate layer.

Manual decisions are pinned to the SHA-256 of the audited clean observations. The script refuses to reuse those decisions against changed evidence without a fresh review.

## First comparable-listing baseline

Starting with the 392 provisional records, excluded 29 records whose source locality was missing or merely the city, then admitted one reviewed contextual-keyword record: **364 experimental records**.

Related listings are conservatively grouped using shared project names within a city and rounded coordinate pins. Grouping is transitive and includes excluded rows that could reveal connections. This produces **245 evidence groups**, not 245 proven independent physical parcels.

The baseline matches source locality, plot-size band and named-project versus individual/unknown segment. It takes a median rate per evidence group, then a median across groups. At least five groups are required; otherwise it returns insufficient data. This is an exploratory threshold, not a guarantee of accuracy.

All members of an evidence group stay together in five deterministic evaluation folds. Comparable rates are calculated only from the training fold. There is no silent fallback to a different locality. The reported P10–P90 spread describes comparable group medians, not a calibrated prediction interval.

| Evaluation measure | Result |
|---|---:|
| Experimental records | 364 |
| Evidence groups | 245 |
| Held-out records receiving an estimate | 66 |
| Held-out records with insufficient evidence | 298 |
| Evidence groups represented in scored records | 50 |
| Mean absolute error on scored records | INR 554.01/sq ft |
| Median absolute percentage error on scored records | 31.54% |
| Mean absolute error with equal group weight | INR 580.01/sq ft |

Only 18.1% of held-out records received an estimate. Error metrics apply to those records, not the entire dataset. Nine locality/area/segment combinations have five groups when using the full experimental sample; fewer retain sufficient support in every held-out fold.

**Interpretation:** a first reference experiment now exists, but accuracy and coverage do not support release. The labels are asking prices. Geographic resolution, physical-property identity, date semantics and legal land category remain uncertain. This experiment does not establish future-date, unseen-locality or transaction-value accuracy.

Khadakpada has no resolved eligible evidence. Its correct outcome remains insufficient data. Additional collection should target unsupported segments and independent evidence rather than repeated advertisements.

## Artifacts and reproducibility

- [Review and baseline implementation](../services/estimatedparcelvalue/pipeline/magicbricks/review_land_baseline.py)
- [Generated review report](../services/estimatedparcelvalue/pipeline/magicbricks_mmr_data/derived/review_baseline_20260920T171020225465Z/review_report.md)
- [Duplicate review](../services/estimatedparcelvalue/pipeline/magicbricks_mmr_data/derived/review_baseline_20260920T171020225465Z/duplicate_review.csv)
- [Rate review with raw evidence](../services/estimatedparcelvalue/pipeline/magicbricks_mmr_data/derived/review_baseline_20260920T171020225465Z/rate_review.csv)
- [Land-use review](../services/estimatedparcelvalue/pipeline/magicbricks_mmr_data/derived/review_baseline_20260920T171020225465Z/land_use_review.csv)
- [Geography review](../services/estimatedparcelvalue/pipeline/magicbricks_mmr_data/derived/review_baseline_20260920T171020225465Z/geography_review.csv)
- [Benchmark snapshot](../services/estimatedparcelvalue/pipeline/magicbricks_mmr_data/derived/review_baseline_20260920T171020225465Z/benchmark_snapshot.jsonl)
- [Held-out predictions](../services/estimatedparcelvalue/pipeline/magicbricks_mmr_data/derived/review_baseline_20260920T171020225465Z/heldout_predictions.csv)
- [Locality evaluation](../services/estimatedparcelvalue/pipeline/magicbricks_mmr_data/derived/review_baseline_20260920T171020225465Z/locality_evaluation.csv)
- [Collection priorities](../services/estimatedparcelvalue/pipeline/magicbricks_mmr_data/derived/review_baseline_20260920T171020225465Z/collection_priorities.csv)

From `services/estimatedparcelvalue/pipeline`:

```powershell
.\.venv\Scripts\python.exe -B -m unittest test_clean_land_data test_review_land_baseline -v
.\.venv\Scripts\python.exe -B review_land_baseline.py
```

Seventeen regression tests pass, including whole-group holdout, transitive grouping, equal group weighting, abstention, and preventing a manual keyword release from overriding another exclusion. Input hashes verify that source records and prior audit artifacts are unchanged.
