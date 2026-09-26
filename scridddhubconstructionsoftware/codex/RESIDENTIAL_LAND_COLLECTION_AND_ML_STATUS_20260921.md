# Collection and first ML experiment — 21 September 2026

The current collection batch is closed with documented gaps. **The target-locality dataset is not complete.** MagicBricks is still the only source in the reviewed modeling snapshot; no second-source data was admitted. At the user's request to move forward, two fixed ML candidates have now been evaluated on that existing snapshot.

## What was changed

Since resuming the 21 September plan:

- Added `check_khadakpada_source.py` for bounded, evidence-preserving HTTP checks without redirects or automatic retries.
- Captured and reviewed the NoBroker Khadakpada pilot. Added `review_khadakpada_pilot.py`, four regression checks, source-qualified diagnostic observations, the review queue, duplicate screening, raw evidence hashes, scope and yield reports.
- Updated the next-steps plan to record progress and unresolved issues. Source records, the original clean audit and the 364-row reference benchmark were preserved.
- Added the pre-fit ML protocol, `run_land_ml_experiment.py`, five ML regression checks and pinned dependency files. Installed ML packages in the existing pipeline virtual environment.
- Trained/evaluated two candidates in five existing group-held-out folds, saving ten research fold models, predictions, metrics, fold membership and input/version hashes. No application endpoint or production model was changed.

## Which sites were collected?

| Source | Collected evidence | Current outcome / remaining work |
|---|---|---|
| MagicBricks | 889 observations, 574 distinct listing IDs across the original 36-market attempt; 364 reviewed benchmark records | Partial coverage. Thane page 2 failed with 404; Shahad route unresolved. No resolved eligible Khadakpada evidence. |
| NoBroker | Khadakpada search: three direct and seven nearby cards, plus three direct details | Diagnostic only; locality and parcel review outstanding; zero benchmark additions. |
| 99acres | HTTP diagnostic | HTTP 403; no listings captured. |
| Square Yards | Historical browser diagnostic | HTTP 403; no normalized listings captured. |
| Housing.com | One Kalyan diagnostic page, 20 September | HTTP 200 contained an Akamai challenge, not usable listings. Not reattempted today. |
| MahaRERA | Historical project-search evidence and detail diagnostics | No usable plot asking-price/area dataset. Registration/project information cannot substitute for prices. |

MagicBricks pages for Kamothe, Rasayani and Vasind returned zero direct results at the last check. This is not evidence that no land is for sale in those markets. The site's published market/page counts are not a complete market census.

Evidence: [consolidated source status](../services/estimatedparcelvalue/pipeline/residential_land_pilots/source_closeout_20260921/source_status.json), [NoBroker pilot](../services/estimatedparcelvalue/pipeline/residential_land_pilots/nobroker/20260921T063915Z/pilot_yield.md), and the earlier [market coverage roadmap](RESIDENTIAL_LAND_AVM_ROADMAP.md).

## ML work completed

Used the original 364 reviewed rows and 245 evidence groups. All models use the **same 66 scored listings**, representing 50 groups; all abstain on the other 298. Coverage remains **18.13%**. The folds and baseline predictions were checked against the frozen reference.

| Model | MAE, INR/sqft | Median absolute percentage error | Equal-group MAE, INR/sqft |
|---|---:|---:|---:|
| Comparable-listing baseline | 554.01 | 31.54% | 580.01 |
| Ridge, log asking rate | 958.62 | 49.57% | 961.04 |
| Histogram gradient boosting, log asking rate | 829.65 | 31.99% | 785.25 |

**Decision: keep the existing baseline as the reference. Neither ML candidate improved it on these measures.** No further parameter tuning was performed. These are development results on advertised asking rates, not transaction-value accuracy or evidence of production readiness.

Training inputs were plot area and selected source/plot categories. Total prices, advertised rates, descriptions, IDs, project names, ambiguous dates and approximate coordinates were excluded. Preprocessing was learned inside training folds, and each evidence group had equal total training weight.

Khadakpada still has insufficient supporting data. A trained algorithm cannot replace missing local observations. No calibrated interval, future-date validation or unseen-locality result is established.

- [Protocol written before fitting](RESIDENTIAL_LAND_ML_EXPERIMENT_20260921.md)
- [Comparison report and research artifacts](../services/estimatedparcelvalue/pipeline/ml_experiments/20260921T071447Z/comparison_report.md)
- [Machine-readable model metrics](../services/estimatedparcelvalue/pipeline/ml_experiments/20260921T071447Z/metrics.json)

## What remains to finish a usable dataset

1. Add independent plot evidence for Khadakpada/Kalyan and unsupported segments.
2. Resolve exact locality, land category, uncertain units/dimensions and related-advertisement identities. Keep project inventory and individual plots separate.
3. Obtain observations from genuinely later dates. The current same-period collection cannot demonstrate future-date accuracy.
4. Integrate usable additions in a new snapshot, review cross-source groups, and compare under common folds/cohorts. Revisit simple ML after measuring useful additions.

The collection cutoff means no open-ended retries against blocked sources; it does **not** mean the entire market has been scraped. No universal row-count target is asserted. Independent evidence per supported segment and actual held-out performance determine whether expansion helps.

## Verification

Thirteen ML/baseline tests passed (five new ML checks and eight existing baseline checks). The prior NoBroker review also passed four tests and reproduced its eleven outputs byte-for-byte. The ML run verified 167 original collection/audit/benchmark files unchanged. Fold models and predictions are for research only; there is no deployment.

From `services/estimatedparcelvalue/pipeline`:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-ml-lock.txt
.\.venv\Scripts\python.exe -B -m unittest test_land_ml_experiment test_review_land_baseline -v
.\.venv\Scripts\python.exe -B run_land_ml_experiment.py
```

The runner creates a new versioned experiment directory and refuses changed reference inputs. Re-running it is for reproduction, not collecting additional data or creating a new independent validation set.
