"""Capture a capped, sequential detail-page batch from saved PropertyWala cards."""
import hashlib
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, build_opener, HTTPRedirectHandler

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'residential_land_pilots/propertywala/20260922_priority/observations.jsonl'
OUT = ROOT / 'residential_land_pilots/propertywala/20260922_priority/detail_batch_20260922'


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def main():
    rows = [json.loads(line) for line in SOURCE.read_text(encoding='utf-8').splitlines() if line.strip()]
    selected, seen = [], set()
    for row in rows:
        if row['listing_id'] in seen or not row.get('url') or not row.get('price_rupees') or not row.get('area_sqft'):
            continue
        if row.get('review_flags'):
            continue
        seen.add(row['listing_id'])
        selected.append(row)
        if len(selected) == 20:
            break
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {'started_at': datetime.now(timezone.utc).isoformat(), 'requested': len(selected), 'results': []}
    for index, row in enumerate(selected):
        if index:
            time.sleep(10)
        target = OUT / row['listing_id']
        target.mkdir(exist_ok=True)
        meta = {'listing_id': row['listing_id'], 'source_card_url': row['url'], 'requested_market': row['requested_market'],
                'observed_at': datetime.now(timezone.utc).isoformat(), 'transport': 'urllib; no redirects/retries; sequential 10-second pacing'}
        try:
            request = Request(row['url'], headers={'User-Agent': 'Mozilla/5.0'})
            try:
                response = build_opener(NoRedirect).open(request, timeout=40)
            except HTTPError as exc:
                response = exc
            with response:
                body = response.read()
                meta.update(status=response.code, final_url=response.url, headers=dict(response.headers.items()), bytes=len(body), sha256=hashlib.sha256(body).hexdigest())
            (target / 'body.bin').write_bytes(body)
            (target / 'body.txt').write_text(body.decode('utf-8', errors='replace'), encoding='utf-8')
        except (URLError, TimeoutError, OSError) as exc:
            meta.update(outcome='transport_error', error=str(exc))
        else:
            meta['outcome'] = 'received_requires_review' if meta.get('status') == 200 else 'http_error'
        (target / 'response.json').write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding='utf-8')
        manifest['results'].append(meta)
        manifest['updated_at'] = datetime.now(timezone.utc).isoformat()
        (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding='utf-8')
        print(json.dumps({'index': index + 1, 'listing_id': row['listing_id'], 'status': meta.get('status'), 'outcome': meta.get('outcome')}), flush=True)
    manifest['finished_at'] = datetime.now(timezone.utc).isoformat()
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding='utf-8')


if __name__ == '__main__':
    main()
