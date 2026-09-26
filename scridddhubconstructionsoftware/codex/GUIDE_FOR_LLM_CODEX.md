# Guide for LLM / Codex: residential land data collection

## Latest completed promotion — read first

Read [the promotion status](RESIDENTIAL_LAND_PROMOTION_STATUS_20260923.md). Garden k Avenue REI1476394 passed the final saved-evidence check and is admitted as a source-reported research observation. Current benchmark: **366 rows / 247 clusters**; prior 364/365 snapshots preserved. Fifty-four tests pass. Current artifacts: `pipeline/residential_land_pilots/benchmark_rei_promotion_20260923/`. Remaining REI numeric pool: 46 oversized, 12 undated within size, 19 dated within size; see remaining_dated_actions.jsonl before making requests. Khadakpada verified coverage zero. No network requests in this promotion. Historical pending-check instructions below are superseded.


## Current handoff — read first

Read [the current status and next step](RESIDENTIAL_LAND_CURRENT_STATUS_20260923.md). The user authorized continuation after the aggregate report. Existing benchmark rules were retained and 78 REI candidates partitioned into 46 oversized, 12 undated within-size, and 20 dated within-size records. Two dated details were captured: REI1476394 awaits final offline duplicate/identity review; REI1413118 has a project-locality conflict. No new promotions: benchmark 365, Khadakpada verified zero. This supersedes the historical stop instruction below. The next step is the saved-evidence check for REI1476394, not another broad scrape.

## Earlier handoff history

## Current stop point: aggregate policy review

The user requested aggregate blockers **before any more individual REI reviews**. Read [the blocker breakdown](REALESTATEINDIA_BLOCKER_BREAKDOWN_20260923.md): 33/74 lack dates, 46/74 exceed the current area scope; all 10 sampled numeric detail pages omit explicit listing dates. No new requests or promotions were made. Pause further collection/review until the freshness and parcel-size policy discussion is resolved; do not infer permission from earlier collection instructions. Current benchmark remains 365 rows.

## Latest targeted continuation — read first

See [targeted evidence status](RESIDENTIAL_LAND_TARGETED_STATUS_20260923.md). Four saved RealEstateIndia candidates now have detail captures (12 reviewed detail IDs total). Three rates resolved, three explicit listing dates still absent; one detail rate is inconsistent. Two more same-project duplicate groups are linked. Zero additions: the current 365-row benchmark and original 364-row reference remain hash-preserved. Khadakpada verified coverage is still zero. Fifty tests pass.

The user's latest instruction authorizes targeted missing-evidence gathering as well as Khadakpada discovery; it does not authorize broad volume expansion. Do not repeat the four captured details or resume Thane/Shahad pagination. Current evidence and blockers are in `pipeline/residential_land_pilots/targeted_review_20260923/`. Historical generation scripts hard-code earlier counts; do not run them as current closeout tools.


## Review-first priority — 23 September 2026

Read [the latest review/promotion status](RESIDENTIAL_LAND_REVIEW_STATUS_20260923.md) first. It supersedes the historical growth instructions and benchmark counts below.

All 78 numeric RealEstateIndia IDs have now been triaged; zero pass the existing criteria. Forty-six are above 10,000 sqft; the other 32 have individually recorded evidence gaps/conflicts. Full Tara Angan detail review uncovered a Badlapur/Kharghar project conflict missed by the earlier short extraction.

The original 364-row benchmark is frozen and hash-preserved. A **new 365-row / 246-cluster version** adds PropertyWala P243109329 near Kalyan station. It is not Khadakpada coverage or verified parcel identity. The Rustomjee, Diviana and Lodha Villa Royale cross-source groups contribute zero rows; a possible same-seller family is capped at one representative.

Current artifacts: `pipeline/residential_land_pilots/benchmark_review_20260923T073144576096Z/`. Review script: `pipeline/exploration/review_numeric_backlog.py`; input hashes are pinned. Do not rerun historical growth/close scripts as current authority: they hard-code zero admissions and 364 rows.

Priority: review saved evidence and preserve duplicate caps; pursue only concrete Khadakpada residential-land leads for new requests. Khadakpada verified coverage remains zero. Broad source expansion, MagicBricks Thane pagination and Shahad remain deferred. Do not infer permission to resume volume from completion of the 78-card triage alone. Tests: 46 passed; new benchmark evaluation abstains on the added observation.

## Historical collection context (superseded where conflicting)

Updated: 23 September 2026 (Asia/Calcutta; captures span 22–23 September UTC).

