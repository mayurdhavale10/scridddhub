"""Offline review of the pinned 78-card backlog; creates an immutable new benchmark.

No network. Admissions are research asking-price observations, not verified parcels.
"""
import hashlib
import json
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / 'residential_land_pilots/growth_review_20260923T063928956961Z'
BASE = ROOT / 'magicbricks_mmr_data/derived/review_baseline_20260920T171020225465Z/benchmark_snapshot.jsonl'
BASE_HASH = '250762e9678af0e6478a568743e17e8ee06fe089d3fa5009d3d8802831767b86'
PINNED_INPUTS = {
 'realestateindia_unique_listings.jsonl':'77f01de378139269f4a42f0484cfa3d5026cdf7c102b8adc922b88426d2b4519',
 'propertywala_all_id_reviews.jsonl':'770d929603c4f0c2000456ef8f8165e7f3eb33aba431eb30c4d532a8feb1d402',
 'realestateindia_new_detail_reviews.jsonl':'c6591b948012e2ff36e7cbf5fe7ffe053f51351ab61859e332296b4159ef9aff',
 'cross_source_project_groups.json':'b70cdad08fbd78d72798f539874a4a3d6ba27207838c1822476bda717288b216',
}
sys.path.insert(0, str(ROOT / 'magicbricks'))
from review_land_baseline import evaluate, metrics, area_band
from build_clean_land_data import UNITS

# Explicit reading decisions for every <=10,000 sqft candidate. Larger parcels
# remain outside this experiment's established area segment, not deleted.
DECISIONS = {
 '1435428': ('project_inventory', 'Blue Peaks: starting-price offer and multiple NA villa plots, not an identified parcel.'),
 '1400654': ('category_price_conflict', '33 West: cropped land/food-production language and 2500 crore for 1300 sqft; category and price require correction.'),
 '1359423': ('existing_building', 'Description explicitly includes an independent structure and tower redevelopment.'),
 '1391501': ('project_inventory', '2500 to 10000 sqft inventory, area onwards; 650/sqft is an offer for a range, not one parcel.'),
 '1073996': ('apartment', 'Aagam description explicitly offers flats, not vacant land.'),
 '1365564': ('project_inventory', 'House of Abhinandan Lodha brand promotion, no identified parcel or parcel-specific description.'),
 '1476394': ('project_identity', 'Garden k Avenue leasehold 595 sqft; plot identity versus built-unit project is not established.'),
 '1201535': ('project_inventory', 'Generic developer inventory beside Imagica; no identified parcel or listing date.'),
 '1453389': ('project_inventory', 'Amrai offers 50 plots across 7 acres; quoted configuration is not a distinct parcel.'),
 '1452064': ('missing_date_rate', 'Specific 2034 sqft Vare village plot and 18 lakh agree; card supplies neither listing date nor independently displayed unit rate.'),
 '1442072': ('project_inventory', 'Tulsi Plots project promotion; no identified leasehold parcel or listing date.'),
 '1303127': ('existing_building', 'Explicit three-bedroom bungalow, 1600 sqft carpet, on combined plots 61/62.'),
 '1159736': ('cross_source_project', 'Lodha Villa Royale overlaps PropertyWala configurations; land versus built-villa package unresolved.'),
 '1451382': ('multiple_parcels', 'Owner offers two 4000 sqft plots Q91 and Q99; 25 lakh is not unambiguously assigned to a single parcel.'),
 '1443033': ('missing_date_rate', 'Specific 2112 sqft three-side-open corner plot; no listing date or independently displayed unit rate in saved card.'),
 '1426789': ('project_inventory', 'Vraj Green Valley instalment offer; no plot identifier, listing date or unit-rate evidence.'),
 '1416282': ('building_package', 'Villa23 offers plot AND bungalow; land-only price basis is not established.'),
 '1175286': ('price_locality_conflict', '9.82 lakh card/description versus Call for Price detail header; Kalyan Dombivali is broad, not Khadakpada.'),
 '1428893': ('cross_source_project', 'Diviana Park: Khopoli label versus Malshej/Murbad project, agricultural evidence on PropertyWala.'),
 '1184056': ('locality_rate_review', '1744 sqft / 7.25 lakh resale at Madhusudan Heritage, village Patgaon; Karjat card label differs from Murbad highway description, no displayed unit rate.'),
 '1511639': ('missing_date_rate', 'Juhu 9 guntha / 9800 sqft; no listing date or independently displayed rate. Guntha conversion rounded by source.'),
 '1413118': ('project_inventory', 'Karjat Valley generic NA plot launch; no identified parcel, source rate absent.'),
 '1381884': ('project_inventory', 'Golden Triangle explicitly states sizes start at 1550 sqft with many other sizes.'),
 '1414141': ('apartment', 'Description explicitly says ready-to-move apartment despite residential-land category.'),
 '1387660': ('price_area_conflict', 'IKIGAI card 1862 sqft / 53 lakh differs from promoted 1248 sqft / 39.99 lakh configuration.'),
 '1468893': ('land_use_inventory', 'Premium residential AND farmhouse plots promotional inventory; no identified land-use/parcel basis.'),
 '1490680': ('project_locality_conflict', 'Price 41.11 lakh, 3700 sqft and 1111/sqft agree, but full saved detail links Tara Angan to Sector 13 Kharghar, Navi Mumbai while listing says Badlapur.'),
 '1342062': ('price_project_conflict', '19 lakh total versus erroneous detail 19 lakh/sqft; associated Himanshu Mount View panel is Kharghar, not Murbad.'),
 '1454362': ('project_price_conflict', 'Vision Aanand 170 plots; card 2325 sqft / 14.5 lakh differs from 599/sqft generic offer and starting-price inventory.'),
 '1396889': ('cross_source_project', 'Rustomjee Belle Vue overlap: generic starting price, erroneous detail rate and Andheri East project panel versus Kasara.'),
 '1152083': ('project_inventory', 'C K Hills promotional plotted project, no specific plot identity; prior detail returned 503 and was not retried.'),
 '1278741': ('project_inventory', 'WestWood Hill explicitly offers sizes starting at 1700 sqft with many more sizes.'),
}

