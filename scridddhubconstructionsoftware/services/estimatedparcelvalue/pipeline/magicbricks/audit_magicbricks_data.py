"""Summarize saved market coverage and data quality without network requests."""

import csv
import json
import math
from collections import Counter

import magicbricks_residential_plot_crawler as crawler


def number(value):
    try:
        value = float(value)
        return value if math.isfinite(value) else None
    except (TypeError, ValueError):
        return None


def valid_coordinates(row):
    lat, lon = number(row.get('latitude')), number(row.get('longitude'))
    return lat is not None and lon is not None and -90 <= lat <= 90 and -180 <= lon <= 180 and (lat, lon) != (0, 0)


def summarize(rows):
    keys = [(r.get('source'), r.get('market'), r.get('run_id'), r.get('listing_id')) for r in rows]
    return {
        'records': len(rows),
        'unique_listing_ids': len({r['listing_id'] for r in rows}),
        'duplicate_observations': len(keys) - len(set(keys)),
        'nonzero_coordinates_in_global_range': sum(valid_coordinates(r) for r in rows),
        'positive_price_area_rate': sum(all(number(r.get(k)) is not None and number(r.get(k)) > 0 for k in ('price_rupees', 'plot_area', 'price_per_sqft')) for r in rows),
        'area_units': dict(Counter(r.get('plot_area_unit') for r in rows)),
        'categories': dict(Counter(r.get('property_category') for r in rows)),
        'missing_fields': {key: sum(r.get(key) is None or r.get(key) == '' for r in rows) for key in ('url', 'seller_type', 'ownership', 'road_width', 'dimensions', 'posted_date_raw')},
    }


def main():
    rows = [json.loads(line) for line in crawler.RECORDS_PATH.read_text(encoding='utf-8').splitlines() if line.strip()]
    state = crawler.load_state().get('markets', {})
    report = {'generated_at': crawler.utcnow(), 'all_observations': summarize(rows), 'markets': {}}
    for market in crawler.MARKETS:
        current = state.get(market, {})
        observations = [r for r in rows if r.get('market') == market and r.get('run_id') == current.get('run_id')]
        status = current.get('status', 'not_attempted')
        if status == 'complete':
            coverage = 'collected' if observations else 'no_direct_results'
        else:
            coverage = 'partial' if observations else 'unresolved'
        report['markets'][market] = {
            'status': status,
            'coverage': coverage,
            'run_id': current.get('run_id'),
            'fetched_pages': current.get('fetched_pages', []),
            'reported_result_count': current.get('reported_result_count'),
            **summarize(observations),
        }
    report['notes'] = [
        'Rows are asking-price observations, not verified transaction prices.',
        'Coordinate checks establish numeric validity only, not geographic accuracy.',
        'Market is the search market; overlapping results may describe other localities.',
        'Complete describes crawler pagination, not verified coverage of all plots for sale.',
    ]
    path = crawler.OUT_DIR / f'coverage_quality_{crawler.new_run_id()}.json'
    crawler.atomic_json_write(path, report)
    csv_path = path.with_suffix('.csv')
    columns = ('market', 'coverage', 'status', 'run_id', 'records', 'unique_listing_ids', 'reported_result_count', 'nonzero_coordinates_in_global_range', 'duplicate_observations')
    with csv_path.open('w', encoding='utf-8-sig', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=columns, extrasaction='ignore')
        writer.writeheader()
        for market, stats in report['markets'].items():
            writer.writerow({'market': market, **stats})
    print(json.dumps(report['all_observations'], ensure_ascii=False, indent=2))
    print(f'Report saved: {path.resolve()}')
    print(f'City table saved: {csv_path.resolve()}')


if __name__ == '__main__':
    main()