## Latest continuation — read first

All **65 saved PropertyWala IDs** now have detail review coverage. Twenty-five
additional unique documents were captured, reusing shared project pages. Current
decisions: four exclusions, 59 holds and two pending candidates. Do not repeat
those requests or count project configurations as independent parcels.

RealEstateIndia now has **1,167 observations / 1,079 source IDs**, including
**951 newly seen IDs** beyond the earlier pilot. All 19 reported Thane pages and
22 reported Mumbai pages were saved, plus Khadakpada, Kalyan West,
Kalyan-Dombivali and Thane West searches. Source-ID counts include related links
and broad district results. Only 78 IDs currently have numeric card price and
explicit plot area; no new IDs have been approved for the benchmark.

Eight RealEstateIndia details have been reviewed in total (two prior exclusions,
six new reviews). One detail returned 503; that detail batch stopped. Later
published pagination worked after a cooldown. CommonFloor returned 403 on its
robots check. 360plot Kalyan and Thane HTML contained no usable cards.

The benchmark remains 364 rows, hash-unchanged. See the authoritative
[growth status and validation](RESIDENTIAL_LAND_GROWTH_STATUS_20260923.md).
New derived files are under
`pipeline/residential_land_pilots/growth_review_20260923T063928956961Z/`.
Use the existing virtual environment for scripts and tests.

## Objective

User revision, 23 September: aim provisionally for **5,000–10,000 reviewed,
deduplicated usable rows**, subject to actual relevant inventory and locality
support. Starting benchmark 364 rows = **3.64%–7.28%** of that planning target;
remaining gap 4,636–9,636. This is not the percentage of all listings scraped.
Follow the [revised problem statement](RESIDENTIAL_LAND_AVM_ROADMAP.md).
Keep raw, source-ID, reviewed-candidate and approved-row counts separate. Do not
overwrite the reviewed benchmark or inflate progress with duplicate exposures.

Collect residential vacant/buildable plot asking-price evidence for ScridddHub's
Estimate Value AVM. User priority on 22 September: **Mumbai, Thane and Kalyan**, including **Khadakpada**. Close existing collection
gaps before expanding across the 36 target markets below.

Keep agricultural, commercial and industrial land separate. Advertised asking
prices are not completed transaction prices. This guide is a collection backlog;
it does not assert that every website has listings in every target market.

## Current collected data

| Source | Region / scope | Saved result |
|---|---|---|
| MagicBricks | 36 attempted MMR and nearby markets; 32 with saved observations | 996 historical observations, 580 distinct source listing IDs, 364 unchanged reviewed benchmark rows. Today: 107 observations, 6 previously unseen IDs. Coverage is partial. |
| PropertyWala | Mumbai, Thane district search, Kalyan | 66 observations / 65 IDs; all 65 have detail review coverage. Four exclusions, 59 holds, two pending candidates. |
| RealEstateIndia | Mumbai, Thane district, Kalyan West/Dombivali, Khadakpada, Thane West | 1,167 observations / 1,079 IDs; 45 saved search/result pages. Eight detail IDs reviewed in total; eligibility largely pending. |
| Reeltor | Khadakpada search | 20 diagnostic cards / 20 IDs, all outside the named locality. Nine title/area conflicts; no eligible Khadakpada additions. |
| NoBroker | Khadakpada/Kalyan search and nearby recommendations | Three direct cards, seven nearby cards and three direct detail pages. Diagnostic sample; no model integration. |
| MahaRERA | Maharashtra/Thane project exploration, including a Kalyan project | Project-search evidence only; no established plot-price training dataset. |

Counts above were recounted from saved observations on 23 September 2026.
MagicBricks is the only source contributing to the reviewed benchmark.

See [the complete region/site checklist](RESIDENTIAL_LAND_COLLECTION_STATUS_20260922.md)
for all 36 regions, latest-run versus historical counts, exact evidence and remaining work.

## Websites and regions remaining

