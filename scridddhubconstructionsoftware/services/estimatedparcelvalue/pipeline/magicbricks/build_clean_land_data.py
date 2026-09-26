"""Offline, versioned audit of saved plot observations. Never mutates source data.

Run from any directory: python build_clean_land_data.py
JSONL/CSV outputs deliberately require no additional packages.
Eligibility is provisional arithmetic/segment screening, not verified buildability.
"""
import argparse
import csv
import hashlib
import html
import json
import math
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

VERSION = "1.1.0"
DEFAULT_DATA = Path(__file__).resolve().parent.parent / "magicbricks_mmr_data"
UNITS = {"sq-ft": 1, "sqft": 1, "sq ft": 1, "acre": 43560,
         "acres": 43560, "sq-yrd": 9, "sqyd": 9, "sq-m": 10.7639104167}


def number(value):
    try:
        result = float(str(value).replace(",", "").strip())
        return result if math.isfinite(result) else None
    except (ValueError, TypeError):
        return None


def stamp(value):
    try:
        result = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return result.replace(tzinfo=timezone.utc) if result.tzinfo is None else result
    except (ValueError, TypeError):
        return None


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()[:20]


def text(value):
    return re.sub(r"\s+", " ", html.unescape(str(value or ""))).strip()


def display_price(value):
    match = re.fullmatch(r"(?:₹|rs\.?|inr)?\s*([\d,.]+)\s*(cr|crore|lac|lakh|lakhs)?", text(value).lower())
    if not match:
        return None
    amount = number(match[1])
    scale = {"cr": 10000000, "crore": 10000000, "lac": 100000, "lakh": 100000, "lakhs": 100000}.get(match[2], 1)
    return amount * scale if amount is not None else None


def write_csv(path, rows, fields):
    with path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fields, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow({k: json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else v
                             for k, v in row.items()})


def write_jsonl(path, rows):
    with path.open("w", encoding="utf-8") as stream:
        for row in rows:
            stream.write(json.dumps(row, ensure_ascii=False, allow_nan=False) + "\n")


