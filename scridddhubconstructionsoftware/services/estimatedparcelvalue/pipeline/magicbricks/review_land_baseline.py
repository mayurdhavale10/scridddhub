"""Evidence review and offline, group-held-out comparable-listing benchmark.

No live valuation endpoint. No automatic corrections to ambiguous source fields.
"""
import argparse
import csv
import hashlib
import json
import re
import statistics
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

from build_clean_land_data import DEFAULT_DATA, digest, text, write_csv, write_jsonl

VERSION = "1.1.0"
DEFAULT_AUDIT = DEFAULT_DATA / "derived" / "audit_20260920T163501642878Z"
REVIEWED_INPUT_SHA256 = "c2ea923611cab1f0a175ef54c305d21e4612ab8e8214e2f32285aa748017b0ed"
MIN_GROUPS = 5  # Experiment design choice, not proof of valuation reliability.

DUPLICATE_REVIEW = {
    "candidate_b452937c37c0d5b39cc8": "Vile Parle pair: same price, area and pin; generic descriptions differ. No unique parcel reference proves identity.",
    "candidate_a752e2dde04995de93f6": "Jui pair: same price, area, dimensions and near-identical pin. Descriptions show 50 X 100 while structured dimensions show 150 X 300; parcel identity and dimensions unresolved.",
    "candidate_00efa2b560f31755da2a": "Three Wadhwa Wise City listings share project pin, area and price; dimensions differ or are missing. Shared project inventory is not proof of one parcel.",
    "candidate_56b8571f63f3b1e7398a": "Uran pair: same dimensions, area, price, road width and nearly identical pin; generated text is similar. Repeated advertising or generic inventory remains possible.",
    "candidate_e16e9b127e21ba355f4c": "Vindhane pair at 450 INR/sqft: same dimensions, pin and repeated marketing text; may advertise generic inventory. No unique parcel reference.",
    "candidate_47ac89abefde1f068d84": "Vindhane pair at 700 INR/sqft shares dimensions and pin with the 450 INR/sqft group. One description mentions 4.5 lakh despite a 7 lakh headline; group by shared evidence for leakage control, not proven identity.",
    "candidate_e2ff059b5f877a12a5f8": "Chirle/Uran Park pair: identical project pin, price, area and dimensions; one description uses square yards. Could be generic inventory or repeated advertising; identity unresolved.",
}


# Evidence decisions for the reviewed snapshot; not verification of title or zoning.
LAND_REVIEW = {
    "uk3W2bLIttdzpSvf+uAgZw==": ("context_only", "The phrase is 'Non agricultural', with bungalow use claimed. The agricultural keyword is negated; exact location still unresolved."),
    "kVjGs8gWy5RzpSvf+uAgZw==": ("context_only", "'High commercial value' describes value/location, not an explicit commercial land-use designation."),
    "VkQxLJnwh/RzpSvf+uAgZw==": ("source_text_out_of_scope", "Description explicitly calls the property agricultural land."),
    "4rvs5pYtSOBzpSvf+uAgZw==": ("source_text_out_of_scope", "Description states it is currently in an industrial zone and only proposes conversion."),
    "tBmHYP5hQAY=": ("source_text_out_of_scope", "Description states an existing ground-plus-three-floor building; not supported as vacant land."),
}


def reviewed_eligible(row):
    if row["provisional_eligible"]:
        return True
    decision = LAND_REVIEW.get(row["listing_id"], (None,))[0]
    return decision == "context_only" and set(row["flags"]).issubset(
        {"land_use_keyword_review", "invalid_coordinates", "shared_coordinate_pin"})


def canonical(value):
    return re.sub(r"\s+", " ", text(value).casefold()).strip(" ,")


def locality_key(row):
    city = canonical(row.get("city"))
    locality = canonical(row.get("source_locality"))
    if city and locality.endswith(", " + city):
        locality = locality[:-(len(city) + 2)].strip()
    if not locality or locality == city:
        return None
    return city + " | " + locality


def area_band(area):
    if area <= 1500:
        return "0-1500 sqft"
    if area <= 3000:
        return "1500-3000 sqft"
    return "3000-10000 sqft"


