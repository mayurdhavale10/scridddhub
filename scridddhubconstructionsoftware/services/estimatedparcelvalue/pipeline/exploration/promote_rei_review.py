"""Offline, evidence-pinned promotion of one REI research observation."""
import json
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from review_targeted_evidence import ROOT, PRIOR, EXPECTED, sha, read, dump, extract, consistent_rate
sys.path.insert(0,str(ROOT/'magicbricks'))
from build_clean_land_data import UNITS
from review_land_baseline import area_band, evaluate, metrics

OUTPUT=ROOT/'residential_land_pilots/benchmark_rei_promotion_20260923'
GROWTH=ROOT/'residential_land_pilots/growth_review_20260923T063928956961Z'

def canonical(text):return re.sub(r'[^a-z0-9]','',str(text).lower())

def signals(row):
    prose=' '.join(str(row.get(k) or '') for k in ['project_name','source_fields','description','card_text','title','sections'])
    compact=canonical(prose)
    locality=str(row.get('source_locality_label') or row.get('locality') or '')
    area=row.get('area_sqft')
    if area is None:
        try:area=float(str(row.get('plot_area') or 0).replace(',',''))*UNITS.get(str(row.get('plot_area_unit')).lower(),0)
        except ValueError:area=0
    result=[]
    if 'gardenkavenue' in compact:result.append('same_project_name')
    if 'grouprajproperties' in compact:result.append('same_seller_name')
    if 'virar' in locality.lower() and area and abs(area-595)<=59.5:result.append('same_locality_area_within_10_percent')
    if 'virar' in locality.lower() and row.get('price_rupees')==5000000:result.append('same_broad_locality_price_only')
    return result,area

def assert_admission(row):
    assert row['listing_date_parsed'] and 0<=row['listing_age_days_at_capture']<=180
    assert 0<row['area_sqft']<=10000 and row['price_inr']>0
    assert consistent_rate(row['price_inr'],row['area_sqft'],row['source_rate_inr_sqft'])
    assert row['blocking_reasons']==[] and row['duplicate_screen_complete']
    assert row['source_locality']=='Virar West' and not row['khadakpada_verified']

