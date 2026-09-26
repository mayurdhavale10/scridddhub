"""Run a reviewed JSON URL plan, sequentially, with resumable evidence and stops."""
import argparse
import hashlib
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urldefrag, urlparse
from urllib.robotparser import RobotFileParser

ROOT = Path(__file__).resolve().parents[1]


def request_key(url, form=None):
    return urldefrag(url)[0], json.dumps(form,sort_keys=True)


def result_ids(body):
    return frozenset(re.findall(r'/property-detail/[^\s"<>]*?-(\d+)\.htm',body))


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('plan', type=Path)
    args = p.parse_args()
    plan = json.loads(args.plan.read_text(encoding='utf-8'))
    assert 0 < len(plan['requests']) <= 20, 'Review batches before expanding'
    output = ROOT / plan['output']
    output.mkdir(parents=True, exist_ok=True)
    robots_path = ROOT / plan['robots_path']
    robots_raw = robots_path.read_bytes()
    assert hashlib.sha256(robots_raw).hexdigest() == plan['robots_sha256']
    robots = RobotFileParser(); robots.parse(robots_raw.decode('utf-8').splitlines())
    existing = {}
    previous_results=set()
    for path in (ROOT/'residential_land_pilots').rglob('response.json'):
        m=json.loads(path.read_text(encoding='utf-8'))
        url=m.get('url') or m.get('source_card_url')
        if url and m.get('status')==200: existing[request_key(url,m.get('form'))]=str(path.relative_to(ROOT))
        if m.get('form') and urlparse(url or '').hostname==plan['hostname'] and m.get('status')==200:
            body=(path.parent/'body.bin').read_bytes().decode('utf-8',errors='replace')
            ids=result_ids(body)
            if ids:previous_results.add(ids)
    manifest={'started_at':datetime.now(timezone.utc).isoformat(),'plan_path':str(args.plan),'plan_sha256':hashlib.sha256(args.plan.read_bytes()).hexdigest(),'results':[]}
    for item in plan['requests']:
        url = urldefrag(item['url'])[0]
        key = request_key(url,item.get('form'))
        assert urlparse(url).hostname == plan['hostname']
        assert robots.can_fetch('ResidentialLandResearch/1.0',url), 'Robots-disallowed URL'
        if key in existing:
            manifest['results'].append({**item,'outcome':'reused_saved_response','response_path':existing[key]})
        else:
            command=[sys.executable,str(Path(__file__).with_name('capture_public_page.py')),str(output),item['label'],url,'--market',item['market']]
            if 'form' in item:
                form_path=output/(item['label']+'_form.json')
                form_path.write_text(json.dumps(item['form']),encoding='utf-8')
                command.extend(['--form-file',str(form_path)])
            r=subprocess.run(command,capture_output=True,text=True,encoding='utf-8',errors='replace')
            path=output/item['label']/'response.json'
            if not path.exists(): raise RuntimeError(r.stderr or r.stdout)
            meta=json.loads(path.read_text(encoding='utf-8'))
            entry={**item,'outcome':meta['outcome'],'status':meta.get('status'),'response_path':str(path.relative_to(ROOT))}
            body_path=path.parent/'body.bin'
            text=body_path.read_bytes().decode('utf-8',errors='replace').lower() if body_path.exists() else ''
            if any(token in text for token in ('<title>just a moment','<title>access denied','<title>attention required','verify you are human','<title>captcha')):
                entry['outcome']='challenge_stop'
            if item.get('form') and meta.get('status')==200 and entry['outcome']!='challenge_stop':
                ids=result_ids(text)
                entry['response_listing_ids']=len(ids)
                if not ids:entry['outcome']='empty_results_stop'
                elif ids in previous_results:entry['outcome']='repeated_results_stop'
                else:previous_results.add(ids)
            manifest['results'].append(entry)
            print(json.dumps({k:entry[k] for k in ('label','market','outcome','status','response_listing_ids') if k in entry}),flush=True)
            if meta.get('status')!=200 or entry['outcome'].endswith('_stop'):
                manifest['stop_reason']=entry['outcome']
                break
            existing[key]=str(path.relative_to(ROOT))
        manifest['updated_at']=datetime.now(timezone.utc).isoformat()
        (output/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    manifest['finished_at']=datetime.now(timezone.utc).isoformat()
    (output/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    if manifest.get('stop_reason')=='transport_error': raise SystemExit(2)


if __name__=='__main__': main()
