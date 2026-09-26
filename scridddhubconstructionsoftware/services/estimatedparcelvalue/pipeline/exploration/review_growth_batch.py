"""Review new details and recount all saved RealEstateIndia search responses.

All output is versioned; benchmark promotion is deliberately a separate step.
"""
import hashlib
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urldefrag

from review_alternate_batch import ROOT, load_page, realestateindia
sys.path.insert(0,str(Path(__file__).parent/'propertywala'))
from review_detail_batch import extract


def read_rows(path):
    return [json.loads(s) for s in path.read_text(encoding='utf-8').splitlines() if s.strip()]


def propertywala_reviews():
    base=ROOT/'residential_land_pilots/propertywala'
    old=base/'20260922_priority'
    prior={r['listing_id']:r for r in read_rows(old/'review_20260922T190153436976Z/detail_reviews.jsonl')}
    responses={}
    for p in base.rglob('response.json'):
        meta=json.loads(p.read_text(encoding='utf-8'))
        if meta.get('status')==200 and (p.parent.name.startswith('detail_') or p.parent.parent.name=='detail_batch_20260922'):
            responses[urldefrag(meta.get('url') or meta['source_card_url'])[0]]=(p.parent,meta)
    cards={r['listing_id']:r for r in read_rows(old/'observations.jsonl')}
    rows=[]
    for ident,card in cards.items():
        if ident in prior:
            rows.append(prior[ident]);continue
        url=urldefrag(card['url'])[0]
        if url not in responses:
            rows.append({**card,'review_status':'detail_not_captured'});continue
        path,meta=responses[url]
        assert hashlib.sha256((path/'body.bin').read_bytes()).hexdigest()==meta['sha256']
        data=extract((path/'body.bin').read_bytes())
        description=data['sections'].get('Description','')
        if re.search(r'\bagricultural land\b',description,re.I):
            decision,reason='exclude_agricultural_description','Detail describes agricultural land; keep outside residential-vacant-plot dataset.'
        elif re.search(r'\b(apartments?|BHK|mall|commercial shops|office spaces|flats)\b',description,re.I):
            decision,reason='hold_building_category_conflict','Detail describes apartments, shops or built property despite the residential-land card; no independently verified vacant plot offer.'
        elif data['page_kind']=='project':
            decision,reason='hold_project_configuration','Project-level inventory/configuration without identified parcel; source date, locality and cross-source duplication need resolution.'
        else:
            decision,reason='candidate_pending_locality_and_duplicates','Residential plot candidate; exact locality and parcel independence still need review.'
        rows.append({**card,**data,'review_status':decision,'review_reason':reason,'canonical_document_url':url,
                     'detail_raw_path':str((path/'body.bin').relative_to(ROOT)),'detail_sha256':meta['sha256'],
                     'detail_observed_at':meta['observed_at'],'admitted_to_benchmark':False})
    return rows


REI_DECISIONS={
 '1175286':('hold_price_display_conflict','Search says 9.82 lakh, detail header says Call for Price while description retains 9.82 lakh. Broad Kalyan Dombivali locality; not Khadakpada.'),
 '1479205':('hold_mixed_use','Detail suggests either residential or commercial development; intended residential-vacant-plot comparability unresolved.'),
 '1490680':('candidate_pending_locality_and_duplicates','Residential 3700 sqft / 41.11 lakh plot in Badlapur. Price/area consistent; Tara Angan project, exact locality and independent-parcel verification pending.'),
 '1342062':('hold_rate_and_project_conflict','19 lakh total / 4475 sqft but header also says 19 lakh per sqft. Description Murbad; project panel identifies Kharghar/apartments. Preserve conflicting evidence.'),
 '1454362':('hold_project_and_rate_conflict','Vision Aanand: 14.50 lakh / 2325 sqft (~624/sqft), description offers 599/sqft and generic starting plots; unallocated project inventory.'),
 '1396889':('hold_cross_source_project','Rustomjee Belle Vue: 71 lakh / 2200 sqft, erroneous 71 lakh/sqft display, generic 68-lakh starting offer. Same project as PropertyWala P194563462/P732945634.')}


