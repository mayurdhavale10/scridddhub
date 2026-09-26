"""Verify a growth review, preserve validation logs, and write the handoff report."""
import argparse
import hashlib
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from collections import Counter
from run_permitted_batch import result_ids

ROOT=Path(__file__).resolve().parents[1]
REPO=ROOT.parents[2]


def main():
    p=argparse.ArgumentParser();p.add_argument('review',type=Path);args=p.parse_args()
    review=args.review.resolve()
    summary=json.loads((review/'summary.json').read_text(encoding='utf-8'))
    validation=review/'validation';validation.mkdir()
    tests=[]
    for index,(directory,expected) in enumerate([('magicbricks',25),('exploration/propertywala',6),('exploration',10)],1):
        command=[sys.executable,'-m','unittest','discover','-s',directory,'-p','test_*.py','-v']
        run=subprocess.run(command,capture_output=True,text=True,encoding='utf-8',errors='replace',cwd=ROOT)
        (validation/f'tests_{index}.txt').write_text(run.stdout+run.stderr,encoding='utf-8')
        assert run.returncode==0,run.stderr
        assert f'Ran {expected} tests' in run.stderr
        tests.append({'directory':directory,'passed':expected,'returncode':run.returncode})
    before=json.loads((ROOT/'residential_land_pilots/propertywala/20260922_priority/review_20260922T190153436976Z/summary.json').read_text())['protected_hashes_before']
    for name,expected in before.items():assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==expected,name
    raw=[];failures=[]
    for source in ['propertywala','realestateindia','commonfloor','360plot']:
        for run_dir in (ROOT/'residential_land_pilots'/source).glob('20260923*'):
            if not run_dir.is_dir() or run_dir.name=='20260923_priority':continue
            for meta_path in run_dir.glob('*/response.json'):
                meta=json.loads(meta_path.read_text(encoding='utf-8'));body=meta_path.parent/'body.bin'
                if body.exists():
                    assert hashlib.sha256(body.read_bytes()).hexdigest()==meta['sha256'],str(body)
                    raw.append({'path':str(body.relative_to(ROOT)),'sha256':meta['sha256'],'status':meta['status'],'observed_at':meta['observed_at']})
                else:failures.append({'path':str(meta_path.relative_to(ROOT)),'outcome':meta['outcome']})
    page_audit={}
    for market,expected in [('thane',19),('mumbai',22)]:
        base=ROOT/'residential_land_pilots/realestateindia'
        paths=[base/'20260923_priority'/market,base/'20260923_pagination_pilot'/f'{market}_page_2']
        paths+=list((base/f'20260923_{market}_pagination').glob(f'{market}_page_*'))
        paths=[p for p in paths if p.is_dir() and (p/'body.bin').exists()]
        sets=[result_ids((p/'body.bin').read_bytes().decode('utf-8',errors='replace')) for p in paths]
        page_audit[market]={'reported_pages':expected,'saved_pages':len(paths),'empty_pages':sum(not s for s in sets),'repeated_id_sets':len(sets)-len(set(sets))}
    result={'validated_at':datetime.now(timezone.utc).isoformat(),'tests':tests,'tests_passed':sum(t['passed'] for t in tests),
            'protected_hashes':before,'protected_files_unchanged':True,'new_raw_responses_verified':len(raw),
            'raw_responses':raw,'transport_failures':failures,'pagination':page_audit,'approved_additions':0}
    (validation/'preservation_and_tests.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    rel=review.relative_to(ROOT).as_posix();counts=summary['realestateindia_by_requested_market']
    lines=['# Residential land growth batch — 23 September 2026','',
      'This report supersedes the earlier September 23 pilot totals. The user requested continued collection toward a provisional 5,000–10,000 reviewed-row target. The full task remains incomplete.','',
      '## Verified collection totals','',
      '| Source | Observations | Distinct source IDs | Status |','|---|---:|---:|---|',
      '| MagicBricks | 996 | 580 | Existing data unchanged; 364-row research benchmark preserved |',
      '| PropertyWala | 66 | 65 | All 65 IDs have detail review; 25 additional unique documents captured |',
      f"| RealEstateIndia | {summary['realestateindia_observations']} | {summary['realestateindia_unique_ids']} | {summary['realestateindia_new_ids']} IDs new since previous 128-ID pilot; detail/eligibility review incomplete |",
      '| Reeltor | 20 | 20 | Wrong-locality diagnostic; unchanged |','| NoBroker | 10 | 10 | Diagnostic; unchanged |','',
      f"RealEstateIndia added {summary['realestateindia_observations']-139} search observations and {summary['realestateindia_new_ids']} previously unseen source IDs. Repeated appearances are linked in a unique-listing index; IDs are not verified independent parcels.",'',
      '| Requested market | Card/link observations | Distinct source IDs |','|---|---:|---:|']
    lines += [f"| {m} | {c['observations']} | {c['distinct_ids']} |" for m,c in counts.items()]
    lines += ['', 'Counts include related links and broad district results; do not add market ID counts as independent properties. Source locality is retained separately.', '',
      '## Pagination and access outcomes','']
    lines += [f"- RealEstateIndia {m}: {v['saved_pages']}/{v['reported_pages']} reported pages saved; {v['empty_pages']} empty result sets, {v['repeated_id_sets']} repeated result sets." for m,v in page_audit.items()]
    lines += ['- Pagination uses the exact public scroll/load-more form in the saved HTML, including city, page number and other parameters. Robots permits this endpoint. No private/authenticated endpoint was used.',
      '- An individual RealEstateIndia detail returned HTTP 503 after six successful details. That detail batch stopped. Later, after a cooldown and alternate-source work, a distinct public pagination pilot succeeded. The failed detail was not retried.',
      '- CommonFloor robots request returned HTTP 403; no further CommonFloor requests.',
      '- 360plot Kalyan and Thane pages returned HTTP 200 but contained no usable listing cards in the saved HTML. “50+” in an SEO title was not counted as 50 listings.', '',
      '## Reviewed eligibility','',
      'PropertyWala decisions across all 65 IDs:']
    lines += [f'- {k}: {v}.' for k,v in summary['propertywala_decisions'].items()]
    lines += ['', 'Ten Mirador IDs share one project document; three Diviana Park IDs have an agricultural-land description. Many older Mumbai/Thane cards are apartment or mall projects. Generic project configurations remain on hold.', '',
      'Six new RealEstateIndia details were reviewed: one pending Badlapur candidate and five holds for mixed use, price-display conflicts, rates or related projects. Rustomjee Belle Vue overlaps PropertyWala evidence. Two earlier Khadakpada details remain excluded for building-category conflicts.', '',
      f"There are {summary['realestateindia_numeric_unique_candidates']} RealEstateIndia IDs with numeric card price and explicit plot area; this is a screening count, not approved training data. {summary['realestateindia_conflicting_numeric_ids']} IDs have conflicting numeric observations.", '',
      '**Approved additions: 0.** The historical 364-row benchmark is unchanged. Progress against the provisional planning range remains 3.64%–7.28%, leaving 4,636–9,636 approved rows. Raw scraping growth must not be presented as reviewed-dataset completion.', '',
      '## Evidence and validation','',
      'Paths relative to `services/estimatedparcelvalue/pipeline/`:','',
      f'- Authoritative review: `{rel}/`.',
      '- `propertywala_all_id_reviews.jsonl`: one review per saved PropertyWala ID.',
      '- `realestateindia_observations.jsonl`: all saved search observations.',
      '- `realestateindia_unique_listings.jsonl`: deduplicated source-ID index, evidence paths and conflicts.',
      '- `realestateindia_new_detail_reviews.jsonl`: six new per-ID decisions.',
      '- `cross_source_project_groups.json`: related-project candidates, not confirmed same-parcel assertions.',
      '- Raw responses: `residential_land_pilots/<source>/20260923_*/*/body.bin`; metadata and timestamps in sibling `response.json` files. Request plans and batch manifests preserve GET/POST parameters.',
      f"- Validation: `{rel}/validation/`; {result['tests_passed']} tests passed and {len(raw)} new raw-response hashes verified. Both benchmark snapshots and historical observation files remain hash-unchanged.", '',
      '## Next work / remaining','',
      '1. Review the new RealEstateIndia unique-ID queue, prioritizing actual Mumbai/Thane-city/Kalyan addresses, fresh explicit total price and plot area. Exclude buildings, agricultural/commercial offers and generic configurations; resolve project/parcel duplicate candidates before approval.',
      '2. Review published additional Kalyan/Thane locality pagination and relevant unvisited details; the 503 detail and unattempted detail-plan entries remain unresolved. Reuse all successful evidence.',
      '3. MagicBricks: six September 22 IDs need review; Thane pagination, Shahad and Khadakpada gaps remain. Prior zero-result markets remain unresolved across sources.',
      '4. Other 33-market searches for alternate websites remain largely uncollected. NoBroker/Housing/99acres/Square Yards historical access or reuse issues remain; Reeltor property routes remain robots-disallowed. MahaRERA is supporting project evidence, not a plot-price feed.',
      '5. Expand only through relevant permitted sources. Reassess the 5,000–10,000 planning target against actual usable inventory and locality-level model support; do not relax quality to reach it.','']
    destination=REPO/'codex/RESIDENTIAL_LAND_GROWTH_STATUS_20260923.md'
    destination.write_text('\n'.join(lines),encoding='utf-8')
    print(json.dumps({'report':str(destination),'review':str(review),'tests_passed':result['tests_passed'],'raw_hashes_verified':len(raw),'pagination':page_audit},indent=2))


if __name__=='__main__':main()
