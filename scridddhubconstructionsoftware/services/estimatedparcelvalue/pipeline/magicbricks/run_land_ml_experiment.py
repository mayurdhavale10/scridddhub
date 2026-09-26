"""Frozen, grouped development comparison; no crawling or production model release."""
import argparse
import csv
import hashlib
import importlib.metadata
import json
import math
import platform
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
from sklearn.compose import ColumnTransformer, TransformedTargetRegressor
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from threadpoolctl import threadpool_limits

from build_clean_land_data import write_csv
from review_land_baseline import estimate, metrics, MIN_GROUPS

ROOT = Path(__file__).resolve().parent.parent
REFERENCE = ROOT / "magicbricks_mmr_data/derived/review_baseline_20260920T171020225465Z"
SNAPSHOT_HASH = "250762e9678af0e6478a568743e17e8ee06fe089d3fa5009d3d8802831767b86"
PREDICTIONS_HASH = "22392e9bda14e80b3161d592afa49307426459e86d7f89e3db1f3b1db41f27da"
CATEGORICAL = ("city", "locality_key", "benchmark_segment", "ownership", "transaction_type", "seller_type")
MODEL_PARAMS = {
    "ridge_log_rate": dict(alpha=10.0, fit_intercept=True, solver="svd"),
    "hist_gradient_boosting_log_rate": dict(loss="squared_error", learning_rate=.05,
        max_iter=100, max_leaf_nodes=7, min_samples_leaf=10, l2_regularization=1.0,
        early_stopping=False, random_state=42, categorical_features=None),
}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def features(rows):
    """Explicit allowlist: prices, descriptions, IDs and coordinates never enter X."""
    return np.asarray([[math.log(r["area_sqft"])] +
        [str(r.get(k) or "__missing__").strip().casefold() for k in CATEGORICAL]
        for r in rows], dtype=object)


def group_weights(rows):
    counts = Counter(r["evidence_cluster_id"] for r in rows)
    return np.asarray([1.0/counts[r["evidence_cluster_id"]] for r in rows])


def split_rows(rows, fold):
    training = [r for r in rows if r["fold"] != fold]
    testing = [r for r in rows if r["fold"] == fold]
    a = {r["evidence_cluster_id"] for r in training}
    b = {r["evidence_cluster_id"] for r in testing}
    if a & b:
        raise ValueError("An evidence group crosses training and test folds")
    if not training or not testing:
        raise ValueError("Empty training or test fold")
    return training, testing


def make_model(name):
    transform = ColumnTransformer([
        ("numeric", StandardScaler(), [0]),
        ("categorical", OneHotEncoder(handle_unknown="ignore", sparse_output=False), list(range(1, 7))),
    ], sparse_threshold=0)
    regressor = Ridge(**MODEL_PARAMS[name]) if name == "ridge_log_rate" else HistGradientBoostingRegressor(**MODEL_PARAMS[name])
    pipeline = Pipeline([("features", transform), ("model", regressor)])
    return TransformedTargetRegressor(regressor=pipeline, func=np.log, inverse_func=np.exp,
                                     check_inverse=True)


def prediction(row, model, value, support):
    actual = row["asking_rate_inr_sqft"]
    if support["supporting_evidence_clusters"] < MIN_GROUPS:
        value = None
    if value is not None and (not math.isfinite(value) or value <= 0):
        raise ValueError("Invalid candidate prediction")
    return dict(model=model, source=row["source"], listing_id=row["listing_id"],
        evidence_cluster_id=row["evidence_cluster_id"], fold=row["fold"],
        locality_key=row["locality_key"], area_band=row["area_band"],
        benchmark_segment=row["benchmark_segment"], actual=actual, estimate=value,
        status="insufficient_data" if value is None else "experimental",
        supporting_evidence_clusters=support["supporting_evidence_clusters"],
        supporting_listing_ids=support["supporting_listing_ids"],
        absolute_error=abs(value-actual) if value is not None else None,
        absolute_percentage_error=100*abs(value-actual)/actual if value is not None else None)


