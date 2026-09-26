"""Validate and publish the saved-evidence promotion handoff."""
import json
import subprocess
import sys
from collections import Counter
from datetime import datetime, timezone
from promote_rei_review import ROOT, OUTPUT, PRIOR, EXPECTED, read, dump, sha

def main():
    validation=OUTPUT/'validation';validation.mkdir(exist_ok=True)
    tests=[]
    for directory,count in [('magicbricks',25),('exploration/propertywala',6),('exploration',23)]:
        run=subprocess.run([sys.executable,'-X','utf8','-m','unittest','discover','-s',directory,'-p','test_*.py','-v'],cwd=ROOT,capture_output=True,text=True,encoding='utf-8')
        (validation/(directory.replace('/','_')+'.txt')).write_text(run.stdout+run.stderr,encoding='utf-8')
        assert run.returncode==0 and f'Ran {count} tests' in run.stderr,run.stderr
        tests.append(dict(directory=directory,passed=count))
    for p,h in EXPECTED.items():assert sha(p)==h
    for item in json.loads((OUTPUT/'evidence_manifest.json').read_text(encoding='utf-8')).values():
        if isinstance(item,dict) and 'path' in item:assert sha(ROOT/item['path'])==item['sha256']
    summary=json.loads((OUTPUT/'summary.json').read_text(encoding='utf-8'))
    assert sha(OUTPUT/'benchmark_snapshot.jsonl')==summary['benchmark_sha256']
    dump(validation/'results.json',dict(checked_at=datetime.now(timezone.utc).isoformat(),tests=tests,total_passed=54,
        original_364_and_365_preserved=True,new_benchmark_sha256=summary['benchmark_sha256']))
    # Preserve historical queues and create a current action ledger instead.
    prior_rows=read(ROOT/'residential_land_pilots/rei_policy_20260923/dated_within_size_queue.jsonl')
    overrides={}
    for p in [ROOT/'residential_land_pilots/targeted_review_20260923/detail_decisions.jsonl',
              ROOT/'residential_land_pilots/rei_policy_20260923/dated_candidate_decisions.jsonl']:
        for r in read(p):overrides[r['listing_id']]=r
    queue=[]
    for r in prior_rows:
        if r['listing_id']=='1476394':continue
        decision=overrides.get(r['listing_id'],{})
        if r['primary_reason'] in ['apartment','existing_building']:
            action='exclude_built_property_no_detail_request'
        elif r['listing_id']=='1152083':action='prior_503_no_retry'
        elif r['primary_reason']=='project_inventory' and r['listing_id']!='1413118':
            action='needs_parcel_specific_offer_not_another_generic_page'
        else:action='needs_corrected_or_independent_evidence_of_recorded_conflict'
        queue.append(dict(listing_id=r['listing_id'],action=action,source_url=r['url'],
            reason=decision.get('reason') or decision.get('review_reason') or r['review_reason'],
            listing_date=r['listing_date_parsed'],area_sqft=r['area_sqft'],admitted_to_benchmark=False))
    assert len(queue)==19
    (OUTPUT/'remaining_dated_actions.jsonl').write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in queue),encoding='utf-8')
    counts=dict(Counter(r['action'] for r in queue))
    dump(OUTPUT/'remaining_action_counts.json',counts)
    docs=ROOT.parents[2]/'codex'
    report=f'''# Residential land promotion — 23 September 2026

Latest completed work: final saved-evidence review of RealEstateIndia **1476394**, Garden k Avenue, Virar West. **One actual admission** creates a new **366-row / 247-evidence-cluster research benchmark**. Both prior snapshots (364 and 365 rows) remain hash-unchanged. No new network requests were made.

## Admission evidence and limits

- Explicit residential-plot description in the saved detail, with source-reported leasehold tenure; project name alone does not establish a built apartment or a size-range offer.
- 595 sqft, Rs 50 lakh total and displayed Rs 8,403/sqft agree (computed Rs 8,403.36/sqft).
- Explicit source-card date: 16 April 2026, within 180 days at the saved detail capture. Detail-page date omission does not invalidate the card's date.
- Locality remains source-reported Virar West, Mumbai; no independently verified address, coordinates, legal status or approval-body claim is adopted.
- Duplicate screening covers all saved observations in the 580-ID MagicBricks corpus, 1,079-ID REI corpus and 65-ID PropertyWala corpus: **1,724 source IDs**. No other normalized project/seller match or similar-size Virar match was found. A Rs 50 lakh MagicBricks offer advertises 2,500 sqft; matching price alone is insufficient to identify the parcel.
- Admission is **one research asking-price observation**, not certification of an independent physical parcel. Its project evidence cluster must be reused if future Garden k Avenue offers are linked.

## Benchmark and validation

Source composition: **364 MagicBricks + 1 PropertyWala + 1 RealEstateIndia = 366 rows**. These rows are not 366 verified independent parcels.

Current snapshot, relative to `services/estimatedparcelvalue/pipeline/`:
`residential_land_pilots/benchmark_rei_promotion_20260923/benchmark_snapshot.jsonl`

SHA-256: `{summary['benchmark_sha256']}`.

The same directory contains the approved-addition record, raw evidence manifest, duplicate-screen findings, predictions, summary, remaining dated action ledger and validation logs.

**54 tests passed**: 25 MagicBricks, 6 PropertyWala and 23 exploration. Tests cover preserved snapshots, one source-qualified addition, date/area/rate admission failures, duplicate signals and cluster-separated folds. Referenced evidence hashes verified.

Evaluation: **66 scored / 300 abstained**, median absolute percentage error **31.54%**, unchanged. The new observation has insufficient local comparables, so no accuracy improvement is claimed.

## Remaining work, after admission

Of the original 78 numeric REI candidates, **77 remain unadmitted**:

| Queue | Remaining |
|---|---:|
| Above 10,000 sqft | 46 |
| Within size, missing date | 12 |
| Dated and within size | 19 |

The 19 dated candidates are not 19 automatic new requests. Their current action ledger separates built properties (exclude without another fetch), the prior 503 (no retry), generic project offers (need parcel-specific evidence), and actual price/locality/land-use conflicts (need corrected or independent evidence). The ledger preserves the latest captured findings instead of reverting to stale card-only reasons.

Action counts: `{json.dumps(counts,sort_keys=True)}`.

**Next priority:** obtain genuinely new, permitted Khadakpada residential-plot evidence or a published correction/parcel-specific document for one of the remaining dated candidates. Do not blindly fetch details for the 12 undated or 46 oversized rows. Khadakpada verified coverage is still **zero**. Broad scraping, MagicBricks Thane pagination and Shahad remain deferred. Existing cross-source project exclusions and one-representative caps remain in force.
'''
    (docs/'RESIDENTIAL_LAND_PROMOTION_STATUS_20260923.md').write_text(report,encoding='utf-8')
    current=docs/'RESIDENTIAL_LAND_CURRENT_STATUS_20260923.md'
    old=current.read_text(encoding='utf-8')
    note='> Superseded by [the completed promotion status](RESIDENTIAL_LAND_PROMOTION_STATUS_20260923.md): REI1476394 admitted after final review; new benchmark **366 rows**, 54 tests passed. The pending-check text below is historical.\n\n'
    if note not in old:current.write_text(note+old,encoding='utf-8')
    guide=docs/'GUIDE_FOR_LLM_CODEX.md'
    old=guide.read_text(encoding='utf-8');title,rest=old.split('\n',1)
    note='\n\n## Latest completed promotion — read first\n\nRead [the promotion status](RESIDENTIAL_LAND_PROMOTION_STATUS_20260923.md). Garden k Avenue REI1476394 passed the final saved-evidence check and is admitted as a source-reported research observation. Current benchmark: **366 rows / 247 clusters**; prior 364/365 snapshots preserved. Fifty-four tests pass. Current artifacts: `pipeline/residential_land_pilots/benchmark_rei_promotion_20260923/`. Remaining REI numeric pool: 46 oversized, 12 undated within size, 19 dated within size; see remaining_dated_actions.jsonl before making requests. Khadakpada verified coverage zero. No network requests in this promotion. Historical pending-check instructions below are superseded.\n\n'
    if '## Latest completed promotion — read first' not in old:guide.write_text(title+note+rest,encoding='utf-8')
    print(json.dumps(dict(tests_passed=54,benchmark_rows=366,remaining_dated_actions=counts,report=str(docs/'RESIDENTIAL_LAND_PROMOTION_STATUS_20260923.md')),indent=2))

if __name__=='__main__':main()
