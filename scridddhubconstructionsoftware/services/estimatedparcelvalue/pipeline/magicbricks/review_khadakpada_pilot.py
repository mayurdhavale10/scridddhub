"""Offline diagnostic review of the 21 September NoBroker pilot; no model ingestion.

Manual decisions are pinned to captured HTML. No network access or source writes.
"""
import argparse
import hashlib
import html
import json
import math
import re
from pathlib import Path

from build_clean_land_data import write_csv, write_jsonl

ROOT = Path(__file__).resolve().parent.parent
PILOT = ROOT / "residential_land_pilots/nobroker/20260921T063915Z"
EXPECTED = {
    "search": "667cdfb855a6e781dfbee2548236b3f800ffc3e08a53e6953ed95c6d7393fa63",
    "detail_mutha": "aa9ec2e228010948746a43f9f3bfd781afb20373ea60c151dc78daca547b2abe",
    "detail_nebula": "6b5ab3b74b1e61c80a429e604b70ae1942f5041a07ac3ade0e8dfa802311ee79",
    "detail_gandhar": "7bab4015eb688c6a447ef86bd186c2fb7702dfb01327469a9fb6f24abdfaa131",
}
REVIEWS = {
    "8a9fdc82832636660183265f7c662bff": ("detail_mutha", "potential_source_label_baseline_candidate",
        "Address explicitly names Khadakpada. Price and area agree across search and detail. "
        "Pin is a LANDMARK despite accurateLocation=true. Floors are allowed construction, "
        "not existing floors; BHK1 is not proof of a dwelling. Posted/available/creation dates "
        "differ; no confirmed new listing date. Ownership and parcel identity remain unknown."),
    "8aa9a7179f474c5c019f490b9fab6923": ("detail_nebula", "quarantine_geometry_and_project_review",
        "Named project Nebula CH; explicit Khadakpada address. Detail confirms 2 x 380 "
        "dimensions and 402 ft road width: unusual, not corrected. Four floors means "
        "allowed construction, not an existing building. Pin precision unknown. RERA/deed "
        "claims are unverified. active=true and historical inactiveReason=INCORRECT coexist."),
    "8a9ff18287cb75350187cb8d6d6510ff": ("detail_gandhar", "quarantine_locality_review",
        "Direct search result, but address names Gandhar Nagar and locality is Kalyan. "
        "Portal nbLocality/breadcrumb says Khadakpada; independent boundary is unresolved. "
        "Pin is explicitly a LANDMARK. No silent reassignment to Khadakpada."),
}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def visible_text(markup):
    markup = re.sub(r"<(script|style)\b[^>]*>.*?</\1>", "", markup, flags=re.S)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", markup)))