| Website | First region to investigate | Remaining scope and known technical gap |
|---|---|---|
| MagicBricks | Khadakpada/Kalyan, Thane, Shahad | Khadakpada coverage missing; Thane page 2 returned 404; Shahad route unresolved. Kamothe, Rasayani and Vasind previously returned zero direct results. |
| NoBroker | Khadakpada/Kalyan | Extend beyond the small existing pilot if additional relevant listings exist. All other target markets remain uncollected. |
| 99acres | Khadakpada/Kalyan | All 36 target markets remain uncollected. Previous request returned HTTP 403. |
| Housing.com | Khadakpada/Kalyan | All 36 target markets remain uncollected. Previous Kalyan response contained a challenge rather than usable listings. |
| Square Yards | Khadakpada/Kalyan | All 36 target markets remain uncollected. Historical browser access returned HTTP 403. |
| RealEstateIndia | Mumbai/Thane reported pagination saved | 1,071 IDs lack detail review; triage the 78 numeric-card candidates first. Resolve geography, price basis, freshness and project duplicates. Other 33 market searches largely remain. |
| CommonFloor | Khadakpada/Kalyan | Current robots request HTTP 403; no further requests. All 36 markets remain uncollected. |
| PropertyWala | Mumbai, Thane, Kalyan batch reviewed | All 65 saved IDs reviewed; resolve 59 holds and two candidates. Other 33 market searches remain. No verified Khadakpada parcel. |
| 360plot | Kalyan and Thane diagnostic captured | No usable listing cards in returned HTML; all markets lack an established usable dataset. |
| Reeltor | Khadakpada diagnostic complete | Saved search returned only other localities; detail routes disallowed by robots. No usable target dataset; other markets remain. |
| MahaRERA | Thane district / Kalyan | Supporting project-data track. Establish whether usable plot price and area evidence exists before treating it as a price source; statewide collection is not complete. |

**1acre.in is not a listing-scraping target.** It is a paid geospatial API
candidate for future feature data, not an established asking-price feed.

## All 36 target markets

| No. | Market | No. | Market | No. | Market |
|---|---|---|---|---|---|
| 1 | Mumbai | 13 | Virar | 25 | Karjat |
| 2 | Thane | 14 | Naigaon | 26 | Neral |
| 3 | Navi Mumbai | 15 | Nalasopara | 27 | Khopoli |
| 4 | Kalyan | 16 | Bhiwandi | 28 | Shahapur |
| 5 | Dombivli | 17 | Panvel | 29 | Asangaon |
| 6 | Ulhasnagar | 18 | New Panvel | 30 | Vasind |
| 7 | Ambernath | 19 | Taloja | 31 | Murbad |
| 8 | Badlapur | 20 | Kharghar | 32 | Palghar |
| 9 | Shahad | 21 | Dronagiri | 33 | Boisar |
| 10 | Titwala | 22 | Kalamboli | 34 | Alibag |
| 11 | Mira-Bhayandar | 23 | Kamothe | 35 | Pen |
| 12 | Vasai | 24 | Rasayani | 36 | Uran |

Khadakpada is a specific target locality within the Kalyan work, not an additional
city in this 36-market list. Preserve source locality and requested market
separately; nearby recommendations are not direct Khadakpada observations.

## Work order and batch approach

Continuation priority: reuse the latest growth review and unique-listing index;
do not rerun `priority_closeout.py`, which regenerates the old September 22 report.
RealEstateIndia Mumbai and Thane reported pagination is already captured. Triage
1,071 IDs still lacking detail review, starting with the 78 numeric-card IDs and
actual priority-city/locality addresses. Select at most 20 relevant details per
sequential pilot. Retain failed request 1152083 and unattempted plan entries as
unresolved. Keep related links and nearby results separate from full/direct
cards, and URL-embedded prices out of numeric asking-price fields.

1. Prioritize additional usable Khadakpada/Kalyan observations. Review the existing
   NoBroker pilot before repeating its requests.
2. Investigate current published MagicBricks navigation for Thane pagination and
   Shahad. Check whether the three previously empty markets now have direct results.
3. Pilot additional websites one at a time in Khadakpada/Kalyan. Start with one
   search page and at most 20 relevant detail pages; this is a cap, not a quota.
4. Use sequential batches: one source, one market and one browser page at a time.
   Start with at least ten seconds between page navigations and twenty seconds
   between markets. Record actual timing; browser subresources also generate traffic.
5. Preserve raw evidence, timestamps and outcomes. A failed request or challenge
   is not a listing page; a zero-result page is not proof that the market has no plots.
6. Measure distinct source IDs, useful new observations and unresolved duplicate
   candidates before expanding to more markets. Repeated ads are not independent parcels.
7. Update this guide after each batch with the run ID, markets attempted, counts,
   outcomes and exact remaining work. Do not mark a whole website complete after a pilot.

MagicBricks previously worked with Playwright using installed Chrome, a visible
window and a fresh context. That is a recorded working configuration, not a
guarantee of future access or a diagnosis of earlier browser failures.

