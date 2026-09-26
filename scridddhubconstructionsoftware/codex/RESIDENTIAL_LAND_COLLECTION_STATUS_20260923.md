# Residential land collection continuation — 23 September 2026

**Superseded by the later [23 September growth report](RESIDENTIAL_LAND_GROWTH_STATUS_20260923.md).**
RealEstateIndia now has 1,167 observations / 1,079 IDs, and all 65 saved
PropertyWala IDs have detail review coverage. The text below preserves the
earlier pilot checkpoint; use the growth report for current totals and backlog.

Priority remains Mumbai, Thane and Kalyan, including Khadakpada. This continuation
completed the saved PropertyWala detail review and small alternate-source pilots;
no entire region or website is exhaustively complete. No records entered the
reviewed 364-row benchmark. Dates in run paths use the local working date where
specified; actual response timestamps are UTC on 22 September (after midnight
23 September in Asia/Calcutta).

## Completed in this continuation

| Source / requested scope | Saved or reviewed | Result |
|---|---|---|
| PropertyWala — Mumbai | 10 saved detail IDs reviewed | Nine related 100-crore ads held; Wockhardt Towers excluded for office-project conflict. |
| PropertyWala — Thane district | 9 saved detail IDs reviewed | Three locality/area/price-basis holds, five project-configuration holds, one Kasara candidate pending review. |
| PropertyWala — Kalyan | 1 saved detail ID reviewed | Residential-plot candidate near Kalyan station; locality and duplicates unresolved; not verified Khadakpada. |
| Reeltor — Khadakpada | Robots + one search page; 20 cards / 20 IDs | All cards name other localities. Nine title/area conflicts. No property detail routes requested. |
| RealEstateIndia — Khadakpada | First search page: 21 card/link observations | Two direct IDs, 19 nearby recommendations. Both direct details captured and excluded for building-category conflicts. |
| RealEstateIndia — Kalyan West | First search page: 21 card/link observations | Includes six nearby recommendations; detailed eligibility review pending. |
| RealEstateIndia — Thane | First search page: 53 card/link observations | Includes broader district locations and related ads; not 53 verified Thane-city parcels. |
| RealEstateIndia — Mumbai | First search page: 44 card/link observations | Includes other markets such as Karjat/Khopoli; not verified Mumbai-city coverage. |

RealEstateIndia totals: **139 observations, 128 distinct source IDs**, including
76 full cards and 63 related links. Eleven repeated appearances are preserved as
search observations and linked to one entry per source ID in `unique_listing_index.jsonl`.
Forty observations have a numeric card price and explicit plot-area field; this
is not an eligibility count. The two excluded IDs recur across searches.
Source IDs do not establish independent parcels or cross-source uniqueness.

## Review findings

PropertyWala: 20 IDs / 17 unique raw hashes; 1 exclusion, 17 holds, 2 pending
candidates. All original hashes matched. Exact per-ID decisions and source
dates are retained in `detail_reviews.jsonl` and a readable `review.md`.

- P2369136: Wockhardt Towers is an office project despite a residential-land
  configuration. Source project date is 27 February 2018.
- P194298862 and P194298592: 1,050-sq-ft summaries conflict with descriptions of
  3 and 5.2 guntha respectively; Vasind descriptions conflict with Titwala/Thane
  West labels. Do not silently normalize away these conflicts.
- P722942926: Vasind description versus Thane West label; 5 lakh is a starting
  per-guntha price, not a reliable total for the summary area.
- P243109329: source listing date 19 September 2026; “near Kalyan station,” not
  verified Khadakpada. Same ID occurs in both Kalyan and Thane searches.
- P194563462: Kasara, 2,000 sqft / 68 lakh. Rustomjee project configuration
  P732945634 uses 2,075 sqft / 68 lakh. Keep project overlap unresolved.
- Four Lodha IDs share an identical document with four size/price configurations.
  They are shared project evidence, not four established independent parcels.
- Nine Mumbai ads share 100-crore pricing and similar descriptions, while their
  localities/areas differ. Hold as related ads; do not assert proven duplication.

RealEstateIndia direct Khadakpada details:

- 1202164: 16th floor, 48 total floors, under construction; built-up area 597 sqft
  versus description 672 sqft / 1.90 crore. Excluded from vacant-plot evidence.
- 1202160: G+17 single tower and residential/commercial booking offer. Excluded
  from vacant-plot evidence. The current page says “Call for Price”; the 79-lakh
  URL slug and 50,000 booking amount are not total asking-price observations.

