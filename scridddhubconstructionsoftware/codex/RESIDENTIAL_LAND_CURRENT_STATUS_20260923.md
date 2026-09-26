> Superseded by [the completed promotion status](RESIDENTIAL_LAND_PROMOTION_STATUS_20260923.md): REI1476394 admitted after final review; new benchmark **366 rows**, 54 tests passed. The pending-check text below is historical.

# Residential land current handoff — 23 September 2026

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