def clean(row, raw, raw_path, line, reference):
    result = dict(row)
    flags, recovered = [], []
    for field, keys in {"url": ("newUrl", "seoURL"), "seller_type": ("personType", "userType"),
                        "description": ("dtldesc", "auto_desc"), "project_name": ("prjname",)}.items():
        if not result.get(field):
            value = next((raw[k] for k in keys if raw.get(k)), None)
            if value:
                result[field] = urljoin("https://www.magicbricks.com", str(value)) if field == "url" else value
                recovered.append(field)
    price, area, source_rate = (number(row.get(k)) for k in ("price_rupees", "plot_area", "price_per_sqft"))
    unit = text(row.get("plot_area_unit")).lower()
    factor = UNITS.get(unit)
    sqft = area * factor if area is not None and factor is not None else None
    if factor is None:
        flags.append("unknown_area_unit")
    if price is None or price <= 0:
        flags.append("invalid_price")
    if sqft is None or sqft <= 0:
        flags.append("invalid_area")
    rate = price / sqft if price and price > 0 and sqft and sqft > 0 else None
    displayed = display_price(row.get("price_display"))
    price_label = text(row.get("price_display")).lower()
    if any(term in price_label for term in ("call", "request", "onwards", "starting", "deposit", "per ")):
        flags.append("ambiguous_price_label")
    if displayed is not None and price and abs(displayed-price) > max(1000, price*.02):
        flags.append("display_price_disagreement")
    discrepancy = abs(rate - source_rate) / rate if rate and source_rate is not None else None
    if source_rate is None or source_rate <= 0:
        flags.append("invalid_source_rate")
    elif rate and abs(rate - source_rate) > max(1.0, rate * .05):
        flags.append("rate_disagreement")
    lat, lon = number(row.get("latitude")), number(row.get("longitude"))
    # Deliberately broad screening box, NOT an administrative boundary/locality validation.
    if lat is None or lon is None or lat == 0 or lon == 0 or not (-90 <= lat <= 90 and -180 <= lon <= 180):
        geo = "missing_or_invalid"
        flags.append("invalid_coordinates")
    elif not (17.5 <= lat <= 20.5 and 72 <= lon <= 74.5):
        geo = "outside_broad_target_box"
        flags.append("coordinates_outside_target_box")
    else:
        geo = "within_broad_target_box_unverified"
    locality = text(row.get("locality_seo") or row.get("locality"))
    if not locality:
        flags.append("missing_locality")
    observed, posted = stamp(row.get("fetched_at")), stamp(row.get("posted_date_raw"))
    age = (observed - posted).total_seconds() / 86400 if observed and posted else None
    if posted is None:
        flags.append("unparsed_listing_date")
    if age is not None and age < -1:
        flags.append("future_listing_date")
    if age is not None and age > 180:
        flags.append("listing_older_than_180_days")
    prose = text(str(result.get("title") or "") + " " + str(result.get("description") or "")).lower()
    category = "source_label_only_unverified"
    category_terms = re.findall(r"\b(?:agricultural|farmhouse|farm land|industrial|commercial)\b", prose)
    if row.get("property_category") != "Residential Plot":
        category = "out_of_scope"
        flags.append("wrong_source_category")
    elif category_terms:
        category = "ambiguous"
        flags.append("land_use_keyword_review")
    # 10,000 sqft is a review threshold, not a claim about legal/market segmentation.
    project = raw.get("isProjProp") == "Y" or row.get("source_channel") == "Project"
    segment = "project_inventory" if project else "individual_or_unknown"
    if sqft and sqft > 10000:
        segment = "large_parcel_review"
        flags.append("large_parcel_review")
    if project:
        flags.append("project_inventory_review")
    if raw_path is None:
        flags.append("missing_raw_evidence")
    blocking = {"unknown_area_unit", "invalid_price", "invalid_area", "rate_disagreement",
                "invalid_source_rate", "wrong_source_category", "land_use_keyword_review",
                "large_parcel_review", "project_inventory_review", "missing_locality",
                "unparsed_listing_date", "future_listing_date", "listing_older_than_180_days",
                "missing_raw_evidence", "coordinates_outside_target_box"}
    blocking.update({"ambiguous_price_label", "display_price_disagreement"})
    result.update(processing_version=VERSION, source_line=line,
                  observation_id=digest(f"{row.get('source')}|{row.get('market')}|{row.get('run_id')}|{row.get('listing_id')}"),
                  property_group_id="listing_" + digest(f"{row.get('source')}|{row.get('listing_id')}"),
                  group_basis="same_source_listing_id_only", raw_evidence=raw_path,
                  recovered_fields=recovered, requested_market=row.get("market"), source_locality=locality,
                  resolved_locality=None, price_inr=price, area_sqft=sqft,
                  display_price_inr=displayed,
                  asking_rate_inr_sqft=rate, source_rate_inr_sqft=source_rate,
                  rate_relative_disagreement=discrepancy, coordinate_status=geo,
                  listing_date_parsed=posted.isoformat() if posted else None,
                  listing_age_days_at_capture=age, land_use_status=category,
                  land_use_review_terms=sorted(set(category_terms)), segment=segment,
                  flags=flags, provisional_eligible=not bool(set(flags) & blocking),
                  snapshot_reference_date=reference.isoformat())
    return result