Reeltor cards name Vasai/Vikramgad/Khardi/Vashi rather than Khadakpada. Its saved
robots response disallows `/property/`, `/projects/`, `/project/`, `/search` and
`/_next/`; the published SEO page was captured without those endpoints or assets.
RealEstateIndia robots permits the fetched static search and detail routes;
no disallowed service endpoint was requested. Robots permission alone is not
a finding that training reuse is licensed; all new evidence remains diagnostic.

NoBroker's existing review was read, not recollected: ten diagnostic cards,
three details, zero eligible observations, insufficient independently resolved
Khadakpada evidence and unresolved reuse permission remain its recorded outcome.

## Preservation, tests and exact evidence

All paths below are relative to `services/estimatedparcelvalue/pipeline/`.

- PropertyWala review: `residential_land_pilots/propertywala/20260922_priority/review_20260922T190153436976Z/`.
- Reeltor responses: `residential_land_pilots/reeltor/20260923_priority_authorized/`.
  A sandbox socket failure is separately retained in `reeltor/20260923_priority/`;
  it was retried only after network approval and is not a site-access refusal.
- RealEstateIndia responses: `residential_land_pilots/realestateindia/20260923_priority/`.
- Authoritative alternate-source extraction: `residential_land_pilots/alternate_review_20260922T193408521265Z/`.
  Contains observations, unique index, detail decisions, visible detail text,
  published links and summary. Earlier `alternate_review_20260922T193303628298Z`
  is superseded: it misnamed related links as full cards; source-ID totals agree.
- Validation: `residential_land_pilots/validation_20260923/preservation_and_tests.json`
  and `tests_1.txt` through `tests_3.txt`.

Twenty PropertyWala raw pages and nine new public responses (including two robots
files) have verified SHA-256 hashes. Raw bytes, request URLs, timestamps, status
codes and response headers are retained. Requests were sequential, with at least
10 seconds between pages and 20 seconds between requested markets; recorded
start/finish timestamps show actual timing. No contact forms or messages were sent.

Both historical benchmark snapshots, MagicBricks `records.jsonl` and the prior
PropertyWala observations are hash-unchanged. The original 889-row MagicBricks
prefix still matches `674718ad6d518bf3e330cc085828c47d53ced4f7f44dbedf082cda4a774a4da5`.
The current 364-row benchmark hash is
`250762e9678af0e6478a568743e17e8ee06fe089d3fa5009d3d8802831767b86`.

**34 tests pass**: 25 existing pipeline tests, six PropertyWala tests and three
alternate-source tests. Initial global-Python discovery lacked Playwright;
rerunning in the existing `.venv` resolved the environment failure without
installing packages. Use the pipeline as working directory:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s magicbricks -p 'test_*.py' -v
.\.venv\Scripts\python.exe -m unittest discover -s exploration/propertywala -p 'test_*.py' -v
.\.venv\Scripts\python.exe -m unittest discover -s exploration -p 'test_review_alternate_batch.py' -v
```

## Remaining regions and sites

| Source | Next work / remaining scope |
|---|---|
| PropertyWala | Review remaining 45 IDs from saved search cards; resolve 17 holds and two pending candidates. Other 33 market searches remain. |
| RealEstateIndia | Review remaining 126 distinct IDs after two exclusions. Resolve locality, related ads, freshness and price basis before more than a capped detail pilot. Only first search pages captured; pagination/completeness unresolved. Other 33 target markets remain. |
| Reeltor | Khadakpada diagnostic finished with no usable target evidence. No bypass of disallowed details. Other markets and any permitted alternative feed remain uncollected. |
| MagicBricks | Unchanged 996 observations / 580 IDs across 32 markets with observations. Six new September 22 IDs await review. Thane page 2 remains 404; Shahad unresolved; Kamothe, Rasayani and Vasind had zero direct results. Khadakpada unresolved. |
| NoBroker | Saved pilot remains insufficient; additional Kalyan and other 35 market searches uncollected. Resolve recorded reuse/locality issues. |
| 99acres | All 36 markets; historical 403, not retried. |
| Housing.com | All 36 markets; historical challenge, not retried. |
| Square Yards | All 36 markets; historical 403/terms stop, not retried. |
| CommonFloor | All 36 markets; navigation known, extraction untested. |
| 360plot | All 36 markets; target availability/extraction untested. |
| MahaRERA | Supporting project evidence only; plot-level asking-price feed not established. |

The [prior 36-region checklist](RESIDENTIAL_LAND_COLLECTION_STATUS_20260922.md)
is unchanged for MagicBricks. No new independent Khadakpada vacant-plot evidence
was admitted. Preserve requested market versus source locality when continuing;
district results and nearby cards must not inflate locality coverage.