def cluster_rows(rows):
    """Conservative connected groups using project or rounded pin, never target price.

    A shared centroid can overgroup different parcels; that reduces available evidence
    rather than allowing apparently independent rows into both train and test.
    """
    parents = list(range(len(rows)))

    def find(i):
        while parents[i] != i:
            parents[i] = parents[parents[i]]
            i = parents[i]
        return i

    signatures = {}
    for i, row in enumerate(rows):
        keys = [("source_group", row["property_group_id"])]
        project = canonical(row.get("project_name"))
        if project:
            keys.append(("project", canonical(row.get("city")), project))
        if row.get("coordinate_status") == "within_broad_target_box_unverified":
            keys.append(("pin", round(float(row["latitude"]), 4), round(float(row["longitude"]), 4)))
        for key in keys:
            if key in signatures:
                parents[find(i)] = find(signatures[key])
            else:
                signatures[key] = i
    components = defaultdict(list)
    for i, row in enumerate(rows):
        components[find(i)].append(row["property_group_id"])
    for i, row in enumerate(rows):
        row["evidence_cluster_id"] = "evidence_" + digest("|".join(sorted(components[find(i)])))
    return rows


def quantile(values, p):
    ordered = sorted(values)
    position = (len(ordered) - 1) * p
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower)


def comparable_key(row):
    return row["locality_key"], row["area_band"], row["benchmark_segment"]


def estimate(training, target, min_groups=MIN_GROUPS):
    groups = defaultdict(list)
    for row in training:
        if comparable_key(row) == comparable_key(target):
            groups[row["evidence_cluster_id"]].append(row["asking_rate_inr_sqft"])
    values = [statistics.median(rates) for rates in groups.values()]
    result = {"supporting_evidence_clusters": len(values), "supporting_listing_ids": sum(map(len, groups.values()))}
    if len(values) < min_groups:
        return dict(result, status="insufficient_data", estimate=None)
    return dict(result, status="experimental", estimate=statistics.median(values),
                comparable_p10=quantile(values, .1), comparable_p90=quantile(values, .9))


def evaluate(rows):
    # All connected project/pin groups stay within one fold, even across locality labels.
    for row in rows:
        row["fold"] = int(hashlib.sha256(row["evidence_cluster_id"].encode()).hexdigest(), 16) % 5
    predictions = []
    for fold in range(5):
        training = [r for r in rows if r["fold"] != fold]
        testing = [r for r in rows if r["fold"] == fold]
        assert {r["evidence_cluster_id"] for r in training}.isdisjoint(r["evidence_cluster_id"] for r in testing)
        for target in testing:
            prediction = estimate(training, target)
            actual = target["asking_rate_inr_sqft"]
            prediction.update(listing_id=target["listing_id"], evidence_cluster_id=target["evidence_cluster_id"],
                              locality_key=target["locality_key"], area_band=target["area_band"],
                              benchmark_segment=target["benchmark_segment"], fold=fold, actual=actual,
                              absolute_error=abs(prediction["estimate"]-actual) if prediction["estimate"] is not None else None,
                              absolute_percentage_error=abs(prediction["estimate"]-actual)/actual*100 if prediction["estimate"] is not None else None)
            predictions.append(prediction)
    return predictions


def metrics(predictions):
    scored = [p for p in predictions if p["estimate"] is not None]
    cluster_errors = defaultdict(list)
    for p in scored:
        cluster_errors[p["evidence_cluster_id"]].append(p["absolute_error"])
    return dict(total=len(predictions), scored=len(scored), abstained=len(predictions)-len(scored),
                scored_evidence_clusters=len(cluster_errors),
                mae_inr_sqft=statistics.mean(p["absolute_error"] for p in scored) if scored else None,
                median_absolute_percentage_error=statistics.median(p["absolute_percentage_error"] for p in scored) if scored else None,
                cluster_balanced_mae=statistics.mean(statistics.mean(v) for v in cluster_errors.values()) if scored else None)