def read(path):
    return [json.loads(line) for line in path.read_text(encoding='utf-8').splitlines()]

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def dump(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False)+'\n', encoding='utf-8')

def lines(path, rows):
    path.write_text(''.join(json.dumps(r, ensure_ascii=False)+'\n' for r in rows), encoding='utf-8')

def triage(row):
    if row['area_sqft'] > 10000:
        code, reason = 'outside_area_segment', f"{row['area_sqft']:g} sqft exceeds the existing 10000 sqft research segment; requires a separate large-parcel benchmark."
    else:
        code, reason = DECISIONS[row['listing_id']]
    date = re.search(r'Posted on\s*:\s*(\d{2} \w{3}, \d{4})', row['card_text'])
    posted = datetime.strptime(date[1], '%d %b, %Y').replace(tzinfo=timezone.utc) if date else None
    age = (datetime.fromisoformat(row['observed_at'])-posted).days if posted else None
    return dict(row, decision='not_admitted', primary_reason=code, review_reason=reason,
                listing_date_parsed=posted.isoformat() if posted else None, listing_age_days=age,
                additional_checks={'listing_date_missing': posted is None,
                    'listing_date_outside_window': age is not None and not -1 <= age <= 180},
                admitted_to_benchmark=False, review_version='numeric-backlog-1.0')

def can_admit(row):
    try:
        age=(datetime.fromisoformat(row['observed_at'])-datetime.fromisoformat(row['listing_date_parsed'])).total_seconds()/86400
    except (KeyError, ValueError, TypeError):
        return False
    return (row.get('decision') == 'admit_research_observation' and
            -1 <= age <= 180 and
            0 < row.get('area_sqft', 0) <= 10000 and row.get('price_inr', 0) > 0 and
            bool(row.get('listing_date_parsed')) and not row.get('blocking_reasons') and
            row.get('source_rate_inr_sqft', 0) > 0 and
            abs(row['source_rate_inr_sqft'] - row['price_inr']/row['area_sqft']) <= max(1, .05*row['price_inr']/row['area_sqft']))