def main():
    out=ROOT/'residential_land_pilots'/('growth_review_'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
    out.mkdir()
    pw=propertywala_reviews()
    base=ROOT/'residential_land_pilots/realestateindia'
    details=[];cards=[];pages=[]
    for p in base.rglob('response.json'):
        meta=json.loads(p.read_text(encoding='utf-8'))
        if meta.get('status')!=200 or p.parent.name=='robots':continue
        if '/property-detail/' in meta.get('url',''):
            ident=re.search(r'-(\d+)\.htm$',meta['url'])[1]
            if ident not in REI_DECISIONS:continue
            m,t=load_page(p.parent);text=t.root.text()
            start=text.find('Listing ID : '+ident)
            # Scope to the offered property's own description and information.
            remainder=text[start:]
            ends=[remainder.find(s) for s in (' Location & Connectivity',' About ',' Amenities ',' Locality Highlights') if remainder.find(s)>0]
            core=remainder[:min(ends)] if ends else remainder[:8000]
            decision,reason=REI_DECISIONS[ident]
            details.append({'source':'realestateindia','listing_id':ident,'url':meta['url'],'observed_at':meta['observed_at'],
                            'raw_path':str((p.parent/'body.bin').relative_to(ROOT)),'raw_sha256':meta['sha256'],
                            'detail_evidence':core,'review_status':decision,'review_reason':reason,'admitted_to_benchmark':False})
        else:
            parsed=realestateindia(p.parent)
            if not parsed:continue
            cards.extend(parsed)
            pages.append({'response_path':str(p.relative_to(ROOT)),'market':meta['requested_market'],'form':meta.get('form'),'observations':len(parsed)})
    previous=read_rows(ROOT/'residential_land_pilots/alternate_review_20260922T193408521265Z/observations.jsonl')
    old_ids={r['listing_id'] for r in previous if r['source']=='realestateindia'}
    by_id=defaultdict(list)
    for row in cards:by_id[row['listing_id']].append(row)
    detail_map={r['listing_id']:r for r in details}
    unique=[]
    for ident,group in by_id.items():
        representative=max(group,key=lambda r:(bool(r['price_rupees'] and r['area_sqft']),r['observed_at']))
        row={**representative,'requested_markets':sorted({r['requested_market'] for r in group}),
             'observation_count':len(group),'evidence_paths':sorted({r['raw_path'] for r in group}),
             'representative_selection':'most complete numeric card, then most recent; not independently verified',
             'numeric_prices_seen':sorted({r['price_rupees'] for r in group if r['price_rupees'] is not None}),
             'numeric_plot_areas_seen':sorted({r['area_sqft'] for r in group if r['area_sqft'] is not None})}
        row['conflicting_numeric_observations']=len(row['numeric_prices_seen'])>1 or len(row['numeric_plot_areas_seen'])>1
        if ident in detail_map:row['review_status']=detail_map[ident]['review_status']
        if ident in ('1202160','1202164'):row['review_status']='exclude_building_category_conflict'
        unique.append(row)
    # Explicit related-project groups, not assertions that the individual parcels match.
    projects=[]
    for label,pattern in [('rustomjee_belle_vue',r'rustomjee.*belle.*vue'),('diviana_park',r'diviana.*park'),('lodha_villa_royale',r'lodha.*villa.*royale')]:
        members=[]
        for source,collection in [('propertywala',pw),('realestateindia',unique)]:
            for row in collection:
                if re.search(pattern,json.dumps(row,ensure_ascii=False),re.I):members.append({'source':source,'listing_id':row['listing_id']})
        projects.append({'project_group':label,'members':members,'status':'related_project_not_confirmed_same_parcel'})
    summary={'reviewed_at':datetime.now(timezone.utc).isoformat(),'propertywala_source_ids':len(pw),
             'propertywala_detail_covered_ids':sum(r['review_status']!='detail_not_captured' for r in pw),
             'propertywala_decisions':dict(Counter(r['review_status'] for r in pw)),
             'new_realestateindia_details_reviewed':len(details),'realestateindia_detail_decisions':dict(Counter(r['review_status'] for r in details)),
             'realestateindia_search_pages':len(pages),'realestateindia_observations':len(cards),'realestateindia_unique_ids':len(unique),
             'realestateindia_new_ids':len(set(by_id)-old_ids),'new_ids':sorted(set(by_id)-old_ids),
             'benchmark_rows_unchanged':364,'approved_additions':0,'planning_target':[5000,10000],
             'remaining_approved_rows':[4636,9636],'progress_percent':[3.64,7.28],'target_is_provisional':True}
    summary['realestateindia_by_requested_market']={market:{'observations':len(group),'distinct_ids':len({r['listing_id'] for r in group})}
        for market in sorted({r['requested_market'] for r in cards})
        for group in [[r for r in cards if r['requested_market']==market]]}
    summary['realestateindia_numeric_unique_candidates']=sum(bool(r['price_rupees'] and r['area_sqft']) for r in unique)
    summary['realestateindia_conflicting_numeric_ids']=sum(r['conflicting_numeric_observations'] for r in unique)
    for name,data in [('propertywala_all_id_reviews',pw),('realestateindia_new_detail_reviews',details),('realestateindia_observations',cards),('realestateindia_unique_listings',unique)]:
        (out/(name+'.jsonl')).write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in data),encoding='utf-8')
    for name,data in [('summary',summary),('search_pages',pages),('cross_source_project_groups',projects)]:
        (out/(name+'.json')).write_text(json.dumps(data,indent=2,ensure_ascii=False),encoding='utf-8')
    print(out);print(json.dumps({k:v for k,v in summary.items() if k!='new_ids'},indent=2))


if __name__=='__main__':main()