def main():
    for p,h in EXPECTED.items():assert sha(p)==h
    source=next(r for r in read(GROWTH/'realestateindia_unique_listings.jsonl') if r['listing_id']=='1476394')
    detail=ROOT/'residential_land_pilots/realestateindia/20260923_dated_candidates/detail_1476394/body.bin'
    meta=json.loads((detail.parent/'response.json').read_text(encoding='utf-8'))
    assert sha(ROOT/source['raw_path'])==source['raw_sha256']
    assert meta['status']==200 and sha(detail)==meta['sha256']
    parsed=extract(detail.read_text(encoding='utf-8'))
    assert parsed['listing_id']=='1476394' and parsed['source_rate']==8403
    assert 'Posted on : 16 Apr, 2026' in source['card_text']
    assert 'Property Type Residential Plots' in parsed['detail_core']
    assert 'Ownership Leasehold' in parsed['detail_core'] and 'Area 595 Sq.ft.' in parsed['detail_core']
    paths=[ROOT/'magicbricks_mmr_data/records.jsonl',GROWTH/'realestateindia_unique_listings.jsonl',GROWTH/'propertywala_all_id_reviews.jsonl']
    scan=[];all_ids=set()
    for p in paths:
        for row in read(p):
            ident=(row['source'],row['listing_id']);all_ids.add(ident)
            if ident==('realestateindia','1476394'):continue
            matches,area=signals(row)
            if matches:
                scan.append(dict(source=row['source'],listing_id=row['listing_id'],signals=matches,
                    area_sqft=area,price_rupees=row.get('price_rupees'),
                    locality=row.get('source_locality_label') or row.get('locality'),
                    decision='price_only_not_identity_match' if matches==['same_broad_locality_price_only'] else 'requires_review'))
    assert not any(r['decision']=='requires_review' for r in scan),'New matching evidence requires manual review'
    # All observation variants were screened, then matches are collapsed by ID.
    scan=list({(r['source'],r['listing_id']):r for r in scan}.values())
    observed=meta['observed_at'];posted='2026-04-16T00:00:00+00:00'
    row=dict(source,source_listing_id='1476394',listing_id='realestateindia:1476394',
        city='Mumbai',market='mumbai',source_locality='Virar West',resolved_locality=None,
        locality_key='mumbai | virar west',project_name='Garden k Avenue',ownership='Leasehold',
        price_inr=5000000,area_sqft=595,asking_rate_inr_sqft=5000000/595,source_rate_inr_sqft=8403,
        rate_relative_disagreement=abs(8403-5000000/595)/(5000000/595),
        listing_date_parsed=posted,listing_age_days_at_capture=(datetime.fromisoformat(observed)-datetime.fromisoformat(posted)).total_seconds()/86400,
        fetched_at=observed,listing_date_evidence='Saved search card; detail omission does not invalidate an explicit card date.',
        detail_raw_path=str(detail.relative_to(ROOT)),detail_raw_sha256=sha(detail),detail_observed_at=observed,
        property_category='Residential Plot',land_use_status='source_label_only_unverified',
        coordinate_status='not_used_unverified',latitude=None,longitude=None,
        benchmark_segment='individual_or_unknown',segment='individual_or_unknown',area_band=area_band(595),
        evidence_cluster_id='realestateindia_garden_k_avenue_virar_west',property_group_id='realestateindia_1476394',
        admitted_to_benchmark=True,decision='admit_research_observation',review_status='approved_research_observation',
        review_version='rei-promotion-1.0',blocking_reasons=[],duplicate_screen_complete=True,
        cross_source_duplicate_status='no_supported_match_in_saved_corpus_not_proof_of_independence',
        flags=['source_locality_unverified','physical_parcel_identity_unverified','leasehold_source_claim'],
        khadakpada_verified=False,
        benchmark_review_decision='Consistent dated source card and explicit plot detail, total/area/displayed rate agree. Saved-corpus duplicate screen has no supported identity match. Project name alone is not evidence of a built apartment or generic size-range offer.',
        review_reason='Approved as one source-reported research asking-price observation; no legal, buildability, approval-authority or independent-parcel verification claimed.')
    assert_admission(row)
    base=read(PRIOR/'benchmark_snapshot.jsonl')
    assert len(base)==365
    assert not any(r['source']=='realestateindia' and str(r.get('source_listing_id',r['listing_id']))=='1476394' for r in base)
    rows=base+[row]
    predictions=evaluate(rows)
    assert rows[:365]==base
    OUTPUT.mkdir(exist_ok=False)
    for name,values in [('benchmark_snapshot.jsonl',rows),('approved_additions.jsonl',[row]),('predictions.jsonl',predictions),('duplicate_screen.jsonl',scan)]:
        (OUTPUT/name).write_text(''.join(json.dumps(v,ensure_ascii=False)+'\n' for v in values),encoding='utf-8')
    dump(OUTPUT/'evidence_manifest.json',dict(card=dict(path=source['raw_path'],sha256=source['raw_sha256'],observed_at=source['observed_at']),
        detail=dict(path=str(detail.relative_to(ROOT)),sha256=sha(detail),observed_at=observed),
        screened_inputs={str(p.relative_to(ROOT)):sha(p) for p in paths},screened_unique_source_ids=len(all_ids),
        prior_benchmarks={str(p.relative_to(ROOT)):h for p,h in EXPECTED.items()}))
    dump(OUTPUT/'summary.json',dict(created_at=datetime.now(timezone.utc).isoformat(),prior_rows=365,
        approved_additions=1,benchmark_rows=366,evidence_clusters=len({r['evidence_cluster_id'] for r in rows}),
        benchmark_sha256=sha(OUTPUT/'benchmark_snapshot.jsonl'),evaluation=metrics(predictions),
        source_counts=dict(Counter(r['source'] for r in rows)),realestateindia_unadmitted_numeric=77,
        dated_within_size_unadmitted=19,undated_within_size=12,oversized=46,
        khadakpada_verified=0,network_requests=0,duplicate_screen_unique_ids=len(all_ids),
        limitations='Source-reported asking prices; no supported duplicate match is not proof of physical independence. Project grouping retained for future same-project additions.'))
    for p,h in EXPECTED.items():assert sha(p)==h
    print((OUTPUT/'summary.json').read_text(encoding='utf-8'))

if __name__=='__main__':main()
