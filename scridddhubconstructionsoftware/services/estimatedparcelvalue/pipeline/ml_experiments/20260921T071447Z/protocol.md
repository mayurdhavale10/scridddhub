# First ML comparison protocol — 21 September 2026

Written before fitting the candidates or inspecting their scores. This is a small offline development experiment following the user's request to move collection forward into ML. It does not assert that the earlier additional-evidence milestone succeeded: no second-source observations passed into modeling. Market collection remains incomplete; this batch has a documented cutoff.

## Frozen inputs and comparison

Use only `review_baseline_20260920T171020225465Z/benchmark_snapshot.jsonl`: 364 reviewed MagicBricks listing observations, 245 existing evidence groups. Expected SHA-256: `250762e9678af0e6478a568743e17e8ee06fe089d3fa5009d3d8802831767b86`.

Reuse every recorded group/fold assignment exactly. Check predictions from the unchanged comparable baseline against its original held-out CSV. Do not rerun manual decisions on new evidence. No NoBroker data, scraped search snippets, synthetic prices, government floor values or partner data enter training.

This benchmark was already examined during baseline development. It is a development comparison, **not an untouched final test**. Do not tune candidates against these results or call the better score a release decision. Temporal, unseen-locality and transaction-value generalization are not tested.

## Target and features

Target: natural logarithm of positive advertised asking rate in INR/sqft; transform predictions back with exp. Features: log plot area, source city, existing locality key, reviewed segment, ownership, transaction type and seller type. Use explicit missing category values. Fit numerical scaling and categorical encoding on the training fold only; unknown test categories are ignored by the encoder.

Exclude total/advertised price, source rate, descriptions, listing IDs, project names, evidence-group IDs, dates with unresolved semantics and approximate coordinates. These are either leakage risks, identities or unsupported feature precision. No geocoded parcel distances.

## Fixed candidates, no parameter search

1. Ridge regression: alpha 10, intercept, deterministic SVD solver, log-rate target.
2. Histogram gradient boosting: squared error on log rate, learning rate 0.05, 100 iterations, maximum 7 leaves, minimum 10 rows per leaf, L2 1, random seed 42, early stopping disabled. No internal random validation split that could separate related advertisements.

Both use the same train-only preprocessing. Within each training fold, each evidence group has total weight one, divided equally among its rows. This does not make evidence groups proven physical parcels. Limit numerical thread pools to one for reproducibility on this small sample.

Retain the baseline support gate for every model: at least five training evidence groups matching locality, area band and segment, otherwise insufficient data. Compare the same scored cohort and abstained cohort. A learned model's ability to produce a number does not establish local support.

## Outputs and decision

Write input hashes, exact package versions, fixed parameters, train/test membership, out-of-fold predictions, model metrics, metrics by locality/area/segment, and a readable report. Fit/fold artifacts are research artifacts; no serving endpoint, full-data production fit, release threshold or prediction interval is introduced.

Report MAE in INR/sqft, median absolute percentage error, and equal-group MAE, with scored and abstained counts. Mixed metric changes are a tradeoff, not an unqualified improvement. Khadakpada must remain insufficient data.

Implementation references: [Ridge](https://scikit-learn.org/1.7/modules/generated/sklearn.linear_model.Ridge.html), [histogram gradient boosting](https://scikit-learn.org/1.7/modules/generated/sklearn.ensemble.HistGradientBoostingRegressor.html), and [leakage prevention](https://scikit-learn.org/1.7/common_pitfalls.html). The installed environment is recorded with each run.
