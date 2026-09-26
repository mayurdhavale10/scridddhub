"""Save the conservative policy and two-page review handoff; no promotion."""
import json
from datetime import datetime, timezone
from review_targeted_evidence import ROOT, PRIOR, EXPECTED, sha, read, dump, extract, consistent_rate

OUT=ROOT/'residential_land_pilots/rei_policy_20260923'

def main():
    rows={r['listing_id']:r for r in read(PRIOR/'realestateindia_78_decisions.jsonl')}
    decisions=[]
    for key in ['1476394','1413118']:
        p=ROOT/f'residential_land_pilots/realestateindia/20260923_dated_candidates/detail_{key}/body.bin'
        meta=json.loads((p.parent/'response.json').read_text(encoding='utf-8'))
        assert meta['status']==200 and sha(p)==meta['sha256']
        parsed=extract(p.read_text(encoding='utf-8'))
        assert parsed['listing_id']==key
        row=rows[key]
        age=(datetime.fromisoformat(meta['observed_at'])-datetime.fromisoformat(row['listing_date_parsed'])).days
        assert 0<=age<=180 and row['area_sqft']<=10000
        assert consistent_rate(row['price_rupees'],row['area_sqft'],parsed['source_rate'])
        decision='pending_final_duplicate_and_identity_review' if key=='1476394' else 'not_admitted_project_locality_conflict'
        reason=('Detail explicitly describes a vacant residential plot in Virar West, 595 sqft, 50 lakh, displayed 8403/sqft. Existing search card supplies 16 April 2026 date. No conflicting project-location panel found in saved text. Final cross-source duplicate and project-identity review has not been completed; do not auto-promote.' if key=='1476394' else
                '3500 sqft, 24.47 lakh, displayed 699/sqft agree; search card dated 27 August 2026. Listing says Karjat, but project panel says About Karjat Valley, Marine Lines, Mumbai and mixes agricultural and residential inventory. Configuration/parcel identity unresolved; cannot promote.')
        if key=='1413118':assert 'About Karjat Valley, Marine Lines, Mumbai' in parsed['full_text']
        decisions.append(dict(source='realestateindia',listing_id=key,url=meta['url'],decision=decision,
            reason=reason,admitted_to_benchmark=False,listing_date=row['listing_date_parsed'],
            listing_age_days_at_capture=age,date_evidence_path=row['raw_path'],date_evidence_sha256=row['raw_sha256'],
            price_rupees=row['price_rupees'],area_sqft=row['area_sqft'],displayed_rate=parsed['source_rate'],
            raw_path=str(p.relative_to(ROOT)),raw_sha256=sha(p),observed_at=meta['observed_at']))
        (OUT/f'{key}_detail_text.txt').write_text(parsed['full_text'],encoding='utf-8')
    (OUT/'dated_candidate_decisions.jsonl').write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in decisions),encoding='utf-8')
    groups={key:read(OUT/(key+'.jsonl')) for key in ['large_parcel_queue','undated_within_size_queue','dated_within_size_queue']}
    ids=[r['listing_id'] for group in groups.values() for r in group]
    assert len(ids)==len(set(ids))==78
    assert [len(v) for v in groups.values()]==[46,12,20]
    for p,h in EXPECTED.items():assert sha(p)==h
    dump(OUT/'summary.json',dict(updated_at=datetime.now(timezone.utc).isoformat(),queue_counts={k:len(v) for k,v in groups.items()},
        new_detail_captures=2,new_ids=0,realestateindia_details_reviewed_total=14,
        final_review_pending=1,project_locality_conflict=1,approved_additions=0,
        benchmark_rows=365,verified_khadakpada=0,protected_benchmarks={str(p.relative_to(ROOT)):h for p,h in EXPECTED.items()},
        next_action='Complete saved-evidence duplicate/project-identity check for REI1476394 before deciding admission; do not fetch more undated details.'))
    docs=ROOT.parents[2]/'codex'
    report='''# Residential land current handoff — 23 September 2026

This is the latest state after the user requested implementation of the aggregate findings, then asked for a Markdown update and a clear next step. No more network requests are running.

## What has been done

1. Preserved the original **364-row** benchmark. The existing newer version remains **365 research rows / 246 evidence clusters**, including the previously approved PropertyWala plot near Kalyan station. No rows were added in the latest work.
2. Triaged all **78 numeric RealEstateIndia candidates** and produced the [aggregate blocker breakdown](REALESTATEINDIA_BLOCKER_BREAKDOWN_20260923.md). This established that missing dates are systemic: 33/74 in the remaining numeric subset, and 759/802 full cards in the broader saved source inventory. The 10 detail pages sampled at that point omitted explicit listing dates.
3. Implemented a conservative policy that keeps the current admission rules. Missing dates are not replaced by capture times; oversized parcels are not mixed into the existing size segment; known rate/locality contradictions remain blockers.
4. Created **three non-overlapping queues covering all 78 IDs**:

| Queue | IDs | Treatment |
|---|---:|---|
| Above 10,000 sqft | 46 | Separate large-parcel review queue; outside current benchmark |
| Within 10,000 sqft, no posted date | 12 | Date-unknown review queue; not training or benchmark data |
| Within 10,000 sqft, source date available | 20 | Eligible for further evidence review, not automatically approved |
| Total | 78 | No duplicated IDs across queues |

The 12 undated count excludes oversized parcels; there are 36 undated IDs across all 78. The dated queue includes prior reviews, so it is not 20 fresh detail requests.

5. Captured **two additional dated candidates' public detail pages**, both HTTP 200, with raw bytes, timestamps and hashes:

| Candidate | Findings | Current decision |
|---|---|---|
| REI1476394 — Garden k Avenue, Virar West | Detail describes residential plot; 595 sqft, Rs 50 lakh, Rs 8,403/sqft agree. Saved search card supplies 16 April 2026 date. | **Final duplicate/project-identity check pending.** Not promoted. |
| REI1413118 — Karjat Valley | 3,500 sqft, Rs 24.47 lakh and Rs 699/sqft agree; dated 27 August 2026. Project panel says Marine Lines while listing says Karjat, and contains mixed agricultural/residential inventory. | **Not admitted:** project-location/configuration identity unresolved. |

RealEstateIndia detail coverage is now **14 saved IDs**, including the two older Khadakpada exclusions. These are detail-enrichment requests for existing IDs, not new listing volume. Source totals remain REI 1,079 IDs, PropertyWala 65 IDs and MagicBricks 580 IDs.

## What happens next

**First: finish the offline duplicate and project-identity check for REI1476394.** If its remaining checks pass, create a separate 366-row benchmark version; otherwise record the concrete blocker. No admission is promised.

Then review the dated, size-eligible queue by remaining evidence need. Do not grind through undated detail pages looking for a date the sampled template does not expose. Do not fetch the 46 oversized parcels unless a separate large-parcel research scope is deliberately approved. Broad scraping, MagicBricks Thane pagination and Shahad remain deferred.

**Khadakpada verified coverage is still zero.** No new Khadakpada request or qualifying lead was added in this two-page batch. Keep it as the priority for genuinely new residential-plot discovery through permitted routes.

## Files

Paths relative to `services/estimatedparcelvalue/pipeline/`:

- Policy, three queues, two decisions, extracted text and summary: `residential_land_pilots/rei_policy_20260923/`
- New raw pages and response metadata: `residential_land_pilots/realestateindia/20260923_dated_candidates/`
- Current 365-row benchmark: `residential_land_pilots/benchmark_review_20260923T073144576096Z/benchmark_snapshot.jsonl`
- Aggregate counts: `residential_land_pilots/rei_blocker_aggregate_20260923/`

Queue reconciliation, two raw-response hashes, arithmetic checks, date-window checks and both protected benchmark hashes passed. The preceding targeted batch had 50 passing tests; the aggregate and policy handoffs add offline reconciliation checks, not a new model evaluation. Model performance is unchanged because the benchmark is unchanged.
'''
    (docs/'RESIDENTIAL_LAND_CURRENT_STATUS_20260923.md').write_text(report,encoding='utf-8')
    guide=docs/'GUIDE_FOR_LLM_CODEX.md'
    old=guide.read_text(encoding='utf-8')
    title,rest=old.split('\n',1)
    guide.write_text(title+'\n\n## Current handoff — read first\n\nRead [the current status and next step](RESIDENTIAL_LAND_CURRENT_STATUS_20260923.md). The user authorized continuation after the aggregate report. Existing benchmark rules were retained and 78 REI candidates partitioned into 46 oversized, 12 undated within-size, and 20 dated within-size records. Two dated details were captured: REI1476394 awaits final offline duplicate/identity review; REI1413118 has a project-locality conflict. No new promotions: benchmark 365, Khadakpada verified zero. This supersedes the historical stop instruction below. The next step is the saved-evidence check for REI1476394, not another broad scrape.\n\n## Earlier handoff history\n'+rest,encoding='utf-8')
    print(json.dumps(dict(status=str(docs/'RESIDENTIAL_LAND_CURRENT_STATUS_20260923.md'),queues={k:len(v) for k,v in groups.items()},benchmark_rows=365,new_promotions=0),indent=2))

if __name__=='__main__':main()