def build(audit):
    data = audit.parent.parent
    source_paths = [audit / "clean_observations.jsonl", audit / "duplicate_candidates.csv", data / "records.jsonl"]
    hashes = {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in source_paths}
    if hashes[str(source_paths[0])] != REVIEWED_INPUT_SHA256:
        raise ValueError("Manual review decisions are pinned to a specific audit hash. Review changed evidence before applying these decisions to another dataset.")
    rows = [json.loads(s) for s in source_paths[0].read_text(encoding="utf-8").splitlines()]
    latest = {r["listing_id"]: r for r in sorted(rows, key=lambda r:(r["fetched_at"], r["observation_id"]))}
    out = data / "derived" / ("review_baseline_" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ"))
    out.mkdir(parents=True)
    reviewed_rates = []
    for row in latest.values():
        if "rate_disagreement" not in row["flags"]:
            continue
        raw = next(r for r in json.loads((data / row["raw_evidence"]).read_text(encoding="utf-8"))["searchResult"] if r.get("encId") == row["listing_id"])
        reviewed_rates.append(dict(listing_id=row["listing_id"], observations=sum(r["listing_id"] == row["listing_id"] for r in rows),
                                   locality=row["source_locality"], raw_area=raw.get("la"), raw_unit=raw.get("landAreaUnitD"),
                                   raw_auto_description=raw.get("auto_desc"), numeric_total=raw.get("price"),
                                   source_rate=row["source_rate_inr_sqft"], computed_rate=row["asking_rate_inr_sqft"],
                                   computed_to_source_ratio=row["asking_rate_inr_sqft"] / row["source_rate_inr_sqft"],
                                   decision="quarantine_pending_unit_confirmation", correction_applied=False,
                                   reason="Source auto-description and structured unit representation differ; source rate is inconsistent with its price/area. Cannot establish which source field is wrong.",
                                   raw_evidence=row["raw_evidence"]))
    candidates = list(csv.DictReader(source_paths[1].open(encoding="utf-8-sig")))
    reviews = []
    for group in sorted({r["candidate_id"] for r in candidates}):
        ids = [r["listing_id"] for r in candidates if r["candidate_id"] == group]
        reviews.append(dict(candidate_id=group, listing_ids=ids, distinct_source_ids=len(ids),
                            observations=sum(r["listing_id"] in ids for r in rows), decision="identity_unresolved_keep_excluded",
                            merged=False, evidence=DUPLICATE_REVIEW.get(group, "No parcel identity confirmation available."),
                            raw_evidence=sorted({r["raw_evidence"] for r in rows if r["listing_id"] in ids})))
    geo_reviews = []
    for row in latest.values():
        if "coordinates_outside_target_box" not in row["flags"]:
            continue
        lat, lon = float(row["latitude"]), float(row["longitude"])
        swap_plausible = 17.5 <= lon <= 20.5 and 72 <= lat <= 74.5
        geo_reviews.append(dict(listing_id=row["listing_id"], source_locality=row["source_locality"],
                                latitude=lat, longitude=lon, swap_within_broad_box=swap_plausible,
                                decision="quarantine_possible_coordinate_swap" if swap_plausible else "quarantine_unresolved_location",
                                correction_applied=False, raw_evidence=row["raw_evidence"]))
    land_reviews = []
    for row in latest.values():
        if "land_use_keyword_review" not in row["flags"]:
            continue
        decision, reason = LAND_REVIEW.get(row["listing_id"], (
            "ambiguous_keep_excluded", "Mixed-use, farmhouse, development or acquisition language does not identify an unambiguous vacant residential parcel."))
        land_reviews.append(dict(listing_id=row["listing_id"], locality=row["source_locality"],
                                 decision=decision, reason=reason, raw_evidence=row["raw_evidence"],
                                 legal_buildability_verified=False))
    eligible, excluded = [], []
    for row in latest.values():
        reasons = []
        if not reviewed_eligible(row):
            reasons.append("audit_or_review_excluded")
        loc = locality_key(row)
        if loc is None:
            reasons.append("city_only_or_missing_locality")
        if reasons:
            excluded.append(dict(listing_id=row["listing_id"], reasons=reasons, audit_flags=row["flags"]))
            continue
        row = dict(row)
        row.update(locality_key=loc, area_band=area_band(row["area_sqft"]),
                   benchmark_review_decision=LAND_REVIEW.get(row["listing_id"], ("original_audit_eligibility",))[0],
                   benchmark_segment="named_project" if row.get("project_name") else "individual_or_unknown")
        eligible.append(row)
    # Build clusters over all source groups before excluding rows: excluded bridge rows
    # can still reveal two apparently independent eligible rows belong together.
    clustered = cluster_rows([dict(r) for r in latest.values()])
    clusters = {r["listing_id"]:r["evidence_cluster_id"] for r in clustered}
    for row in eligible:
        row["evidence_cluster_id"] = clusters[row["listing_id"]]
    predictions = evaluate(eligible)
    coverage = []
    for key in sorted({comparable_key(r) for r in eligible}):
        group = [r for r in eligible if comparable_key(r) == key]
        result = estimate(group, group[0])
        coverage.append(dict(locality_key=key[0], area_band=key[1], benchmark_segment=key[2], **result))
    locality_scores = [dict(locality_key=loc, **metrics([p for p in predictions if p["locality_key"]==loc]))
                       for loc in sorted({p["locality_key"] for p in predictions})]
    priorities = [dict(locality_key=r["locality_key"], area_band=r["area_band"], benchmark_segment=r["benchmark_segment"],
                       supporting_evidence_clusters=r["supporting_evidence_clusters"],
                       groups_short_of_experiment_minimum=max(0, MIN_GROUPS-r["supporting_evidence_clusters"]),
                       reason="Below exploratory support threshold; collect independent evidence, not repeated advertisements")
                  for r in coverage if r["status"] == "insufficient_data"]
    priorities.insert(0, dict(locality_key="kalyan | khadakpada", area_band="not established", benchmark_segment="not established",
                              supporting_evidence_clusters=0, groups_short_of_experiment_minimum=MIN_GROUPS,
                              reason="Explicit target locality has no resolved observations; first verify precise locality coverage"))
    summary = dict(version=VERSION, input_audit=str(audit), input_hashes=hashes,
                   distinct_source_ids=len(latest), rate_disagreement_observations=sum(r["observations"] for r in reviewed_rates),
                   rate_disagreement_listing_ids=len(reviewed_rates), duplicate_candidate_groups=len(reviews),
                   duplicate_candidate_listing_ids=len({r["listing_id"] for r in candidates}),
                   duplicate_candidate_observations=sum(r["observations"] for r in reviews),
                   land_review_listing_ids=len(land_reviews), land_review_decisions=dict(Counter(r["decision"] for r in land_reviews)),
                   contextual_keyword_releases_in_benchmark=sum(r["benchmark_review_decision"] == "context_only" for r in eligible),
                   original_provisional_rows=sum(r["provisional_eligible"] for r in latest.values()),
                   benchmark_rows=len(eligible), benchmark_evidence_clusters=len({r["evidence_cluster_id"] for r in eligible}),
                   supported_locality_area_segments=sum(r["status"]=="experimental" for r in coverage),
                   minimum_groups=MIN_GROUPS, evaluation=metrics(predictions),
                   limitation="Exploratory advertised-price benchmark only; no verified parcel identities, locality boundaries, sale prices, temporal or unseen-locality validation.")
    for filename, records, fields in [
        ("rate_review.csv", reviewed_rates, list(reviewed_rates[0]) if reviewed_rates else ["listing_id"]),
        ("duplicate_review.csv", reviews, list(reviews[0]) if reviews else ["candidate_id"]),
        ("geography_review.csv", geo_reviews, list(geo_reviews[0]) if geo_reviews else ["listing_id"]),
        ("land_use_review.csv", land_reviews, list(land_reviews[0]) if land_reviews else ["listing_id"]),
        ("collection_priorities.csv", priorities, list(priorities[0])),
        ("exclusions.csv", excluded, ["listing_id", "reasons", "audit_flags"]),
        ("coverage.csv", coverage, ["locality_key", "area_band", "benchmark_segment", "status", "supporting_evidence_clusters", "supporting_listing_ids", "estimate", "comparable_p10", "comparable_p90"]),
        ("heldout_predictions.csv", predictions, ["listing_id", "evidence_cluster_id", "locality_key", "area_band", "benchmark_segment", "fold", "status", "supporting_evidence_clusters", "supporting_listing_ids", "estimate", "comparable_p10", "comparable_p90", "actual", "absolute_error", "absolute_percentage_error"]),
        ("locality_evaluation.csv", locality_scores, ["locality_key", "total", "scored", "abstained", "scored_evidence_clusters", "mae_inr_sqft", "median_absolute_percentage_error", "cluster_balanced_mae"]),
    ]:
        write_csv(out / filename, records, fields)
    write_jsonl(out / "benchmark_snapshot.jsonl", eligible)
    (out / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    report = ["# Evidence review and first comparable-listing benchmark", "",
              "This is an offline investigation, not a current land valuation service.", "",
              f"Reviewed {len(reviewed_rates)} distinct rate-disagreement IDs ({summary['rate_disagreement_observations']} observations) and {len(reviews)} duplicate candidate groups.",
              "Raw fields conflict or lack unique parcel identifiers. All ambiguous cases remain excluded; no source values were silently corrected.",
              "Two land-use keyword hits were contextual: 'Non agricultural' and 'high commercial value'. Only the keyword exclusion is released; all other audit/location exclusions remain in force.",
              "Three descriptions explicitly indicate agricultural land, current industrial zoning, or an existing building. These are source-text exclusions, not independently verified legal findings.",
              "One geographic outlier has a plausible reversed coordinate pair. Swapping was not applied without independent location evidence.", "",
              "## Baseline rules", "",
              "- Canonicalize case/whitespace and remove an exact trailing source-city suffix. No fuzzy locality merges; city-only labels excluded.",
              "- Match source locality, area band (up to 1,500 / 1,500-3,000 / 3,000-10,000 sqft), and named-project versus individual/unknown segment.",
              "- Cluster shared project names within source city and pins rounded to four decimals, transitively, across all source IDs including excluded rows.",
              "- One median asking rate per evidence cluster, then the median across clusters. Cluster grouping does not prove physical identity.",
              "- Require five supporting clusters; otherwise abstain. This is a fixed experiment threshold, not a release criterion.",
              "- Five deterministic group-held-out folds. Compute all comparable medians from the training fold only. Target price is never a matching input.",
              "- P10/P90 is the spread of comparable cluster medians, not a calibrated prediction interval.",
              "- Unknown duplicates and approximate pins remain possible; no temporal or unseen-locality performance claim is made.",
              "- Listing rows with missing coordinates remain allowed for source-locality experiments; no parcel distances are calculated.", "",
              "## Results", "", f"Original provisional rows: {summary['original_provisional_rows']}; benchmark rows: {len(eligible)}.",
              f"Evidence clusters: {summary['benchmark_evidence_clusters']}; supported locality/area/segment combinations: {summary['supported_locality_area_segments']}.",
              "", "```json", json.dumps(summary["evaluation"], indent=2), "```", "",
              "Pooled metrics describe only non-abstained observations; consult locality_evaluation.csv and abstention counts. No accuracy threshold was selected or passed for release.",
              "", "## Next work", "", "Review source conflicts with independent parcel evidence; target additional collection to unsupported locality/area segments. Kalyan/Khadakpada must not inherit a nearby locality estimate silently.",
              "Before production, verify locality/land-use definitions, build stronger property groups, obtain later observations and agree performance/release criteria."]
    (out / "review_report.md").write_text("\n".join(report)+"\n", encoding="utf-8")
    for path, expected in hashes.items():
        assert hashlib.sha256(Path(path).read_bytes()).hexdigest() == expected, path
    print(json.dumps({k:v for k,v in summary.items() if k != "input_hashes"}, indent=2))
    print(f"Outputs: {out}")
    return out


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--audit-dir", type=Path, default=DEFAULT_AUDIT)
    build(parser.parse_args().audit_dir.resolve())
