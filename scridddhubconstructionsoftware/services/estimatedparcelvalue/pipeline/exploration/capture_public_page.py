"""Save one public response without redirects/retries; pace all run requests.

Caller reviews robots, published navigation and outcomes before the next request.
Existing request URLs in this run are reused, never overwritten.
"""
import argparse
import hashlib
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, build_opener, HTTPRedirectHandler
from urllib.parse import urlencode, urlparse


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('root', type=Path)
    parser.add_argument('label')
    parser.add_argument('url')
    parser.add_argument('--market', default='kalyan-khadakpada')
    parser.add_argument('--form-file', type=Path)
    args = parser.parse_args()
    form = json.loads(args.form_file.read_text(encoding='utf-8')) if args.form_file else None
    args.root.mkdir(parents=True, exist_ok=True)
    previous = [json.loads(p.read_text(encoding='utf-8')) for p in args.root.glob('*/response.json')]
    if any(p['url'] == args.url and p.get('form') == form for p in previous):
        raise SystemExit('URL already captured in this run; reuse saved evidence')
    pacing_history = list(previous)
    pilot_root = next((p for p in args.root.resolve().parents if p.name=='residential_land_pilots'),None)
    if pilot_root:
        for path in pilot_root.rglob('response.json'):
            item=json.loads(path.read_text(encoding='utf-8'))
            if item.get('finished_at') and urlparse(item.get('url','')).hostname==urlparse(args.url).hostname:
                pacing_history.append(item)
    if pacing_history:
        last = max(pacing_history, key=lambda p:p['finished_at'])
        wait = 20 if last['requested_market'] != args.market else 10
        time.sleep(max(0, wait - (datetime.now(timezone.utc)-datetime.fromisoformat(last['finished_at'])).total_seconds()))
    dest = args.root / args.label
    dest.mkdir()
    meta = {'url':args.url, 'requested_market':args.market, 'observed_at':datetime.now(timezone.utc).isoformat(),
            'transport':'urllib, no redirects or retries', 'monotonic_started':time.monotonic(),
            'method':'POST' if form is not None else 'GET','form':form}
    try:
        try:
            response = build_opener(NoRedirect).open(Request(args.url, data=urlencode(form).encode() if form is not None else None, headers={'User-Agent':'ResidentialLandResearch/1.0', 'Accept-Encoding':'identity'}), timeout=40)
        except HTTPError as exc:
            response = exc
        with response:
            body = response.read()
            meta.update(status=response.code, final_url=response.url, headers={k:v for k,v in response.headers.items() if k.lower()!='set-cookie'}, bytes=len(body), sha256=hashlib.sha256(body).hexdigest())
        (dest/'body.bin').write_bytes(body)
        (dest/'body.txt').write_text(body.decode('utf-8',errors='replace'),encoding='utf-8')
        meta['outcome'] = 'received_requires_review' if meta['status']==200 else 'http_error_or_redirect'
    except (URLError, TimeoutError, OSError) as exc:
        meta.update(outcome='transport_error', error=str(exc))
    meta['finished_at'] = datetime.now(timezone.utc).isoformat()
    (dest/'response.json').write_text(json.dumps(meta,indent=2),encoding='utf-8')
    print(json.dumps(meta))
    if meta['outcome']=='transport_error': raise SystemExit(2)


if __name__ == '__main__': main()
