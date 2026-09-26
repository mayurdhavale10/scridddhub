# First ML development comparison

Frozen 364-row, 245-evidence-group MagicBricks snapshot. No new-source additions.

Same five reference folds and same 66 scored listings for every model; 298 abstentions each.
Scored records represent 50 evidence groups. Coverage remains 18.13%.

| Model | Scored | Abstained | MAE INR/sqft | Median APE | Equal-group MAE |
|---|---:|---:|---:|---:|---:|
| comparable_baseline | 66 | 298 | 554.01 | 31.54% | 580.01 |
| ridge_log_rate | 66 | 298 | 958.62 | 49.57% | 961.04 |
| hist_gradient_boosting_log_rate | 66 | 298 | 829.65 | 31.99% | 785.25 |

These are asking-rate errors on a development cohort, not sale-value accuracy or a final test.
No parameter search was run. See protocol.md and experiment_config.json for choices made before fitting.

## Interpretation and decision

Compare all three error measures before preferring a candidate. A better median percentage error can coexist with worse rupee errors.
Neither model increases evidence coverage: both retain the baseline support gate. No production model is selected or deployed.
Khadakpada has no eligible resolved supporting data and remains insufficient data.
No temporal validation, calibrated interval, or unseen-locality claim is supported.

Training uses only allowlisted attributes. Scaling and categorical encoding are fit inside each training fold; whole evidence groups stay together.
Training weights give every group total weight one. Approximate pins, target prices, descriptions, source rates and identities are excluded from features.

## Artifacts

heldout_predictions.csv, locality_evaluation.csv, fold_membership.json, input_snapshot.jsonl, metrics.json, experiment_config.json and models/.
Saved fold estimators return asking rates, but callers must enforce the recorded evidence gate; these are research artifacts, not a serving interface.
SHA-256 checks confirm 167 original data/reference files unchanged.
