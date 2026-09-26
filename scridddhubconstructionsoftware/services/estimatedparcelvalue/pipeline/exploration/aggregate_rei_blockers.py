"""Offline aggregate only: no requests, per-listing re-review, or promotion."""
import json
import re
from collections import Counter
from datetime import datetime, timezone
from review_targeted_evidence import ROOT, PRIOR, EXPECTED, sha, read, dump, extract

def main():
    protected={str(p.relative_to(ROOT)):sha(p) for p in EXPECTED}
    for p,h in EXPECTED.items():assert sha(p)==h
    rows=read(PRIOR/'realestateindia_78_decisions.jsonl')
    growth=ROOT/'residential_land_pilots/growth_review_20260923T063928956961Z'
    targeted=ROOT/'residential_land_pilots/targeted_review_20260923'
    latest=read(targeted/'detail_decisions.jsonl')
    recent={r['listing_id'] for r in latest}
    remaining=[r for r in rows if r['listing_id'] not in recent]
    details=read(growth/'realestateindia_new_detail_reviews.jsonl')+latest
    detail_ids={r['listing_id'] for r in details}
    assert len(rows)==78 and len(remaining)==74 and len(detail_ids)==10
    primary_map={
      'outside_area_segment':'Above 10000 sqft research limit',
      'project_inventory':'Generic project inventory / starting offers',
      'existing_building':'Building / apartment / bundled bungalow',
      'apartment':'Building / apartment / bundled bungalow',
      'building_package':'Building / apartment / bundled bungalow',
      'cross_source_project':'Known cross-source project conflicts',
      'category_price_conflict':'Other recorded price / area / locality conflicts',
      'price_locality_conflict':'Other recorded price / area / locality conflicts',
      'price_area_conflict':'Other recorded price / area / locality conflicts',
      'project_locality_conflict':'Other recorded price / area / locality conflicts',
      'price_project_conflict':'Other recorded price / area / locality conflicts',
      'project_price_conflict':'Other recorded price / area / locality conflicts',
      'project_identity':'Other parcel identity / multiple-parcel / land-use issues',
      'multiple_parcels':'Other parcel identity / multiple-parcel / land-use issues',
      'land_use_inventory':'Other parcel identity / multiple-parcel / land-use issues',
    }
    primary=Counter(primary_map[r['primary_reason']] for r in remaining)
    observations=read(growth/'realestateindia_observations.jsonl')
    date_ids={r['listing_id'] for r in observations if re.search(r'Posted on\s*:\s*\d{1,2} [A-Za-z]{3}, \d{4}',r.get('card_text',''))}
    assert not any(r['listing_id'] in date_ids for r in rows if not r['listing_date_parsed'])
    groups=json.loads((PRIOR/'cross_source_counting_resolutions.json').read_text(encoding='utf-8'))
    duplicate_ids={m['listing_id'] for g in groups for m in g['members'] if m['source']=='realestateindia'}
    for g in json.loads((targeted/'additional_duplicate_groups.json').read_text(encoding='utf-8')):
        duplicate_ids.update(g['members'])
    # Known conflicts from saved decision ledgers only, not new inference from cards.
    locality_conflicts={'1428893','1490680','1342062','1396889','1184056'}
    rate_conflicts={'1342062','1396889','1184056'}
    price_basis={'1175286','1387660','1454362','1400654','1451382','1416282'}
    categories={
      'Missing posted date in all saved cards':lambda r:r['listing_id'] not in date_ids,
      'Above 10000 sqft':lambda r:r['area_sqft']>10000,
      'Generic project inventory':lambda r:r['primary_reason']=='project_inventory',
      'Building / apartment / package evidence':lambda r:r['primary_reason'] in {'existing_building','apartment','building_package'},
      'Known locality / project-location conflict':lambda r:r['listing_id'] in locality_conflicts,
      'Broad locality needing precision (not a proven conflict)':lambda r:r['listing_id']=='1175286',
      'Known displayed unit-rate conflict':lambda r:r['listing_id'] in rate_conflicts,
      'Other price / area / package-basis ambiguity':lambda r:r['listing_id'] in price_basis,
      'Member of recorded duplicate/project candidate group':lambda r:r['listing_id'] in duplicate_ids,
    }
    overlapping={label:{'remaining74':sum(fn(r) for r in remaining),'all78':sum(fn(r) for r in rows),
                        'remaining_ids':[r['listing_id'] for r in remaining if fn(r)]} for label,fn in categories.items()}
    detail_dates=[]
    for d in details:
        p=ROOT/d['raw_path'];raw=p.read_text(encoding='utf-8')
        assert sha(p)==d['raw_sha256']
        parsed=extract(raw)
        detail_dates.append(dict(listing_id=d['listing_id'],explicit_date=parsed['explicit_listing_date'],
            labelled_date_markup_or_schema=bool(re.search(r'(?i)(datePublished|dateModified|<[^>]+class=[^>]*post_date)',raw)),
            card_has_date=d['listing_id'] in date_ids,raw_path=d['raw_path'],sha256=sha(p)))
    full=[r for r in read(growth/'realestateindia_unique_listings.jsonl') if r['card_kind']=='full']
    full_dated=sum(r['listing_id'] in date_ids for r in full)
    small=[r for r in remaining if r['area_sqft']<=10000]
    out=ROOT/'residential_land_pilots/rei_blocker_aggregate_20260923'
    out.mkdir(exist_ok=False)
    result=dict(created_at=datetime.now(timezone.utc).isoformat(),network_requests=0,promotions=0,
        scope={'all_numeric':78,'last_batch':4,'remaining_by_subtraction':74,
               'numeric_with_saved_details':10,'numeric_without_saved_details':68,
               'remaining74_already_detail_reviewed':6,'remaining74_within_area_limit':len(small)},
        remaining74_primary=dict(primary),overlapping_blockers=overlapping,
        within_area_limit_date_missing=sum(r['listing_id'] not in date_ids for r in small),
        all_full_cards={'count':len(full),'date_present_in_any_observation':full_dated,
                        'date_absent_in_saved_cards':len(full)-full_dated},
        detail_date_evidence=detail_dates,protected_benchmarks=protected,
        limitations='Counts aggregate saved triage, not a complete multi-label detail audit. Locality/rate/duplicate counts are known lower bounds; unchecked does not mean clear. Related links excluded from date-template denominator.')
    assert sum(primary.values())==74
    assert len(small)==28
    assert all(d['explicit_date'] is None for d in detail_dates)
    assert len(full)==802 and full_dated==43
    dump(out/'summary.json',result)
    dump(out/'primary_reason_members.json',{label:[r['listing_id'] for r in remaining if primary_map[r['primary_reason']]==label] for label in primary})
    report=['# RealEstateIndia aggregate blocker review — 23 September 2026','',
      'Offline aggregate only. No page requests, individual detail reviews, policy changes or promotions. Both reviewed benchmarks are hash-unchanged.',
      '', '## Denominator correction','',
      'There are still **78 unadmitted numeric candidates**. The requested **74** means those 78 minus the last four targeted captures. Six of these 74 already have earlier detail reviews: only **68** have no saved detail review. All 78 already have card-level triage.',
      '', '## Primary blocker for the remaining 74 (exclusive; totals 74)','',
      '| Primary blocker | Count |','|---|---:|']
    report += [f'| {label} | {count} |' for label,count in primary.items()]
    report += ['', 'These are existing primary decisions. In particular, oversized parcels were assigned the area blocker first; this can hide additional issues. Missing date overlaps other blockers and must not be read as zero simply because it is not a primary category.',
      '', '## Overlapping known blockers','', '| Blocker | Remaining 74 | All 78 |','|---|---:|---:|']
    report += [f"| {label} | {v['remaining74']} | {v['all78']} |" for label,v in overlapping.items()]
    report += ['', 'Do not add these rows: one listing can appear in several. Rate/locality/duplicate counts are minimums established by existing evidence, not claims that the rest passed. No-date and area counts are exhaustive for these saved cards.',
      '', '## Is date omission structural?','',
      '- Remaining numeric pool: **33/74 (44.6%)** have no posted date in any saved card; **41/74 have one**. It is common, but not a majority of this numeric subset.',
      '- All numeric candidates: **36/78 (46.2%)** lack dates.',
      '- Within the existing area limit, remaining pool: **9/28 (32.1%)** lack dates; **19/28** have them.',
      '- Broader saved source sample: **759/802 full cards (94.6%)** omit a date; **43/802** expose one. The 277 related-link-only records are excluded from this denominator. The numeric subset is much more date-complete than the source inventory overall.',
      '- **10/10 saved detail pages for numeric candidates** have no explicitly labelled listing date in the listing section and no detected datePublished/dateModified or populated post_date markup. **Seven of those ten** have dates on their saved search cards. CSS contains a post_date style, which is not a populated date field.',
      '', '**Inference:** date omission is a systemic source-data issue and the sampled detail template is not a dependable date-recovery route. This sample does not prove that every REI page omits dates, or that dates cannot exist elsewhere. Missing date does not mean stale. Fetch timestamps, render timestamps and search-engine crawl times do not prove listing freshness.',
      '', '## Policy decisions to make once, before further requests','',
      '1. **Freshness:** either keep the current requirement for an explicit source date, or define a separate date-unknown research cohort with an explicit missingness flag. Do not silently put undated observations into the dated benchmark. Keep source posting date and capture time separate. Using a dated search card is already possible; a detail page need not repeat it.',
      '2. **Parcel size:** 46/74 (62.2%) exceed the current 10,000 sqft scope. Decide whether to keep them outside this benchmark or create a separate large-parcel segment before fetching their details. This is the largest current blocker.',
      '3. **Displayed rate:** requiring a separately displayed source rate is an audit policy, not a mathematical need when unambiguous total price and area exist. Consider a documented computed-rate policy for missing-rate cases; known contradictions still require resolution and must never be overwritten with the computed value.',
      '4. **Locality:** accept consistently source-reported locality only to the same standard as the existing research benchmark; preserve uncertainty. Actual contradictory place/project labels need resolution. Do not treat all generic project panels as reliable location evidence or automatically ignore them.',
      '', 'Recommendation: stop serial detail fetching for date recovery. First settle freshness and the large-parcel scope; then batch only the eligible remainder by the precise evidence still missing. No policy was changed here. Broad scraping, further detail review and promotion are paused pending this discussion.',
      '', 'Machine-readable counts, category member IDs and the ten-page date evidence audit are in `services/estimatedparcelvalue/pipeline/residential_land_pilots/rei_blocker_aggregate_20260923/`. Reconciliation assertions and both benchmark hash checks passed.']
    docs=ROOT.parents[2]/'codex'
    (docs/'REALESTATEINDIA_BLOCKER_BREAKDOWN_20260923.md').write_text('\n'.join(report)+'\n',encoding='utf-8')
    guide=docs/'GUIDE_FOR_LLM_CODEX.md'
    old=guide.read_text(encoding='utf-8')
    title,rest=old.split('\n',1)
    note='\n\n## Current stop point: aggregate policy review\n\nThe user requested aggregate blockers **before any more individual REI reviews**. Read [the blocker breakdown](REALESTATEINDIA_BLOCKER_BREAKDOWN_20260923.md): 33/74 lack dates, 46/74 exceed the current area scope; all 10 sampled numeric detail pages omit explicit listing dates. No new requests or promotions were made. Pause further collection/review until the freshness and parcel-size policy discussion is resolved; do not infer permission from earlier collection instructions. Current benchmark remains 365 rows.\n'
    guide.write_text(title+note+rest,encoding='utf-8')
    for p,h in EXPECTED.items():assert sha(p)==h
    print(json.dumps({k:result[k] for k in ['scope','remaining74_primary','overlapping_blockers','all_full_cards']},indent=2))

if __name__=='__main__':main()
