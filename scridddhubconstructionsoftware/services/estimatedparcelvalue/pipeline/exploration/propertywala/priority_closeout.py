"""Recount priority collection evidence and write the dated regional checklist."""
import csv
import hashlib
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REPO = ROOT.parents[2]
PILOT = ROOT / 'residential_land_pilots/propertywala/20260922_priority'


def read_rows(path):
    return [json.loads(line) for line in path.read_text(encoding='utf-8').splitlines() if line.strip()]


def main():
    records_path = ROOT / 'magicbricks_mmr_data/records.jsonl'
    rows = read_rows(records_path)
    old = [r for r in rows if not r['run_id'].startswith('20260922')]
    today = [r for r in rows if r['run_id'].startswith('20260922')]
    old_ids = {r['listing_id'] for r in old}
    pw = read_rows(PILOT / 'observations.jsonl')
    state = json.loads((ROOT / 'magicbricks_mmr_data/crawl_state.json').read_text(encoding='utf-8'))['markets']
    historic_report = json.loads((ROOT / 'magicbricks_mmr_data/coverage_quality_20260920T115911Z.json').read_text(encoding='utf-8'))
    report = {'date': '2026-09-22', 'scope_complete': False,
              'magicbricks': {'observations': len(rows), 'distinct_ids': len({r['listing_id'] for r in rows}),
                             'today_observations': len(today), 'today_new_ids': len({r['listing_id'] for r in today} - old_ids),
                             'benchmark_rows_unchanged': 364},
              'propertywala': {'observations': len(pw), 'distinct_ids': len({r['listing_id'] for r in pw}),
                              'by_requested_market': dict(Counter(r['requested_market'] for r in pw)),
                              'numeric_price_area_observations': sum(bool(r['price_rupees'] and r['area_sqft']) for r in pw),
                              'review_flags': dict(Counter(f for r in pw for f in r['review_flags'])), 'benchmark_additions': 0},
              'markets': {}}
    lines = ['# Collection status — 22 September 2026', '',
             'Priority: Mumbai, Thane, Kalyan (including Khadakpada). The full multi-source task remains incomplete.', '',
             '## Priority batch results', '',
             '| Website | Requested market | Saved observations | New source IDs vs previous dataset | Result |',
             '|---|---|---:|---:|---|']
    for market in ('mumbai', 'thane', 'kalyan'):
        batch = [r for r in today if r['market'] == market]
        result = 'All 4 reported pages fetched' if market == 'mumbai' else ('Page 1 saved; published page 2 still HTTP 404 (208 advertised results)' if market == 'thane' else 'Single reported page fetched; no resolved Khadakpada listing')
        lines.append(f"| MagicBricks | {market} | {len(batch)} | {len({r['listing_id'] for r in batch} - old_ids)} | {result} |")
    lines.extend(['| PropertyWala | Mumbai | 20 | 20 source IDs | One results page captured; eligibility review pending |',
                  '| PropertyWala | Thane search, including wider district | 45 | 45 source IDs | Both results pages captured; eligibility review pending |',
                  '| PropertyWala | Kalyan | 1 | 0 additional beyond Thane batch | Same P243109329 appears in Thane; one detail page captured |', '',
                  'MagicBricks now contains 996 observations / 580 distinct source IDs. Today added 107 observations but only 6 previously unseen source IDs (Mumbai 5, Thane 1, Kalyan 0).', '',
                  'PropertyWala contains 66 observations / 65 distinct IDs. Source IDs are not verified independent parcels. 60 observations have a single numeric price and explicit convertible area; this does not establish eligibility. 18 cards trigger building/commercial-description review and 3 trigger land-use review. Price ranges and missing prices remain null. Mumbai also has repeated 100-crore advertisements requiring duplicate and plausibility review. None entered the unchanged 364-row benchmark.', '',
                  'Kalyan detail P243109329 names Near kalyan station, Kalyan, Thane; the card asks INR 1,500,000 for 1,050 sqft (recomputed INR 1,428.57/sqft). This is not independently located in Khadakpada. Coordinates shown by the source are explicitly approximate.', '',
                  'The current MagicBricks Khadakpada all-property page returned HTTP 200 but its plot links lead to the existing general Kalyan route. Its mixed-property results were not added as plots. The current saved Thane page still publishes the same page-2 URL that returned 404.', '',
                  '## Every target region — MagicBricks', '',
                  'Counts below distinguish latest-run rows from distinct historical source IDs in each requested market. Overlapping searches mean region counts must not be summed as independent properties. Pagination completion is not exhaustive market coverage.', '',
                  '| Region | Latest run rows | Historical distinct IDs | Latest outcome / remaining |', '|---|---:|---:|---|'])
    for market in historic_report['markets']:
        all_market = [r for r in rows if r['market'] == market]
        latest = [r for r in all_market if r['run_id'] == state[market]['run_id']]
        outcome = state[market]['status']
        label = ('Reported pagination fetched; broader source coverage remains' if latest else 'Zero direct results; other sources remain') if outcome == 'complete' else ('Partial; page 2 HTTP 404' if market == 'thane' else 'Route unresolved; HTTP 404')
        report['markets'][market] = {'latest_rows': len(latest), 'historical_distinct_ids': len({r['listing_id'] for r in all_market}), 'status': outcome, 'remaining': label}
        lines.append(f"| {market} | {len(latest)} | {report['markets'][market]['historical_distinct_ids']} | {label} |")
    lines.extend(['', '## Websites still remaining', '',
        '| Website | Collected scope | Remaining scope / blocker |', '|---|---|---|',
        '| MagicBricks | Data in 32 of 36 requested markets | Thane pagination; Khadakpada locality evidence; Shahad unresolved; Kamothe, Rasayani, Vasind zero direct results. New observations still need review. |',
        '| PropertyWala | Mumbai, Thane, Kalyan results batch; one Kalyan detail | Eligibility, freshness, locality and cross-source duplicate review; other 33 target-market searches uncollected. District search cards are not separate completed regional searches. |',
        '| NoBroker | Historical Khadakpada pilot: 3 direct + 7 nearby cards, 3 details | Additional Kalyan and all other 35 target-market searches; prior review unresolved. Not re-requested today. |',
        '| 99acres | None | All 36 markets; historical HTTP 403. Not retried today. |',
        '| Housing.com | Diagnostic evidence only | All 36 markets; historical challenge. Not retried today. |',
        '| Square Yards | No usable listing dataset | All 36 markets; historical HTTP 403 and earlier terms-review stop. Not retried today. |',
        '| RealEstateIndia | None | All 36 markets; earlier HTTP 429, extraction untested. Not retried today. |',
        '| CommonFloor | None | All 36 markets; published navigation discovered, extraction pending. |',
        '| 360plot | None | All 36 markets; local listing availability/extraction pending. |',
        '| Reeltor | No saved usable listing dataset | All 36 markets; search-visible routes require local extraction and locality/area consistency review. |',
        '| MahaRERA | Historical project-search evidence | Supporting track only; usable plot-level price/area data not established. |', '',
        '1acre.in remains a geospatial feature API candidate, not a listing-price collection target.', '',
        '## Evidence and checks', '',
        '- MagicBricks batch: `services/estimatedparcelvalue/pipeline/magicbricks_mmr_data/batch_20260922T111922Z.json`.',
        '- MagicBricks recount: `magicbricks_mmr_data/coverage_quality_20260922T113100Z.json` and CSV under the pipeline.',
        '- PropertyWala raw responses, extracted observations, links and this machine-readable report: `residential_land_pilots/propertywala/20260922_priority/`.',
        '- Khadakpada navigation evidence: `residential_land_pilots/magicbricks/20260922_priority/khadakpada_navigation/`.',
        '- Collection timestamps are retained per response; MagicBricks uses 10-second inter-page and 20-second inter-market waits. PropertyWala requests were sequential and separated by more than 10 seconds (more than 20 between market searches).',
        '- Three offline parser checks cover conversions, price ranges, missing units, category warnings and refusal handling. Raw HTML hashes and source URLs are retained.',
        '- Historical MagicBricks observations are an unchanged prefix of the append-only file; new data does not overwrite the reviewed benchmark.', '',
        'Next work: review the six new MagicBricks IDs and PropertyWala candidates; investigate an alternative published Thane pagination route if one appears; collect the untested sources in Mumbai/Thane/Kalyan before expanding further.'])
    original_bytes = records_path.read_bytes().splitlines(keepends=True)
    old_prefix = b''.join(original_bytes[:len(old)])
    report['original_records_prefix_sha256'] = hashlib.sha256(old_prefix).hexdigest()
    report['original_records_prefix_matches_reviewed_snapshot'] = report['original_records_prefix_sha256'] == '674718ad6d518bf3e330cc085828c47d53ced4f7f44dbedf082cda4a774a4da5'
    assert report['original_records_prefix_matches_reviewed_snapshot'], 'Original collection prefix changed'
    (PILOT / 'priority_status.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    destination = REPO / 'codex/RESIDENTIAL_LAND_COLLECTION_STATUS_20260922.md'
    destination.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(destination)
    print(json.dumps({k: v for k, v in report.items() if k != 'markets'}, indent=2))


if __name__ == '__main__':
    main()