def pair_reasons(a, b):
    """Conservative review candidates, never proof of parcel identity; ignore price."""
    reasons = []
    project_a = str(a.get("project_name") or "").strip().casefold()
    project_b = str(b.get("project_name") or "").strip().casefold()
    if project_a and project_a == project_b:
        reasons.append("same_project_name")
    if all(r.get("latitude") and r.get("longitude") for r in (a, b)):
        # Coarse screening only; these pins do not establish parcel distance.
        lat = math.radians((a["latitude"] + b["latitude"]) / 2)
        distance = 111320 * math.hypot(a["latitude"] - b["latitude"],
                                      (a["longitude"] - b["longitude"]) * math.cos(lat))
        if distance < 100:
            reasons.append("pins_within_100m_not_parcel_precision")
    area_a, area_b = a.get("area_sqft"), b.get("area_sqft")
    location_a = str(a.get("address") or a.get("source_locality") or "").casefold()
    location_b = str(b.get("address") or b.get("source_locality") or "").casefold()
    if area_a and area_b and abs(area_a-area_b)/max(area_a, area_b) <= .1:
        if any(term in location_a and term in location_b for term in ("khadakpada", "gandhar", "kalyan")):
            reasons.append("similar_area_and_location_text")
    return reasons


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    paths = list((ROOT / "magicbricks_mmr_data/raw").rglob("*.json"))
    paths += [ROOT / "magicbricks_mmr_data/records.jsonl"]
    paths += list((ROOT / "magicbricks_mmr_data/derived").rglob("*"))
    protected = {str(p.relative_to(ROOT)): sha(p) for p in paths if p.is_file()}
    for label, expected in EXPECTED.items():
        if sha(PILOT / label / "body.bin") != expected:
            raise ValueError(f"Changed evidence requires fresh review: {label}")
    args.output.mkdir(parents=True, exist_ok=False)
    raw = (PILOT / "search/body.bin").read_text(encoding="utf-8")
    state = json.JSONDecoder().raw_decode(raw.split("nb.appState = ", 1)[1])[0]
    source = state["listPage"]
    captured = json.loads((PILOT / "search/response.json").read_text())["observed_at"]
    observations, reviews = [], []
    for kind, key in (("direct", "listPageProperties"), ("nearby", "listPageNearByProperties")):
        for index, record in enumerate(source[key]):
            listing_id = record["id"]
            # Only normalize this reviewed page, whose cards explicitly display sqft.
            area, price = record["plotArea"], record["price"]
            if not (area > 0 and price > 0):
                raise ValueError("Unexpected price/area; review again")
            rate = price / area
            row = dict(source="nobroker", listing_id=listing_id,
                       source_identity=["nobroker", listing_id],
                       run_id="20260921T063915Z", observed_at=captured,
                       requested_market="Khadakpada, Kalyan", result_kind=kind,
                       source_locality=record.get("locality"),
                       source_search_locality=record.get("nbLocality"),
                       source_city=record.get("city"), resolved_locality=None,
                       address=record.get("address"), price_inr=price, area_sqft=area,
                       area_unit_evidence="Rendered card: sqft Plot Area; reviewed search HTML",
                       asking_rate_inr_sqft=rate, source_rate_inr_sqft=record.get("pricePerUnit"),
                       rate_relative_disagreement=abs(rate-record["pricePerUnit"])/rate,
                       latitude=record.get("latitude"), longitude=record.get("longitude"),
                       coordinate_granularity=("landmark" if record.get("aea__", {}).get("ACCURATE_LOCATION", {}).get("value") == "LANDMARK" else "unverified"),
                       project_name=record.get("plotProjectName"),
                       property_category=record.get("plotTypeDesc"),
                       ownership=record.get("ownershipType"), seller_type=None,
                       transaction_type=None, listing_date_verified=None,
                       raw_dates={k: record.get(k) for k in ("creationDate", "availableFrom", "lastUpdateDate", "activationDate")},
                       url="https://www.nobroker.in" + record["detailUrl"],
                       raw_evidence="../search/body.bin",
                       raw_pointer=f"nb.appState/listPage/{key}/{index}",
                       raw_sha256=EXPECTED["search"], processing_version="nobroker-diagnostic-1.1",
                       eligible_for_model=False, exclusion_reasons=["locality_and_parcel_review_pending"],
                       original_fields=record)
            if kind == "direct":
                folder, decision, reason = REVIEWS[listing_id]
                row["review_decision"] = decision
                row["detail_evidence"] = f"../{folder}/body.bin"
                reviews.append(dict(source="nobroker", listing_id=listing_id, decision=decision,
                                    reason=reason, evidence=row["detail_evidence"],
                                    eligible_for_model=False))
            else:
                row["review_decision"] = "exclude_nearby_recommendation"
                row["exclusion_reasons"].append("nearby_not_direct_locality_evidence")
            observations.append(row)
    assert len(observations) == 10 and len(reviews) == 3
    assert len({tuple(r["source_identity"]) for r in observations}) == 10
    audit = ROOT / "magicbricks_mmr_data/derived/audit_20260920T163501642878Z/clean_observations.jsonl"
    historical = [json.loads(line) for line in audit.read_text(encoding="utf-8").splitlines()]
    historical = list({(r["source"], r["listing_id"]): r for r in historical}.values())
    candidates = []
    direct = [r for r in observations if r["result_kind"] == "direct"]
    for i, row in enumerate(direct):
        for other in historical + direct[i+1:]:
            reasons = pair_reasons(row, other)
            if reasons:
                candidates.append(dict(source_a=row["source"], listing_a=row["listing_id"],
                                       source_b=other["source"], listing_b=other["listing_id"],
                                       reasons=reasons, decision="unresolved_review_candidate"))
    write_jsonl(args.output / "diagnostic_observations.jsonl", observations)
    write_csv(args.output / "review_queue.csv", reviews, list(reviews[0]))
    write_csv(args.output / "duplicate_candidates.csv", candidates,
              ["source_a", "listing_a", "source_b", "listing_b", "reasons", "decision"])
    for folder in EXPECTED:
        text = visible_text((PILOT / folder / "body.txt").read_text(encoding="utf-8"))
        (args.output / f"{folder}_text.txt").write_text(text, encoding="utf-8")
    result = dict(run_id="20260921T063915Z", outcome="diagnostic_review_complete",
                  raw_cards=10, direct_cards=3, nearby_cards=7, distinct_source_ids=10,
                  direct_source_ids=3, direct_explicit_khadakpada_addresses=2,
                  independently_resolved_localities=0, eligible_observations=0,
                  confirmed_new_physical_properties=0, potential_source_label_candidate=1,
                  diagnostic_observations=10, reviewed_details=3,
                  duplicate_candidates=len(candidates), historical_source_ids_screened=len(historical),
                  duplicate_screen_limit="Missing pins, descriptions and parcel IDs prevent proving independence; no match is not proof of uniqueness.",
                  original_dataset_modified=False, model_integration_performed=False,
                  baseline_rerun=False, khadakpada_status="insufficient_data",
                  search_requests=1, detail_requests=3, supporting_document_requests=2,
                  local_sandbox_transport_failures=1,
                  unattempted=["Nearby details: outside target scope", "Remaining detail allowance: not a collection target", "Model integration: locality and parcel review pending", "Other portals: not selected for this pilot"])
    (args.output / "pilot_report.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    assert all(sha(ROOT / path) == expected for path, expected in protected.items())
    (args.output / "preservation_manifest.json").write_text(json.dumps(dict(
        verified_unchanged=True, original_files=protected, pilot_input_hashes=EXPECTED), indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