def load_snapshot():
    snapshot, reference_predictions = REFERENCE / "benchmark_snapshot.jsonl", REFERENCE / "heldout_predictions.csv"
    if sha(snapshot) != SNAPSHOT_HASH or sha(reference_predictions) != PREDICTIONS_HASH:
        raise ValueError("Changed benchmark requires a new reviewed experiment protocol")
    rows = [json.loads(line) for line in snapshot.read_text(encoding="utf-8").splitlines()]
    if len(rows) != 364 or len({r["evidence_cluster_id"] for r in rows}) != 245:
        raise ValueError("Unexpected benchmark population")
    if len({(r["source"], r["listing_id"]) for r in rows}) != len(rows):
        raise ValueError("Repeated source identity in benchmark")
    for row in rows:
        if row["fold"] not in range(5) or row["source"] != "magicbricks":
            raise ValueError("Unexpected source or fold")
        for field in ("area_sqft", "asking_rate_inr_sqft"):
            if not math.isfinite(row[field]) or row[field] <= 0:
                raise ValueError(f"Invalid {field}")
    for fold in range(5):
        split_rows(rows, fold)
    with reference_predictions.open(encoding="utf-8-sig", newline="") as stream:
        previous = {r["listing_id"]: r for r in csv.DictReader(stream)}
    if set(previous) != {r["listing_id"] for r in rows}:
        raise ValueError("Reference prediction membership differs")
    return rows, previous


