# RealEstateIndia aggregate blocker review — 23 September 2026

Offline aggregate only. No page requests, individual detail reviews, policy changes or promotions. Both reviewed benchmarks are hash-unchanged.

## Denominator correction

There are still **78 unadmitted numeric candidates**. The requested **74** means those 78 minus the last four targeted captures. Six of these 74 already have earlier detail reviews: only **68** have no saved detail review. All 78 already have card-level triage.

## Primary blocker for the remaining 74 (exclusive; totals 74)

| Primary blocker | Count |
|---|---:|
| Above 10000 sqft research limit | 46 |
| Generic project inventory / starting offers | 11 |
| Other recorded price / area / locality conflicts | 6 |
| Building / apartment / bundled bungalow | 5 |
| Other parcel identity / multiple-parcel / land-use issues | 3 |
| Known cross-source project conflicts | 3 |

These are existing primary decisions. In particular, oversized parcels were assigned the area blocker first; this can hide additional issues. Missing date overlaps other blockers and must not be read as zero simply because it is not a primary category.

## Overlapping known blockers

| Blocker | Remaining 74 | All 78 |
|---|---:|---:|
| Missing posted date in all saved cards | 33 | 36 |
| Above 10000 sqft | 46 | 46 |
| Generic project inventory | 11 | 11 |
| Building / apartment / package evidence | 5 | 5 |
| Known locality / project-location conflict | 4 | 5 |
| Broad locality needing precision (not a proven conflict) | 1 | 1 |
| Known displayed unit-rate conflict | 2 | 3 |
| Other price / area / package-basis ambiguity | 6 | 6 |
| Member of recorded duplicate/project candidate group | 5 | 7 |

Do not add these rows: one listing can appear in several. Rate/locality/duplicate counts are minimums established by existing evidence, not claims that the rest passed. No-date and area counts are exhaustive for these saved cards.

## Is date omission structural?

- Remaining numeric pool: **33/74 (44.6%)** have no posted date in any saved card; **41/74 have one**. It is common, but not a majority of this numeric subset.
- All numeric candidates: **36/78 (46.2%)** lack dates.
- Within the existing area limit, remaining pool: **9/28 (32.1%)** lack dates; **19/28** have them.
- Broader saved source sample: **759/802 full cards (94.6%)** omit a date; **43/802** expose one. The 277 related-link-only records are excluded from this denominator. The numeric subset is much more date-complete than the source inventory overall.
- **10/10 saved detail pages for numeric candidates** have no explicitly labelled listing date in the listing section and no detected datePublished/dateModified or populated post_date markup. **Seven of those ten** have dates on their saved search cards. CSS contains a post_date style, which is not a populated date field.

**Inference:** date omission is a systemic source-data issue and the sampled detail template is not a dependable date-recovery route. This sample does not prove that every REI page omits dates, or that dates cannot exist elsewhere. Missing date does not mean stale. Fetch timestamps, render timestamps and search-engine crawl times do not prove listing freshness.

## Policy decisions to make once, before further requests

1. **Freshness:** either keep the current requirement for an explicit source date, or define a separate date-unknown research cohort with an explicit missingness flag. Do not silently put undated observations into the dated benchmark. Keep source posting date and capture time separate. Using a dated search card is already possible; a detail page need not repeat it.
2. **Parcel size:** 46/74 (62.2%) exceed the current 10,000 sqft scope. Decide whether to keep them outside this benchmark or create a separate large-parcel segment before fetching their details. This is the largest current blocker.
3. **Displayed rate:** requiring a separately displayed source rate is an audit policy, not a mathematical need when unambiguous total price and area exist. Consider a documented computed-rate policy for missing-rate cases; known contradictions still require resolution and must never be overwritten with the computed value.
4. **Locality:** accept consistently source-reported locality only to the same standard as the existing research benchmark; preserve uncertainty. Actual contradictory place/project labels need resolution. Do not treat all generic project panels as reliable location evidence or automatically ignore them.

Recommendation: stop serial detail fetching for date recovery. First settle freshness and the large-parcel scope; then batch only the eligible remainder by the precise evidence still missing. No policy was changed here. Broad scraping, further detail review and promotion are paused pending this discussion.

Machine-readable counts, category member IDs and the ten-page date evidence audit are in `services/estimatedparcelvalue/pipeline/residential_land_pilots/rei_blocker_aggregate_20260923/`. Reconciliation assertions and both benchmark hash checks passed.