def main():
    assert sha(BASE) == BASE_HASH
    for name, expected in PINNED_INPUTS.items():
        assert sha(INPUT/name)==expected, 'Changed evidence requires a new review: '+name
    rei = read(INPUT/'realestateindia_unique_listings.jsonl')
    pw = read(INPUT/'propertywala_all_id_reviews.jsonl')
    mb = read(ROOT/'magicbricks_mmr_data/records.jsonl')
    candidates = [r for r in rei if r.get('price_rupees') and r.get('area_sqft')]
    assert len(candidates) == 78
    assert {r['listing_id'] for r in candidates if r['area_sqft'] <= 10000} == set(DECISIONS)
    reviewed = [triage(r) for r in candidates]
    details = read(INPUT/'realestateindia_new_detail_reviews.jsonl')
    evidence = {}
    for r in candidates + pw + details:
        for pathkey, hashkey in [('raw_path','raw_sha256'), ('detail_raw_path','detail_sha256')]:
            if r.get(pathkey):
                p=ROOT/r[pathkey]
                assert sha(p) == r[hashkey], str(p)
                evidence[r[pathkey]]=r[hashkey]
    # Full detail supplements the old summary, which stopped too early at Overview.
    sys.path.insert(0, str(ROOT/'exploration/propertywala'))
    from review_saved_pages import Tree
    tara = next(r for r in details if r['listing_id']=='1490680')
    full_text = Tree((ROOT/tara['raw_path']).read_text(encoding='utf-8')).root.text()
    assert 'About Tara Angan, Sector 13 Kharghar, Navi Mumbai' in full_text
    for r in reviewed:
        detail = next((d for d in details if d['listing_id']==r['listing_id']), None)
        if detail:
            r['detail_evidence'] = detail
    # Resolve counting now, without claiming that project matches prove same parcel.
    groups=json.loads((INPUT/'cross_source_project_groups.json').read_text(encoding='utf-8'))
    reasons={
      'rustomjee_belle_vue':'Unidentified project configurations plus conflicting price/locality: admit no member.',
      'diviana_park':'Conflicting agricultural/NA evidence and geography: admit no member.',
      'lodha_villa_royale':'Land-only versus built-villa package and configuration identity unresolved: admit no member.'}
    for g in groups:
        g.update(counting_resolution='exclude_all_members', admitted_count=0,
                 same_physical_parcel_proven=False, reason=reasons[g['project_group']],
                 evidence_cluster_id='cross_source_'+g['project_group'],
                 reopen_requirement='Parcel identifier and consistent land-only price, area, land use and locality; all linked members stay in one evaluation fold.')
    # Same seller and same-size candidates: retain one research representative;
    # never promote the conflicting Vasind/Thane West advertisements alongside it.
    seller_group=['P243109329','P722942926','P194298592']
    groups.append(dict(project_group='priyanka_kalyan_vasind_candidate_family',
        members=[{'source':'propertywala','listing_id':i} for i in seller_group],
        evidence_cluster_id='cross_source_priyanka_kalyan_vasind',
        counting_resolution='one_representative_only', admitted_count=1,
        same_physical_parcel_proven=False, representative='P243109329',
        reason='Same seller; two 1050 sqft cards. Other ads conflict between Vasind, Thane West and guntha areas. Retain only internally consistent Kalyan-station observation; independence remains unproven.'))
    source = next(r for r in pw if r['listing_id']=='P243109329')
    # Audit duplicate signals against all saved MB/REI/PW IDs, including excluded rows.
    screen=[]
    for r in mb+rei+pw:
        if r.get('source')=='propertywala' and r['listing_id']=='P243109329': continue
        try:
            area=r.get('area_sqft') or float(str(r.get('plot_area') or 0).replace(',',''))*UNITS.get(str(r.get('plot_area_unit')).lower(),0)
        except ValueError:
            area=0
        text=json.dumps(r,ensure_ascii=False).lower()
        signals=[]
        if 'priyanka jadhav' in text: signals.append('same_seller')
        if area and abs(area-1050)<=52.5: signals.append('area_within_five_percent')
        if any(t in text for t in ['19.2433','73.1343']): signals.append('approximate_pin_candidate')
        if signals: screen.append(dict(source=r.get('source','magicbricks'),listing_id=r['listing_id'],signals=signals,
            locality=r.get('source_locality_label') or r.get('locality'),area_sqft=area,
            disposition='linked_one_representative_group' if r['listing_id'] in seller_group else 'area_only_not_proof_of_identity'))
    admitted=dict(source, source_listing_id=source['listing_id'], listing_id='propertywala:'+source['listing_id'],
        review_status='approved_research_observation',
        decision='admit_research_observation',blocking_reasons=[],price_inr=1500000,
        asking_rate_inr_sqft=1500000/1050,source_rate_inr_sqft=1429,
        listing_date_parsed='2026-09-19T18:48:00+00:00',
        city='Kalyan',source_locality='Near Kalyan station',resolved_locality=None,
        locality_key='kalyan | near kalyan station',area_band=area_band(1050),
        project_name=None,benchmark_segment='individual_or_unknown',
        evidence_cluster_id='cross_source_priyanka_kalyan_vasind',
        property_group_id='propertywala_P243109329',
        admitted_to_benchmark=True,cross_source_duplicate_status='one_representative_of_candidate_family',
        coordinate_status='source_approximate_not_used',khadakpada_verified=False,
        land_use_status='source_label_only_unverified',
        flags=['approximate_location','physical_parcel_identity_unverified'],
        benchmark_review_decision='Price, area, displayed rate and recent date agree. Source address near Kalyan station is retained without geocoding; one representative of possible seller duplicates.',
        review_version='numeric-backlog-1.0')
    assert can_admit(admitted)
    base=read(BASE)
    assert len(base)==364
    rows=base+[admitted]
    assert len({(r['source'],r.get('source_listing_id',r['listing_id'])) for r in rows})==365
    predictions=evaluate(rows)
    output=ROOT/'residential_land_pilots'/('benchmark_review_'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
    output.mkdir()
    lines(output/'realestateindia_78_decisions.jsonl',reviewed)
    lines(output/'benchmark_snapshot.jsonl',rows)
    lines(output/'approved_additions.jsonl',[admitted])
    lines(output/'duplicate_screen.jsonl',screen)
    lines(output/'predictions.jsonl',predictions)
    dump(output/'cross_source_counting_resolutions.json',groups)
    dump(output/'raw_evidence_manifest.json',evidence)
    (output/'tara_angan_full_saved_text.txt').write_text(full_text,encoding='utf-8')
    summary=dict(reviewed_at=datetime.now(timezone.utc).isoformat(),review_version='numeric-backlog-1.0',
        baseline_path=str(BASE.relative_to(ROOT)),baseline_sha256=BASE_HASH,baseline_rows=364,
        realestateindia_numeric_reviewed=78,realestateindia_admitted=0,
        realestateindia_primary_reasons=dict(Counter(r['primary_reason'] for r in reviewed)),
        propertywala_admitted=1,new_benchmark_rows=365,new_evidence_clusters=len({r['evidence_cluster_id'] for r in rows}),
        khadakpada_verified=0,network_requests=0,
        benchmark_sha256=sha(output/'benchmark_snapshot.jsonl'),evaluation=metrics(predictions),
        limitations='Research asking prices only; not 365 independently verified parcels. Legacy 364 rows preserved. Same-project groups excluded, seller-family capped at one. No broader collection authorized until review catches up.',
        duplicate_screen_source_ids=len({(r.get('source','magicbricks'),r['listing_id']) for r in mb+rei+pw}),
        input_hashes={str(p.relative_to(ROOT)):sha(p) for p in [INPUT/'realestateindia_unique_listings.jsonl',INPUT/'propertywala_all_id_reviews.jsonl',INPUT/'realestateindia_new_detail_reviews.jsonl',INPUT/'cross_source_project_groups.json']})
    dump(output/'summary.json',summary)
    assert sha(BASE)==BASE_HASH
    print(output)
    print(json.dumps(summary,indent=2))

if __name__=='__main__':
    main()