def build(data):
    source = data / "records.jsonl"
    before = hashlib.sha256(source.read_bytes()).hexdigest()
    rows = [json.loads(line) for line in source.read_text(encoding="utf-8").splitlines() if line.strip()]
    state = json.loads((data / "crawl_state.json").read_text(encoding="utf-8"))["markets"]
    reference = max(stamp(r["fetched_at"]) for r in rows)
    run = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    output = data / "derived" / f"audit_{run}"
    output.mkdir(parents=True, exist_ok=False)
    raw_index, page_stats = {}, []
    routes = defaultdict(set)
    raw_hashes = {}
    for path in sorted((data / "raw").glob("*/*/page_*.json")):
        raw_hashes[str(path.relative_to(data))] = hashlib.sha256(path.read_bytes()).hexdigest()
        payload = json.loads(path.read_text(encoding="utf-8"))
        run_id, market, page = path.parent.parent.name, path.parent.name, int(path.stem.split("_")[1])
        listings = payload.get("searchResult", [])
        if not isinstance(listings, list):
            raise ValueError(f"Malformed searchResult: {path}")
        accepted = [r for r in listings if isinstance(r, dict) and r.get("encId") and r.get("propTypeD") == "Residential Plot"]
        for raw in accepted:
            raw_index.setdefault((run_id, market, page, str(raw["encId"])), (raw, str(path.relative_to(data))))
        meta = payload.get("searchAdditionalDataBean") or {}
        page_stats.append(dict(run_id=run_id, market=market, page=page, cards=len(listings),
                               accepted_ids=[str(r["encId"]) for r in accepted],
                               rejected_or_missing_id=len(listings)-len(accepted),
                               reported_count=meta.get("resultCount"), reported_pages=meta.get("pageCount")))
        # Discover routes from saved evidence; do not invent or request guessed URLs.
        for link in re.findall(r'https?://www\.magicbricks\.com/residential-plots-land-for-sale-in-[^\s"<>\\]+',
                               path.with_suffix(".html").read_text(encoding="utf-8") if path.with_suffix(".html").exists() else ""):
            routes[html.unescape(link)].add(str(path.relative_to(data)))
    cleaned = []
    for line, row in enumerate(rows, 1):
        raw, evidence = raw_index.get((row["run_id"], row["market"], row["source_page"], row["listing_id"]), ({}, None))
        cleaned.append(clean(row, raw, evidence, line, reference))
    groups = defaultdict(list)
    for row in cleaned:
        groups[row["property_group_id"]].append(row)
    selected = [max(group, key=lambda r: (r["fetched_at"], r["observation_id"])) for group in groups.values()]
    # Exact evidence signatures only propose cross-ID matches; never merge automatically.
    signatures = defaultdict(list)
    for row in selected:
        if row["coordinate_status"] == "within_broad_target_box_unverified" and row["area_sqft"] and row["price_inr"]:
            signature = (round(float(row["latitude"]), 5), round(float(row["longitude"]), 5),
                         round(row["area_sqft"], 1), round(row["price_inr"]))
            signatures[signature].append(row)
    candidates = []
    for signature, group in signatures.items():
        if len(group) < 2:
            continue
        candidate_id = "candidate_" + digest(str(signature))
        for row in group:
            candidates.append(dict(candidate_id=candidate_id, property_group_id=row["property_group_id"],
                                   listing_id=row["listing_id"], evidence="same rounded coordinates, area and price; may be generic project/centroid", confidence="review_required"))
            for observation in groups[row["property_group_id"]]:
                observation["flags"].append("cross_id_duplicate_candidate")
                observation["provisional_eligible"] = False
    pins = Counter((r.get("latitude"), r.get("longitude")) for r in selected if r["coordinate_status"] == "within_broad_target_box_unverified")
    for row in cleaned:
        if pins[(row.get("latitude"), row.get("longitude"))] >= 3:
            row["flags"].append("shared_coordinate_pin")
    snapshot = [r for r in selected if r["provisional_eligible"]]
    coverage = []
    for market, current in state.items():
        pages = [p for p in page_stats if p["market"] == market and p["run_id"] == current.get("run_id")]
        raw_ids = [x for p in pages for x in p["accepted_ids"]]
        saved = [r for r in cleaned if r["market"] == market and r["run_id"] == current.get("run_id")]
        saved_ids = {r["listing_id"] for r in saved}
        coverage.append(dict(market=market, status=current.get("status"), run_id=current.get("run_id"),
                             reported_results=current.get("reported_result_count"), raw_cards=sum(p["cards"] for p in pages),
                             accepted_cards=len(raw_ids), repeated_cards=len(raw_ids)-len(set(raw_ids)),
                             distinct_raw_ids=len(set(raw_ids)), saved_observations=len(saved),
                             rejected_or_missing_id=sum(p["rejected_or_missing_id"] for p in pages),
                             raw_ids_not_saved=sorted(set(raw_ids)-saved_ids), saved_ids_not_in_raw=sorted(saved_ids-set(raw_ids)),
                             provisional_latest_run_listing_ids=len({r["listing_id"] for r in saved if r["provisional_eligible"]})))
    localities = defaultdict(list)
    for row in selected:
        localities[(row["source_locality"], text(row.get("city")))].append(row)
    locality_rows = [dict(source_locality=loc, source_city=city, distinct_listing_ids=len(group),
                          provisional_eligible=sum(r["provisional_eligible"] for r in group),
                          missing_coordinates=sum(r["coordinate_status"] == "missing_or_invalid" for r in group))
                     for (loc, city), group in sorted(localities.items())]
    write_jsonl(output / "clean_observations.jsonl", cleaned)
    write_jsonl(output / "model_snapshot_provisional.jsonl", snapshot)
    write_csv(output / "property_groups.csv", [dict(property_group_id=key, listing_id=group[0]["listing_id"], observations=len(group),
              markets=sorted({r["market"] for r in group}), basis="same source ID; physical parcel identity unverified") for key, group in groups.items()],
              ["property_group_id", "listing_id", "observations", "markets", "basis"])
    write_csv(output / "duplicate_candidates.csv", candidates, ["candidate_id", "property_group_id", "listing_id", "evidence", "confidence"])
    write_csv(output / "review_queue.csv", [r for r in cleaned if r["flags"]],
              ["observation_id", "listing_id", "requested_market", "source_locality", "price_inr", "area_sqft", "asking_rate_inr_sqft", "flags", "raw_evidence", "url"])
    write_csv(output / "coverage_reconciliation.csv", coverage, list(coverage[0]))
    write_csv(output / "locality_coverage.csv", locality_rows, list(locality_rows[0]))
    route_rows = [dict(url=url, evidence=sorted(paths)[0]) for url, paths in sorted(routes.items())
                  if any(term in url for term in ("shahad", "khadakpada", "thane-pppfs/page", "kamothe", "rasayani", "vasind"))]
    write_csv(output / "discovered_routes.csv", route_rows, ["url", "evidence"])
    flags = Counter(flag for r in cleaned for flag in r["flags"])
    summary = dict(processing_version=VERSION, source_sha256=before, reference_date=reference.isoformat(),
                   observations=len(rows), distinct_source_ids=len(groups), provisional_snapshot_rows=len(snapshot),
                   recovered_fields=dict(Counter(f for r in cleaned for f in r["recovered_fields"])), flags=dict(flags),
                   duplicate_candidate_groups=len({r["candidate_id"] for r in candidates}),
                   snapshot_policy="Latest observed row per source ID across history; cross-ID candidates excluded. This is not verified independent parcels.",
                   coverage=coverage)
    (output / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    (output / "raw_manifest.json").write_text(json.dumps(raw_hashes, indent=2), encoding="utf-8")
    report = ["# Offline residential plot data audit", "", f"Processing version: {VERSION}; evidence reference: {reference.isoformat()}", "",
              f"- Observations: {len(rows)}; distinct source IDs: {len(groups)}.",
              f"- Provisional snapshot: {len(snapshot)} latest-per-source-ID rows.",
              f"- Recovered fields from original raw pages: {summary['recovered_fields']}.",
              f"- Cross-ID duplicate candidate groups: {summary['duplicate_candidate_groups']}.", "",
              "## Rules and limits", "",
              "The snapshot is for investigation, not production valuation. Source labels do not verify residential buildability.",
              "No physical-property count is claimed. Same-ID history is grouped; exact coordinate/area/price matches across IDs require review.",
              "Coordinates are screened against a broad box (17.5-20.5 N, 72-74.5 E), not resolved to parcel/locality boundaries.",
              "Rate disagreement threshold: greater than max(1 INR/sqft, 5% of recomputed rate).",
              "Display-price discrepancy threshold: greater than max(1,000 INR, 2% of numeric total). Call/starting/per-unit labels require review.",
              "Road width is retained in source form; its unit is unverified and must not be used as a normalized model feature. Dimensions likewise require unit verification.",
              "Area above 10,000 sqft, project inventory and land-use keywords require review, not deletion.",
              "Listing age above 180 days requires review. Date semantics remain unverified; age uses observation time.",
              "Snapshot selects latest observed row per ID across history, including IDs absent from newer searches. This does not establish active availability.",
              "Missing coordinates do not exclude a locality-only experiment. Approximate/shared pins cannot support parcel distances.",
              "JSONL is used instead of Parquet to avoid introducing package dependencies; all source values and evidence pointers are retained.", "",
              "## Flag counts (observations, including repeats)", "", "| Flag | Count |", "|---|---:|"]
    report += [f"| {flag} | {count} |" for flag, count in sorted(flags.items())]
    report += ["", "## Latest-run page reconciliation", "", "| Market | Reported | Raw cards | Repeated accepted cards | Distinct raw IDs | Saved | Missing from saved |", "|---|---:|---:|---:|---:|---:|---:|"]
    report += [f"| {c['market']} | {c['reported_results']} | {c['raw_cards']} | {c['repeated_cards']} | {c['distinct_raw_ids']} | {c['saved_observations']} | {len(c['raw_ids_not_saved'])} |" for c in coverage]
    report += ["", "Reported totals are source metadata. A gap between reported totals and delivered unique IDs is not proof of a collector defect.",
               "Review coverage_reconciliation.csv before deciding whether another page request would add useful evidence.", "",
               "## Collection priorities", "", "1. Resolve Thane pagination and verify published Shahad/locality routes.",
               "2. Pilot Kalyan/Khadakpada and empty-market routes only where allowed and accessible.",
               "3. Choose second-source pilots from low-coverage localities; count incremental usable properties, not cards.",
               "4. Revisit selected markets on a later date for longitudinal evidence; do not treat same-day repeats as new properties."]
    (output / "quality_audit.md").write_text("\n".join(report) + "\n", encoding="utf-8")
    assert hashlib.sha256(source.read_bytes()).hexdigest() == before, "Source records changed during audit"
    for relative, expected in raw_hashes.items():
        assert hashlib.sha256((data / relative).read_bytes()).hexdigest() == expected
    print(json.dumps({k:v for k,v in summary.items() if k != "coverage"}, indent=2))
    print(f"Outputs: {output}")
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA)
    build(parser.parse_args().data_dir.resolve())
