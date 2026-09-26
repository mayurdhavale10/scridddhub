"""Versioned diagnostic extraction; never promote alternate-source cards to ML."""
import hashlib
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

sys.path.insert(0, str(Path(__file__).parent / 'propertywala'))
from review_saved_pages import Tree

ROOT = Path(__file__).resolve().parents[1]


def load_page(path):
    meta = json.loads((path / 'response.json').read_text(encoding='utf-8'))
    raw = (path / 'body.bin').read_bytes()
    assert hashlib.sha256(raw).hexdigest() == meta['sha256']
    assert meta['status'] == 200
    tree = Tree(raw.decode('utf-8', errors='replace'))
    for n in tree.root.walk():
        if n.tag in ('script', 'style'): n.children = []
    return meta, tree


def price_value(text):
    match = re.fullmatch(r'₹\s*([\d,.]+)\s*(Lac|Cr\.?|L)?', text or '')
    if not match: return None
    return float(match[1].replace(',', '')) * {None:1, 'L':100000, 'Lac':100000, 'Cr':10000000, 'Cr.':10000000}[match[2]]


def provenance(meta, path, source, ident, url):
    return {'source':source, 'listing_id':ident, 'url':url, 'source_page':meta['url'], 'observed_at':meta['observed_at'],
            'requested_market':meta['requested_market'], 'raw_path':str((path/'body.bin').resolve().relative_to(ROOT)),
            'raw_sha256':meta['sha256'], 'admitted_to_benchmark':False, 'cross_source_duplicate_status':'unresolved'}


def reeltor(path):
    meta, tree = load_page(path)
    rows, seen = [], set()
    for n in tree.root.walk():
        href = n.attrs.get('href','')
        if n.tag != 'a' or not re.fullmatch(r'/property/P\d+',href) or href in seen: continue
        seen.add(href)
        spans = [c.text() for c in n.walk() if c.tag=='span']
        if len(spans) != 4: raise ValueError('Reeltor card structure changed')
        title, locality, area, price = spans
        row = provenance(meta,path,'reeltor',href.rsplit('/',1)[-1],urljoin(meta['url'],href))
        am = re.fullmatch(r'([\d,.]+) Sq.ft', area)
        title_area = re.search(r'([\d,]+)\s*sqft',title,re.I)
        value = float(am[1].replace(',','')) if am else None
        conflict = bool(title_area and value != float(title_area[1].replace(',','')))
        row.update(title=title, source_locality_label=locality, area_original=area, area_sqft=value,
                   price_original=price, price_rupees=price_value(price), title_area_conflict=conflict,
                   card_text=n.text(), review_status='exclude_from_khadakpada_wrong_locality',
                   detail_route_status='not_requested_robots_disallow_property', khadakpada_verified=False)
        rows.append(row)
    return rows


def realestateindia(path):
    meta, tree = load_page(path)
    nodes = list(tree.root.walk())
    containers = {n.attrs['data-url']:n for n in nodes if 'ps-list' in n.attrs.get('class','').split() and n.attrs.get('data-url')}
    rows, seen = [], set()
    for n in nodes:
        href = n.attrs.get('href','')
        match = re.search(r'/property-detail/.*-(\d+)\.htm$', href)
        if n.tag != 'a' or not match or not n.text() or match[1] in seen: continue
        seen.add(match[1]); card = containers.get(href)
        fields = {}
        if card:
            for li in card.walk():
                if li.tag != 'li': continue
                labels = {cls:c.text() for c in li.walk() for cls in ('area-top','area-btm') if cls in c.attrs.get('class','').split()}
                if len(labels)==2: fields[labels['area-top']] = labels['area-btm']
        row = provenance(meta,path,'realestateindia',match[1],href)
        text = card.text() if card else n.text()
        price, area = fields.get('Price'), fields.get('Plot / Land Area')
        am = re.match(r'^([\d,.]+)\s*sq\.ft\b',area or '',re.I)
        value = float(am[1].replace(',','')) if am else None
        pv = price_value(price)
        flags = [label for label,pattern in [('building_or_commercial',r'\b(BHK|apartment|flats?|commercial|building|floor|TDR)\b'),('land_use',r'\b(farm\w*|agricultur\w*)\b')] if re.search(pattern,text,re.I)]
        if 'Built Up Area' in fields: flags.append('built_up_not_plot_area')
        if not pv: flags.append('no_unambiguous_card_price')
        if not value: flags.append('no_explicit_plot_area')
        row.update(title=n.text(), source_locality_label=n.text().split(' for Sale in ')[-1].split(' | ')[0],
                   source_fields=fields, price_original=price, price_rupees=pv, area_original=area, area_sqft=value,
                   recomputed_inr_sqft=pv/value if pv and value else None, card_text=text,
                   card_kind='full' if fields else 'related_link', nearby_recommendation='Less than ' in text,
                   review_flags=flags, review_status='unreviewed_category_locality_freshness_duplicates', khadakpada_verified=False)
        rows.append(row)
    return rows