def run(output):
    rows, previous = load_snapshot()
    protected_paths = [ROOT / "magicbricks_mmr_data/records.jsonl"]
    protected_paths += [p for p in (ROOT / "magicbricks_mmr_data/raw").rglob("*") if p.is_file()]
    protected_paths += [p for p in (ROOT / "magicbricks_mmr_data/derived").rglob("*") if p.is_file()]
    protected = {str(p.relative_to(ROOT)): sha(p) for p in protected_paths}
    output.mkdir(parents=True, exist_ok=False)
    (output / "models").mkdir()
    protocol = ROOT.parents[2] / "codex/RESIDENTIAL_LAND_ML_EXPERIMENT_20260921.md"
    # Persist the fixed design before any fit or score is computed.
    config = dict(version="1.0.0", started_at=datetime.now(timezone.utc).isoformat(),
        snapshot_sha256=SNAPSHOT_HASH, reference_predictions_sha256=PREDICTIONS_HASH,
        script_sha256=sha(Path(__file__)), protocol_sha256=sha(protocol),
        dataset_rows=len(rows), evidence_groups=245, folds="frozen_reference_membership",
        numeric_features=["log_area_sqft"], categorical_features=CATEGORICAL,
        target="log_advertised_asking_rate_inr_sqft", inverse_target="exp",
        weighting="total training weight one per evidence group",
        support_gate=dict(minimum_groups=MIN_GROUPS, matching=["locality_key", "area_band", "benchmark_segment"]),
        parameters=MODEL_PARAMS, tuning_performed=False, final_test=False,
        python=platform.python_version(), packages={name:importlib.metadata.version(name)
            for name in ("numpy", "scipy", "scikit-learn", "joblib", "threadpoolctl")})
    (output / "experiment_config.json").write_text(json.dumps(config, indent=2), encoding="utf-8")
    (output / "input_snapshot.jsonl").write_bytes((REFERENCE / "benchmark_snapshot.jsonl").read_bytes())
    (output / "protocol.md").write_bytes(protocol.read_bytes())
    all_predictions, folds = [], []
    with threadpool_limits(limits=1):
        for fold in range(5):
            train, test = split_rows(rows, fold)
            support = [estimate(train, target) for target in test]
            for row, result in zip(test, support):
                old = previous[row["listing_id"]]
                expected = float(old["estimate"]) if old["estimate"] else None
                if int(old["fold"]) != fold or old["status"] != result["status"] or expected != result["estimate"]:
                    raise ValueError("Recomputed baseline differs from frozen reference")
                all_predictions.append(prediction(row, "comparable_baseline", result["estimate"], result))
            folds.append(dict(fold=fold,
                training_source_ids=[[r["source"],r["listing_id"]] for r in train],
                testing_source_ids=[[r["source"],r["listing_id"]] for r in test],
                training_groups=sorted({r["evidence_cluster_id"] for r in train}),
                testing_groups=sorted({r["evidence_cluster_id"] for r in test})))
            for name in MODEL_PARAMS:
                model = make_model(name)
                model.fit(features(train), [r["asking_rate_inr_sqft"] for r in train],
                          model__sample_weight=group_weights(train))
                indexes = [i for i, s in enumerate(support) if s["estimate"] is not None]
                values = model.predict(features([test[i] for i in indexes])) if indexes else []
                predicted = dict(zip(indexes, map(float, values)))
                for index, (row, result) in enumerate(zip(test, support)):
                    all_predictions.append(prediction(row, name, predicted.get(index), result))
                joblib.dump(dict(estimator=model, input_feature_order=["log_area_sqft", *CATEGORICAL],
                    target_units="INR/sqft asking rate", fold=fold, required_support_gate=config["support_gate"],
                    usage="development fold model; no production release"), output / "models" / f"{name}_fold{fold}.joblib")
            print(f"Completed fold {fold + 1}/5", flush=True)
    summaries = {name:metrics([p for p in all_predictions if p["model"] == name])
                 for name in ("comparable_baseline", *MODEL_PARAMS)}
    cohorts = [{p["listing_id"] for p in all_predictions if p["model"] == name and p["estimate"] is not None}
               for name in summaries]
    if not all(cohort == cohorts[0] for cohort in cohorts) or len(cohorts[0]) != 66:
        raise ValueError("Scored populations differ from the reference cohort")
    write_csv(output / "heldout_predictions.csv", all_predictions, list(all_predictions[0]))
    (output / "fold_membership.json").write_text(json.dumps(folds, indent=2), encoding="utf-8")
    slices = defaultdict(list)
    for p in all_predictions:
        slices[(p["model"],p["locality_key"],p["area_band"],p["benchmark_segment"])].append(p)
    evaluations = [dict(model=k[0],locality_key=k[1],area_band=k[2],benchmark_segment=k[3],**metrics(v))
                   for k,v in sorted(slices.items())]
    write_csv(output / "locality_evaluation.csv", evaluations, list(evaluations[0]))
    (output / "metrics.json").write_text(json.dumps(summaries, indent=2), encoding="utf-8")
    if not all(sha(ROOT / path) == value for path,value in protected.items()):
        raise ValueError("Original data/reference changed during experiment")
    (output / "preservation_manifest.json").write_text(json.dumps(protected, indent=2), encoding="utf-8")
    table = ["| Model | Scored | Abstained | MAE INR/sqft | Median APE | Equal-group MAE |",
             "|---|---:|---:|---:|---:|---:|"]
    for name,m in summaries.items():
        table.append(f"| {name} | {m['scored']} | {m['abstained']} | {m['mae_inr_sqft']:.2f} | {m['median_absolute_percentage_error']:.2f}% | {m['cluster_balanced_mae']:.2f} |")
    report = "\n".join(["# First ML development comparison", "",
        "Frozen 364-row, 245-evidence-group MagicBricks snapshot. No new-source additions.", "",
        "Same five reference folds and same 66 scored listings for every model; 298 abstentions each.",
        "Scored records represent 50 evidence groups. Coverage remains 18.13%.", "", *table, "",
        "These are asking-rate errors on a development cohort, not sale-value accuracy or a final test.",
        "No parameter search was run. See protocol.md and experiment_config.json for choices made before fitting.", "",
        "## Interpretation and decision", "",
        "Compare all three error measures before preferring a candidate. A better median percentage error can coexist with worse rupee errors.",
        "Neither model increases evidence coverage: both retain the baseline support gate. No production model is selected or deployed.",
        "Khadakpada has no eligible resolved supporting data and remains insufficient data.",
        "No temporal validation, calibrated interval, or unseen-locality claim is supported.", "",
        "Training uses only allowlisted attributes. Scaling and categorical encoding are fit inside each training fold; whole evidence groups stay together.",
        "Training weights give every group total weight one. Approximate pins, target prices, descriptions, source rates and identities are excluded from features.", "",
        "## Artifacts", "",
        "heldout_predictions.csv, locality_evaluation.csv, fold_membership.json, input_snapshot.jsonl, metrics.json, experiment_config.json and models/.",
        "Saved fold estimators return asking rates, but callers must enforce the recorded evidence gate; these are research artifacts, not a serving interface.",
        f"SHA-256 checks confirm {len(protected)} original data/reference files unchanged.", "",
        "Next: independently supported target-locality observations from a usable source/authorized export, clearer parcel grouping and later-date evidence.", ""])
    (output / "comparison_report.md").write_text(report, encoding="utf-8")
    print(json.dumps(summaries, indent=2))
    print(f"Report: {output / 'comparison_report.md'}")
    return summaries


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    output = args.output or ROOT / "ml_experiments" / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    run(output)


if __name__ == "__main__":
    main()
