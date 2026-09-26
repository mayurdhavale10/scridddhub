"""Review four targeted detail captures without modifying either reviewed benchmark."""
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'exploration/propertywala'))
from review_saved_pages import Tree
PRIOR=ROOT/'residential_land_pilots/benchmark_review_20260923T073144576096Z'
CAPTURES=ROOT/'residential_land_pilots/realestateindia/20260923_targeted_evidenceAuthorized'
OUTPUT=ROOT/'residential_land_pilots/targeted_review_20260923'
BASE=ROOT/'magicbricks_mmr_data/derived/review_baseline_20260920T171020225465Z/benchmark_snapshot.jsonl'
EXPECTED={BASE:'250762e9678af0e6478a568743e17e8ee06fe089d3fa5009d3d8802831767b86',
          PRIOR/'benchmark_snapshot.jsonl':'d8de57bb1641a033e638c979ee49f99bd1c0895a0540403da3e853728f7f083c'}

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return [json.loads(x) for x in p.read_text(encoding='utf-8').splitlines()]
def dump(p,x):p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')

def extract(raw):
    tree=Tree(raw)
    text=tree.root.text()
    start=text.find('Listing ID :')
    if start<0:raise ValueError('No listing identity in detail')
    end=text.find('Location & Connectivity',start)
    core=text[start:end if end>=0 else len(text)]
    # Rates may be per guntha rather than per square foot. Preserve unit.
    match=re.search(r'₹\s*([\d,.]+)\s*(Lac|Cr)?\.?\s*/\s*(Sq\.ft\.|Guntha)',core)
    rate=float(match[1].replace(',',''))*{'Lac':100000,'Cr':10000000,None:1}[match[2]] if match else None
    unit=match[3] if match else None
    # Only explicitly labelled source listing dates count. Footer render times,
    # cache versions, copyright years and fetch timestamps are not listing dates.
    date=re.search(r'(?:Posted|Updated) on\s*:\s*(\d{1,2} [A-Za-z]{3}, \d{4})',core)
    return dict(listing_id=re.search(r'Listing ID\s*:\s*(\d+)',core)[1],detail_core=core,
                source_rate=rate,source_rate_unit=unit,
                explicit_listing_date=date[1] if date else None,
                full_text=text)

def consistent_rate(total,area,rate):
    return rate is not None and abs(total/area-rate)<=max(1,.05*total/area)