## Fields and dataset handling

Capture source, listing ID, URL, observation timestamp, requested market, source
locality/address, property category, total asking price, plot area and explicit
unit. Preserve coordinates and precision, ownership, transaction type, seller or
project category, dates, road width and dimensions where present. Leave missing
values empty and retain original values alongside normalized fields.

Recompute INR/sq ft from total price and normalized area. Review unit conflicts,
locality uncertainty, property type and related advertisements before integration.
Keep original observations unchanged and produce versioned derived datasets.

## Code and data locations

All paths below are relative to the repository root.

- Run scripts with the working directory set to `services/estimatedparcelvalue/pipeline/`.
- Collector, audit, cleaning, ML and tests: `pipeline/magicbricks/` under that service.
  Keep this folder flat because scripts import their siblings directly.
- Exploration scripts: `pipeline/exploration/<source>/`.
- Existing observations and derived benchmark: `pipeline/magicbricks_mmr_data/`.
- Additional-source pilots: `pipeline/residential_land_pilots/<source>/<run_id>/`.
- Research models and comparisons: `pipeline/ml_experiments/`.
- Geography snapshots: `pipeline/raw_data/`.

The mobile village search and Groq fallback estimate are a separate product track.
This collection task does not require changing those backend or mobile features.

## Batch log

The original guide creation added no observations. Actual collection batches follow.

| Date / run ID | Website | Market / locality | Observations added | Outcome / next work |
|---|---|---|---|---|
| 2026-09-22 / 20260922T111922Z | MagicBricks | Kalyan | 2 | Single reported page fetched; 0 new source IDs; Khadakpada unresolved. |
| 2026-09-22 / 20260922T111947Z | MagicBricks | Thane | 30 | 1 new source ID. Page 2 HTTP 404; page 1 reports 208 results / 7 pages. |
| 2026-09-22 / 20260922T112023Z | MagicBricks | Mumbai | 75 | All 4 reported pages fetched; 5 new source IDs. |
| 2026-09-22 / 20260922_priority | PropertyWala | Thane, Mumbai, Kalyan | 66 pilot observations | 65 distinct IDs; 4 search pages + 1 detail page. 18 building/commercial-description flags, 3 land-use flags. No benchmark additions. |
| 2026-09-22 / 20260922_priority | MagicBricks | Khadakpada navigation | 0 | All-property page HTTP 200; plot links return to general Kalyan search. No separate locality plot route found. |
| 2026-09-22 / 20260922_priority/detail_batch_20260922 | PropertyWala | Mumbai, Thane, Kalyan detail pages | 20 pages | All 20 HTTP 200. Raw pages retained for review; no benchmark additions. |
| 2026-09-23 local / review_20260922T190153436976Z | PropertyWala | 20 saved details | 0 new observations | 1 exclusion, 17 holds, 2 pending candidates; 17 unique raw hashes. |
| 2026-09-23 local / 20260923_priority_authorized | Reeltor | Khadakpada | 20 diagnostic cards | Other localities only; nine title/area conflicts; no detail requests. |
| 2026-09-23 local / 20260923_priority | RealEstateIndia | Khadakpada, Kalyan West, Thane, Mumbai | 139 card observations / 128 IDs | Four first search pages and two details saved. Two Khadakpada IDs excluded; no benchmark additions. |
| 2026-09-23 / growth_details_01–02 | PropertyWala | Mumbai/Thane saved IDs | 25 unique documents | Detail review coverage now 65/65 IDs; no new independent parcels approved. |
| 2026-09-23 / growth_details_01Authorized | RealEstateIndia | Kalyan/Thane district | Six usable detail responses | Seventh response 503; batch stopped. Five holds, one pending Badlapur candidate. |
| 2026-09-23 / pagination and priority_localities | RealEstateIndia | Mumbai, Thane, Kalyan | 1,028 additional search observations / 951 new IDs | 19 Thane and 22 Mumbai reported pages saved; total 1,079 IDs. No benchmark additions. |
| 2026-09-23 / 20260923_growth | CommonFloor / 360plot | Kalyan/Thane investigation | 0 listing observations | CommonFloor robots 403; 360plot Kalyan/Thane HTML has no usable cards. |

Validation results and hash inventory are in the growth report. The original
MagicBricks observations and benchmark are unchanged. Do not call the full
Mumbai/Thane/Kalyan task complete: MagicBricks Thane pagination, independent
Khadakpada evidence, candidate review and other websites remain open.