def main():
    out = ROOT / 'residential_land_pilots' / ('alternate_review_' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
    out.mkdir()
    rows = reeltor(ROOT/'residential_land_pilots/reeltor/20260923_priority_authorized/khadakpada')
    base = ROOT/'residential_land_pilots/realestateindia/20260923_priority'
    for name in ('khadakpada','kalyan_west','thane','mumbai'):
        path = base/name
        if (path/'body.bin').exists(): rows.extend(realestateindia(path))
    details = []
    for ident in ('1202164','1202160'):
        path = base/('detail_'+ident); meta, tree = load_page(path)
        visible = tree.root.text()
        (out/(ident+'_visible.txt')).write_text(visible,encoding='utf-8')
        start = visible.index('Listing ID : '+ident)
        evidence = visible[start:visible.index('Location & Connectivity', start)]
        row = provenance(meta,path,'realestateindia',ident,meta['url'])
        row.update(review_status='exclude_building_category_conflict', price_original='Call for Price',price_rupees=None,area_sqft=None,
                   detail_evidence=evidence, review_reason=('Floor 16th, 48 floors, under construction; built-up 597 sqft vs description 672 sqft / 1.90 Cr. Not vacant plot evidence.' if ident=='1202164' else 'G+17 single tower, residential and commercial booking offer; 16000 sqft is not a verified offered vacant parcel. URL price is not displayed asking price.'))
        details.append(row)
        for card in rows:
            if card['source']=='realestateindia' and card['listing_id']==ident:
                card['review_status']=row['review_status']
                card['review_reason']=row['review_reason']
    index = defaultdict(list)
    for row in rows: index[(row['source'],row['listing_id'])].append(row)
    unique = [{'source':source,'listing_id':ident,'requested_markets':sorted({r['requested_market'] for r in group}),
               'observation_count':len(group),'review_status':group[0]['review_status'],'admitted_to_benchmark':False} for (source,ident),group in index.items()]
    summary = {'observations':len(rows),'unique_source_ids':len(index),'by_source':dict(Counter(r['source'] for r in rows)),
               'by_source_market':dict(Counter(r['source']+':'+r['requested_market'] for r in rows)),
               'unique_ids_by_source':dict(Counter(r['source'] for r in unique)),
               'reeltor_title_area_conflicts':sum(r.get('title_area_conflict',False) for r in rows),
               'realestateindia_full_cards':sum(r.get('card_kind')=='full' for r in rows),
               'repeated_id_observations':len(rows)-len(index),'reviewed_new_details':len(details),'benchmark_additions':0,
               'scope_complete':False,'detail_review_eligible_khadakpada':0}
    summary['numeric_card_price_and_plot_area'] = sum(bool(r.get('price_rupees') and r.get('area_sqft')) for r in rows if r['source']=='realestateindia')
    summary['nearby_realestateindia_observations'] = sum(r.get('nearby_recommendation',False) for r in rows)
    links = []
    for directory in (base, ROOT/'residential_land_pilots/reeltor/20260923_priority_authorized'):
        for path in directory.iterdir():
            if path.is_dir() and path.name != 'robots' and (path/'body.bin').exists():
                meta, tree = load_page(path)
                links.extend({'source_page':meta['url'],'text':n.text(),'url':urljoin(meta['url'],n.attrs['href'])} for n in tree.root.walk() if n.tag=='a' and n.attrs.get('href'))
    (out/'published_links.json').write_text(json.dumps(links,ensure_ascii=False,indent=2),encoding='utf-8')
    for name,data in [('observations',rows),('unique_listing_index',unique),('detail_reviews',details)]:
        (out/(name+'.jsonl')).write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in data),encoding='utf-8')
    (out/'summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
    print(out);print(json.dumps(summary,indent=2))


if __name__=='__main__':main()
