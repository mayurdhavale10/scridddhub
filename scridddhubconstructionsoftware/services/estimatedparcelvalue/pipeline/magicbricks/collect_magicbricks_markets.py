"""Run the requested markets sequentially and record completed and unattempted work."""

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

import magicbricks_residential_plot_crawler as crawler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--markets', nargs='+', choices=crawler.MARKETS, required=True)
    parser.add_argument('--browser', choices=('chrome', 'chromium'), default='chrome')
    parser.add_argument('--headed', action='store_true')
    args = parser.parse_args()
    markets = list(dict.fromkeys(args.markets))
    report = {'started_at': crawler.utcnow(), 'requested_markets': markets, 'results': [], 'unattempted': markets.copy()}
    crawler.OUT_DIR.mkdir(exist_ok=True)
    report_path = crawler.OUT_DIR / f'batch_{crawler.new_run_id()}.json'
    crawler.atomic_json_write(report_path, report)
    for index, market in enumerate(markets):
        if index:
            print('Waiting 20 seconds before the next market.', flush=True)
            time.sleep(20)
        command = [sys.executable, '-B', '-u', str(Path(crawler.__file__).resolve()), '--market', market, '--browser', args.browser]
        if args.headed:
            command.append('--headed')
        print(f'Collecting {index + 1}/{len(markets)}: {market}', flush=True)
        result = subprocess.run(command, check=False)
        state = crawler.load_state().get('markets', {}).get(market, {})
        status = state.get('status', 'unknown') if result.returncode == 0 else 'process_error'
        run_id = state.get('run_id')
        rows = []
        if crawler.RECORDS_PATH.exists():
            for line in crawler.RECORDS_PATH.read_text(encoding='utf-8').splitlines():
                row = json.loads(line)
                if row.get('market') == market and row.get('run_id') == run_id:
                    rows.append(row)
        report['results'].append({'market': market, 'status': status, 'run_id': run_id, 'records': len(rows), 'pages': state.get('fetched_pages', [])})
        report['unattempted'] = markets[index + 1:]
        report['updated_at'] = crawler.utcnow()
        crawler.atomic_json_write(report_path, report)
        if status not in ('complete', 'capped', 'pagination_error', 'not_found'):
            print(f'Batch ended after {market}: {status}. Remaining markets are recorded as unattempted.', flush=True)
            break
    report['finished_at'] = crawler.utcnow()
    crawler.atomic_json_write(report_path, report)
    print(f'Batch report: {report_path.resolve()}', flush=True)


if __name__ == '__main__':
    main()
