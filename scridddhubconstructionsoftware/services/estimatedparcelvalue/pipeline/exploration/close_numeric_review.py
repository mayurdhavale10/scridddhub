"""Validate and document the September 23 offline review version."""
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from review_numeric_backlog import ROOT, BASE, BASE_HASH, sha, dump

OUT=ROOT/'residential_land_pilots/benchmark_review_20260923T073144576096Z'
REPO=ROOT.parents[2]

def main():
    summary=json.loads((OUT/'summary.json').read_text(encoding='utf-8'))
    validation=OUT/'validation'
    validation.mkdir(exist_ok=True)
    test_results=[]
    for directory,expected in [('magicbricks',25),('exploration/propertywala',6),('exploration',15)]:
        command=[sys.executable,'-X','utf8','-m','unittest','discover','-s',directory,'-p','test_*.py','-v']
        result=subprocess.run(command,cwd=ROOT,capture_output=True,text=True,encoding='utf-8')
        log=directory.replace('/','_')+'_tests.txt'
        (validation/log).write_text(result.stdout+result.stderr,encoding='utf-8')
        assert result.returncode==0, result.stderr
        assert f'Ran {expected} tests' in result.stderr
        test_results.append(dict(directory=directory,passed=expected,log=log))
    protected=json.loads((ROOT/'residential_land_pilots/propertywala/20260922_priority/review_20260922T190153436976Z/summary.json').read_text(encoding='utf-8'))['protected_hashes_before']
    for path,expected in protected.items():
        assert sha(ROOT/path)==expected,path
    assert sha(BASE)==BASE_HASH
    assert sha(OUT/'benchmark_snapshot.jsonl')==summary['benchmark_sha256']
    dump(validation/'preservation_and_tests.json',dict(checked_at=datetime.now(timezone.utc).isoformat(),
        tests=test_results,total_passed=46,protected_hashes=protected,protected_unchanged=True,
        benchmark_sha256=summary['benchmark_sha256'],raw_evidence_manifest_sha256=sha(OUT/'raw_evidence_manifest.json')))
    dump(OUT/'khadakpada_followup.json',dict(checked_at=datetime.now(timezone.utc).isoformat(),
        tool='web search discovery only; not raw listing evidence',search_queries=[
         'Khadakpada Kalyan residential plot land sale -flat -apartment -bhk site:realestateindia.com/property-detail/',
         'Khadakpada residential plot land sale site:propertywala.com'],
        search_query_count=2,new_source_page_captures=0,
        relevant_result_urls=[
         'https://www.realestateindia.com/property-detail/residential-plot-for-sale-in-khadakpada-kalyan-west-thane-16000-sq-ft-79-lac-1202160.htm',
         'https://www.realestateindia.com/thane-property/residential-land-for-sale-in-khadakpada-kalyan-west-thane.htm',
         'https://www.realestateindia.com/property-detail/commercial-lands-inst-land-for-sale-in-khadakpada-kalyan-west-thane-1200-sq-ft-1041784.htm'],
        decision='No new in-scope residential-land lead. Residential result is already reviewed 1202160 (tower booking); commercial-land result is out of scope. Other results are apartments or broad Kalyan recommendations. No duplicate fetch.',
        existing_evidence={'realestateindia':'Two direct Khadakpada IDs are building/tower exclusions; nineteen nearby recommendations do not establish locality.',
         'nobroker':'Two explicit source addresses, zero independently resolved localities; saved pilot stopped before model reuse due to permission restrictions.',
         'magicbricks':'Saved Khadakpada navigation exposes only broad Kalyan plot route.',
         'propertywala':'Admitted near-station Kalyan observation has no Khadakpada evidence.'},
        verified_coverage=0))
    rel=OUT.relative_to(ROOT).as_posix()
    report=f'''# Residential land review and promotion — 23 September 2026

This is the latest status. It supersedes the growth report's review counts, not its raw inventory. Broad collection is paused under the user's revised priority.

## Delivered benchmark

- New version: **365 research asking-price rows / 246 evidence clusters**, from the original 364 rows / 245 clusters plus **one PropertyWala observation**.
- Original reviewed benchmark remains byte-for-byte unchanged: SHA-256 `{BASE_HASH}`.
- New snapshot: `services/estimatedparcelvalue/pipeline/{rel}/benchmark_snapshot.jsonl`.
- New snapshot SHA-256: `{summary['benchmark_sha256']}`.
- Addition: PropertyWala P243109329, near Kalyan station, 1,050 sqft, Rs 15 lakh, displayed Rs 1,429/sqft, source date 19 September 2026. Source address retained; no independent geocoding, legal verification or parcel-identity claim. Not Khadakpada.
- Same seller's potentially related Vasind/Thane West advertisements are linked into one candidate family. Exactly one representative is admitted; conflicting members remain excluded. This is conservative counting, not proof they are the same parcel.

The new version is an actual saved snapshot with a separate additions file, decision ledger, duplicate resolutions, evidence hashes and evaluation output. The legacy 364 rows were carried forward unchanged. These 365 rows are **not 365 verified independent parcels**.

## All 78 numeric RealEstateIndia candidates triaged

**Zero admitted from RealEstateIndia.** Numeric price and area were insufficient to meet the existing research criteria; no requirement for legal parcel verification was newly imposed.

| Primary reason (mutually exclusive) | IDs |
|---|---:|
| Above the existing 10,000 sqft experiment limit | 46 |
| Generic project inventory / starting-size offers | 11 |
| Existing buildings or explicitly described apartments | 4 |
| Known cross-source project conflicts | 3 |
| Missing source listing date and displayed rate | 3 |
| Other specific price, area, locality, land-use or parcel-identity conflicts | 11 |
| Total reviewed | 78 |

Each ID has its own source card, timestamp, raw path/hash, decision and reason in `realestateindia_78_decisions.jsonl`. Oversized parcels are retained for a possible separate segment, not discarded. Missing dates must not be replaced with capture timestamps. Unit rates must not be invented from URL prices.

Particular findings:

- **1490680 (Tara Angan):** the earlier summary stopped at Overview and missed a project panel. The full saved page says Badlapur in the listing but Sector 13 Kharghar, Navi Mumbai in the Tara Angan panel. Arithmetic agrees; location/project identity does not. Full extracted text is saved.
- **1175286:** card/description say Rs 9.82 lakh; detail header says Call for Price. Broad Kalyan-Dombivali label does not locate it in Khadakpada.
- **1184056:** dated resale offer for 1,744 sqft at Rs 7.25 lakh, village Patgaon/Madhusudan Heritage, with Karjat versus Murbad-highway labels and no displayed unit rate. Needs locality and rate evidence.
- **1452064 / 1443033 / 1511639:** individually described offers but missing listing-date and displayed-rate evidence. Do not manufacture freshness or relax the baseline silently.

## Cross-source counting decisions

| Group | Saved members | Admission in new version |
|---|---:|---|
| Rustomjee Belle Vue | 3 | Zero: generic configurations and conflicting price/locality |
| Diviana Park | 9 | Zero: agricultural/NA and geography conflicts |
| Lodha Villa Royale | 5 | Zero: land-only versus built-villa package unresolved |
| Priyanka Kalyan/Vasind candidate family | 3 | One representative, P243109329 |

The three project groups are resolved **for benchmark counting** by excluding all members. Physical equivalence remains unproven; they must not be labelled confirmed parcel duplicates. Future qualifying members must retain one group/fold and a one-representative cap until distinct parcel evidence exists. The admission screen covered 1,724 saved MagicBricks, RealEstateIndia and PropertyWala source IDs; area-only matches are not treated as proof of identity.

## Khadakpada and collection scope

**Verified Khadakpada coverage remains zero.** Two narrowly targeted discovery queries found the already-reviewed RealEstateIndia tower listing, apartment results, a commercial plot and broader recommendations; no new qualifying residential-plot lead. Search snippets were used only for discovery. No source detail/search pages were fetched again; original raw pages, timestamps and hashes are preserved.

Existing locality evidence: RealEstateIndia's two direct IDs are building/tower exclusions; its nineteen nearby recommendations cannot be relabelled Khadakpada. NoBroker has two explicit source addresses but zero independently resolved localities and its saved reuse restriction remains unresolved. MagicBricks' saved Khadakpada navigation only exposes a broad Kalyan plot route.

## Validation and remaining work

- **46 tests passed**: 25 MagicBricks, 6 PropertyWala, 15 exploration (including five new review/promotion tests). Logs and preservation checks are in `validation/`.
- All referenced source-page hashes checked; protected originals unchanged.
- Cluster-separated evaluation: **66 scored / 299 abstained**; median absolute percentage error **31.54%**, unchanged. The new locality has insufficient comparables, so the model abstains. No performance improvement is claimed.
- Completed: triage of all 78 numeric REI IDs; counting resolutions for three known cross-source groups; one actual benchmark promotion; Khadakpada-only discovery check.
- Remaining: 1,001 other REI IDs lack numeric card price+area; 64 PW IDs are not admitted. Existing evidence can still be reviewed offline. Three project-group parcel identities and Khadakpada evidence remain unresolved.
- **Do not resume broad Mumbai/Thane pagination, new sources, MagicBricks Thane pagination or Shahad work yet.** New requests remain limited to a concrete Khadakpada residential-land lead. Preserve this review-first order.

The provisional 5,000–10,000-row planning range is not an inventory estimate or measured completion denominator. 365 rows would be 3.65–7.30% of that hypothetical range, not a defensible percentage of all available land.
'''
    docs=REPO/'codex'
    (docs/'RESIDENTIAL_LAND_REVIEW_STATUS_20260923.md').write_text(report,encoding='utf-8')
    guide=docs/'GUIDE_FOR_LLM_CODEX.md'
    old=guide.read_text(encoding='utf-8')
    marker='## Review-first priority — 23 September 2026'
    if marker not in old:
        head=f'''# Guide for LLM / Codex: residential land data collection

{marker}

Read [the latest review/promotion status](RESIDENTIAL_LAND_REVIEW_STATUS_20260923.md) first. It supersedes the historical growth instructions and benchmark counts below.

All 78 numeric RealEstateIndia IDs have now been triaged; zero pass the existing criteria. Forty-six are above 10,000 sqft; the other 32 have individually recorded evidence gaps/conflicts. Full Tara Angan detail review uncovered a Badlapur/Kharghar project conflict missed by the earlier short extraction.

The original 364-row benchmark is frozen and hash-preserved. A **new 365-row / 246-cluster version** adds PropertyWala P243109329 near Kalyan station. It is not Khadakpada coverage or verified parcel identity. The Rustomjee, Diviana and Lodha Villa Royale cross-source groups contribute zero rows; a possible same-seller family is capped at one representative.

Current artifacts: `pipeline/{rel}/`. Review script: `pipeline/exploration/review_numeric_backlog.py`; input hashes are pinned. Do not rerun historical growth/close scripts as current authority: they hard-code zero admissions and 364 rows.

Priority: review saved evidence and preserve duplicate caps; pursue only concrete Khadakpada residential-land leads for new requests. Khadakpada verified coverage remains zero. Broad source expansion, MagicBricks Thane pagination and Shahad remain deferred. Do not infer permission to resume volume from completion of the 78-card triage alone. Tests: 46 passed; new benchmark evaluation abstains on the added observation.

## Historical collection context (superseded where conflicting)
'''
        guide.write_text(head+old.split('\n',1)[1],encoding='utf-8')
    growth=docs/'RESIDENTIAL_LAND_GROWTH_STATUS_20260923.md'
    old=growth.read_text(encoding='utf-8')
    note='> Review counts are superseded by [the review and promotion status](RESIDENTIAL_LAND_REVIEW_STATUS_20260923.md): 78 REI candidates triaged; actual new benchmark 365 rows. Raw inventory below remains historical evidence. Broad collection is paused.\n\n'
    if note not in old:growth.write_text(note+old,encoding='utf-8')
    roadmap=docs/'RESIDENTIAL_LAND_AVM_ROADMAP.md'
    old=roadmap.read_text(encoding='utf-8')
    note='> Current problem statement (23 September 2026): turn saved source observations into a deduplicated, evidence-backed residential-land asking-price research benchmark, prioritising Mumbai, Thane and Kalyan and explicitly measuring the Khadakpada gap. Raw-volume growth is paused. Review and admission quality, not scraped IDs, measure progress. The original 364-row reference is preserved; the new version has 365 rows, not verified independent parcels. See [current decisions and remaining work](RESIDENTIAL_LAND_REVIEW_STATUS_20260923.md).\n\n'
    if note not in old:roadmap.write_text(note+old,encoding='utf-8')
    print(json.dumps(dict(tests_passed=46,report=str(docs/'RESIDENTIAL_LAND_REVIEW_STATUS_20260923.md'),benchmark_rows=365),indent=2))

if __name__=='__main__':main()