def main():
    for p,h in EXPECTED.items():assert sha(p)==h
    OUTPUT.mkdir(exist_ok=False)
    prior={r['listing_id']:r for r in read(PRIOR/'realestateindia_78_decisions.jsonl')}
    reviews=[];manifest=[]
    for p in sorted(CAPTURES.glob('detail_*/body.bin')):
        meta=json.loads((p.parent/'response.json').read_text(encoding='utf-8'))
        assert meta['status']==200 and sha(p)==meta['sha256']
        parsed=extract(p.read_text(encoding='utf-8'))
        row=prior[parsed['listing_id']]
        rate_sqft=parsed['source_rate'] if parsed['source_rate_unit']=='Sq.ft.' else None
        basis='sqft'
        if parsed['source_rate_unit']=='Guntha':
            # Compare in original unit, avoiding a silent change to the rounded
            # 9800 sqft search-card conversion. Detail explicitly states 9 guntha.
            assert parsed['listing_id']=='1511639' and 'Area 9 Guntha' in parsed['detail_core']
            agrees=consistent_rate(row['price_rupees'],9,parsed['source_rate'])
            basis='9 guntha in detail; card 9800 sqft retained as source-rounded'
        else:agrees=consistent_rate(row['price_rupees'],row['area_sqft'],rate_sqft)
        date=parsed['explicit_listing_date'] or row.get('listing_date_parsed')
        reasons=[]
        if not date:reasons.append('missing_explicit_listing_date')
        if not agrees:reasons.append('displayed_rate_conflicts_with_total_and_area')
        if parsed['listing_id']=='1184056':reasons+=['Karjat_card_vs_Patgaon_Murbad_project_locality','same_project_and_area_candidate_291388']
        if parsed['listing_id']=='1443033':reasons+=['Our_Town_project_members_linked_pending_parcel_identity']
        notes={
          '1452064':'Detail confirms Vare village, Whispering Woods near Neral, 2034 sqft, 18 lakh and 885/sqft. Source locality only; missing listing date remains.',
          '1443033':'Detail confirms 2112 sqft, 29 lakh and 1373/sqft; adds Our Town project. Link with saved Our Town IDs 1451382 and 1346903. No specific plot number or listing date.',
          '1511639':'Detail confirms Juhu, 9 guntha, 50 crore, 5.56 crore/guntha. Arithmetic agrees in original unit. Missing listing date; MMRDA approval is only a source claim.',
          '1184056':'Detail displays 7.25 lakh/Sq.ft. for a 7.25 lakh, 1744 sqft plot (computed about 416/sqft). Do not silently correct. Madhusudan Heritage/Patgaon geography and same-area project member also require resolution.'}
        r=dict(source='realestateindia',listing_id=parsed['listing_id'],url=meta['url'],
            decision='not_admitted',admitted_to_benchmark=False,reasons=reasons,review_reason=notes[parsed['listing_id']],
            price_rupees=row['price_rupees'],area_sqft=row['area_sqft'],source_area_original=row['area_original'],
            source_locality_label=row['source_locality_label'],source_rate=parsed['source_rate'],source_rate_unit=parsed['source_rate_unit'],
            rate_comparison_basis=basis,rate_consistent=agrees,listing_date=date,
            raw_path=str(p.relative_to(ROOT)),raw_sha256=sha(p),observed_at=meta['observed_at'],
            prior_raw_path=row['raw_path'],prior_raw_sha256=row['raw_sha256'],
            prior_reason=row['primary_reason'],detail_core=parsed['detail_core'],
            khadakpada_verified=False)
        assert reasons
        reviews.append(r)
        manifest.append(dict(raw_path=r['raw_path'],sha256=sha(p),observed_at=meta['observed_at'],url=meta['url']))
        (OUTPUT/(r['listing_id']+'_detail_text.txt')).write_text(parsed['full_text'],encoding='utf-8')
    assert len(reviews)==4
    (OUTPUT/'detail_decisions.jsonl').write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in reviews),encoding='utf-8')
    dump(OUTPUT/'raw_manifest.json',manifest)
    groups=[dict(group='our_town_khardi',source='realestateindia',members=['1443033','1451382','1346903'],
                 decision='linked_project_zero_admitted',same_parcel_proven=False,reason='Project identity matches; specific parcels not established across ads.'),
            dict(group='madhusudan_heritage',source='realestateindia',members=['1184056','291388','1014923'],
                 decision='linked_project_zero_admitted',same_parcel_proven=False,reason='1184056 and 291388 both advertise 1744 sqft in same named project; 291388 uses built-up area. Do not count as independent until resolved.')]
    dump(OUTPUT/'additional_duplicate_groups.json',groups)
    dump(OUTPUT/'summary.json',dict(reviewed_at=datetime.now(timezone.utc).isoformat(),detail_pages_captured=4,
         existing_ids_enriched=4,new_listing_ids=0,consistent_rate_evidence=3,missing_listing_dates=3,
         rate_conflicts=1,approved_additions=0,current_benchmark_rows=365,verified_khadakpada=0,
         protected_benchmarks={str(p.relative_to(ROOT)):h for p,h in EXPECTED.items()},
         detail_review_coverage_realestateindia=12,search_discovery_queries=4,
         source_scope='Four existing REI candidates only; no broad pagination or source expansion.',
         next_evidence='Explicit listing dates for 1452064/1511639; date and parcel identity for 1443033; corrected rate, locality and parcel evidence for 1184056.'))
    for p,h in EXPECTED.items():assert sha(p)==h
    print(OUTPUT)

if __name__=='__main__':main()
