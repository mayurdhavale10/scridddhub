
# Nearby registered transactions

## In short

**What it answers:** "What has land near this parcel actually sold for recently?", so a buyer can
judge whether the asking price is fair. Asking price is the seller's wish, the Ready Reckoner
rate is a government floor and the AI estimate is a guess. A registered sale is what someone
really paid, so it's the strongest evidence of market value.

**What it shows on the Compare screen**, for each parcel:
- registered land and plot sales (not flats or shops) within **3 km** of the parcel's pin, or in
  its village if it isn't pinned, from the **last 6 months**;
- each sale's date, area, price, rate per acre and distance;
- with 3 or more sales, the **median rate per acre** and its range;
- fewer than 3 sales in 6 months widens the window to **12 months**, and says so;
- 1–2 sales are listed but no typical rate is claimed; no sales says "none found".

**Where it stands:**

| Part | Status |
|---|---|
| Storage | Built: raw evidence, clean sales and a search log (migration 040) |
| Reviewed-record import | Built: `cmd/transaction_import` |
| API | Built: 3 km / 6 months rules |
| Compare screen section | Built |
| Collector that gathers sales automatically | Not built. Without it the section shows that data access is needed, never a made-up "no sales" |

How we get real data in (assisted search, RTI request, providers, Index-II copies), with the RTI
text ready to submit: [DATA_ACCESS_PLAN.md](DATA_ACCESS_PLAN.md).


Implemented 2026-09-29: Postgres evidence and sale storage, reviewed-record import, database-first
API, on-demand collector interface and persisted search leases/status, and the Compare screen.
**Live public IGR scraping is not implemented or enabled.** The server passes a nil collector;
cache misses return `access_required`, never a fabricated successful empty search.

## What the app does

1. Read the saved parcel's pin, or district/taluka/village if no precise pin exists. A text or
   village geocode is not treated as a parcel pin.
2. Query local Postgres for eligible registered land/plot sales. Precise pins use 3 km straight-line
   distance; village fallback resolves names/codes through the government village master.
3. Count the last six calendar months. With fewer than three sales, extend to twelve months and
   explicitly label the extension. Dates use the Maharashtra calendar; month ends are clamped.
4. A sufficient database result returns immediately. A sparse result claims a database search
   lease and calls a collector, if configured. Collection must persist evidence and sales first;
   the usecase rereads Postgres for the response. Without a collector it records `access_required`.
5. A concurrent caller reuses `searching`; UI polls while that status is active. A lease expires
   after 60 seconds, collection has a 20-second context deadline. Completed/partial/access-required
   results are cached for 24 hours, failures for five minutes. Search identity includes the exact
   point or full village hierarchy and the date window. New calendar days get a new search key.

The default radius and months are intentionally fixed. API responses never mix a village-only
match into the 3 km list. Survey-centre distances are labelled approximate; village-centre or
unknown coordinates only qualify for same-village matching. The spatial prefilter is sized for
Maharashtra, followed by exact Haversine filtering.

Statistics use one rate (`registered consideration / acres`) per eligible sale, then an unweighted
median. At least three records are needed to display median/range. Known non-sale deeds, excluded
records, flats and shops do not qualify. A reviewer must mark a sale comparable; partial interests,
multi-property bundles without allocated consideration, family/concessional transfers and
ambiguous areas should not be marked comparable. More records give more context, but the app does
not claim complete coverage or a formal valuation. Land/plot mix and land-use differences still
need refinement before using the median as an automated parcel valuation.

## Current source investigation

### NopeCHA free-tier test (2026-09-29)

Requested `GET https://api.nopecha.com/v1/status` from the local machine without an API key.
The live response was `{"error":12,"message":"Banned IP"}`. NopeCHA's
[API reference](https://nopecha.com/api-reference/) identifies error 12 as free-tier IP
ineligibility. No CAPTCHA image was submitted, no recognition job created, no paid credits
used, and no IGR search submitted. The free solver has therefore not been integrated/enabled.
NopeCHA's [developer guidance](https://developers.nopecha.com/) directs incorrectly blocked
home-internet users to its support channels for IP whitelisting. This does not establish
whether the local IP classification is correct; the provider must resolve eligibility.

### IGR form inspection

The live [official E-DISPlay v2.1 form](https://pay2igr.igrmaharashtra.gov.in/eDisplay/Propertydetails/index)
was fetched successfully on 2026-09-29. It displayed data fetched through 2026-09-28, year,
district/taluka/village selectors, article filters, a numeric free-text field explicitly labelled
for document/property/CTS/survey number **or registration year**, and a required CAPTCHA.

This updates the older repository assumption that the portal can only search an already-known
property number. A year-based village query may permit broader discovery, but that is **an
unverified hypothesis**: no search was submitted, no CAPTCHA solved, and no results/Index-II
documents collected. There is no verified radius API or verified complete village export here.
The fetched form is saved only in the ignored `data/property-search.html` directory.

Remaining work for a real collector:

- Obtain a real, human-completed search response and Index-II document, or documented API/bulk
  access. Respect the portal's session, CAPTCHA and request limits; do not mark blocked searches
  complete. Review the portal's stated reuse conditions before production redistribution.
- Verify whether a registration-year query enumerates a village, including result caps and all
  pages. Search each calendar year touched by the rolling window, then filter registration dates.
- Map IGR's own district/taluka/village identifiers to `mh_villages`; never assume the codes from
  different departments coincide. A 3 km circle can cross villages: all intersecting villages
  need discovery, not merely the village of the parcel's pin. The current government master has
  names/codes, not the village boundaries needed to prove this coverage.
- Parse real Index-II evidence for consideration (not government market value), deed type,
  unambiguous land area/unit and property type. Preserve the original first. Resolve survey
  coordinates using a verified cadastral source; a village centroid cannot supply precise proximity.
- Implement `usecase.RegisteredTransactionCollector`, wire it in `cmd/server/main.go`, and test
  successful discovery, pagination, partial results, CAPTCHA, timeouts and source schema changes.
  Return `searched` only for complete area AND date coverage, `partial` for incomplete discovery.
  A production collector that needs longer than 20 seconds should use a durable background worker
  and renewable leases rather than hold HTTP requests open.

## Storage and setup

Apply migration `000040_registered_transactions` after the existing migrations using the project's
normal migration tool. It was applied to the local development database on port 5434 on 2026-09-29,
advancing its clean migration version from 39 to 40. Restart the backend to load the new routes.

- `transaction_source_records`: original UTF-8 text up to 1 MiB or a file-store path, SHA-256,
  official source URL, full reference and original fetch time. Duplicate content for a source/reference
  returns the same ID. Raw evidence persists when normalization fails.
- `registered_transactions`: reviewed sales with normalized acres, consideration and optional
  government value, government village foreign key, location provenance and raw-record foreign key.
  `(document_no, office_code, registration_year)` prevents duplicate sales. Imports normalize office
  codes/document numbers to uppercase and trim whitespace. Use stable official office codes.
- `transaction_search_coverage`: a search is distinct from its results, including negative results
  and failures. No empty-cache claim of zero real-world activity is made.

Binary/PDF/large evidence is content-addressed in `services/registeredtransactions/data/files`.
The entire `data/` tree is ignored by Git. Keep downloaded records, metadata, DB exports and any
portal cookies there, not elsewhere in the repository. Do not add real evidence to test fixtures.
Production should replace the local file-store operation with private object storage and use
stable object keys; an S3 adapter is not supplied yet. Raw evidence is not served by public APIs.

## Import a reviewed record now

Save the original document in `data/` and create a metadata JSON with this shape. The values below
are illustrative only; substitute real source evidence, a real reviewer and valid master codes.
Do not load this example as a real transaction.

```json
{
  "source_reference": "OFFICE-CODE/2026/DOCUMENT-NUMBER",
  "fetched_at": "2026-09-29T12:00:00Z",
  "area": 40,
  "area_unit": "guntha",
  "single_property_full_interest": true,
  "transaction": {
    "registration_date": "2026-09-01T00:00:00Z",
    "document_no": "DOCUMENT-NUMBER",
    "office_code": "OFFICE-CODE",
    "office_name": "Official office name",
    "district_code": "MASTER-DISTRICT-CODE",
    "taluka_code": "MASTER-TALUKA-CODE",
    "village_code": "MASTER-VILLAGE-CODE",
    "survey_no": "SURVEY-NUMBER",
    "property_type": "land",
    "deed_type": "sale",
    "sale_price_rupees": 10000000,
    "government_value_rupees": null,
    "latitude": null,
    "longitude": null,
    "location_method": "unknown",
    "comparable": true,
    "exclusion_reason": "",
    "reviewed_by": "REVIEWER",
    "source": "Maharashtra IGR",
    "source_url": "https://pay2igr.igrmaharashtra.gov.in/eDisplay/Propertydetails/index"
  }
}
```

From `backend/`, with `DATABASE_URL` configured:

```powershell
go run ./cmd/transaction_import -raw ../services/registeredtransactions/data/index-ii.pdf -record ../services/registeredtransactions/data/reviewed.json
```

Supported units: `acre`, `hectare`, `sqm`, `sqft`, `guntha`. Compound or ambiguous local units must
be resolved from the document by the reviewer. Positive recorded consideration is required for
clean rows; a zero-price/non-sale record can still be archived as raw evidence. Reimporting a
reviewed correction updates the sale and retains previous raw evidence. A source reference must
include office/year/document identity, not just the document number.

## API and checks

- `GET /land-parcels/{parcelID}/registered-transactions`
- `GET /reference/registered-transactions?latitude=19.2&longitude=73.1`
- `GET /reference/registered-transactions?district=...&taluka=...&village=...`

OpenAPI is the client contract. The Compare screen loads independently, displays date, acres,
consideration, per-acre rate, distance/provenance and IGR reference. Sources may link to a portal
entry page if the original document has no stable URL; office/document number identify the record.

```powershell
# backend/
go test ./internal/domain ./internal/usecase ./internal/transactionpipeline ./internal/repository/postgres ./internal/handler ./cmd/server ./cmd/transaction_import
# Optional real-Postgres integration (uses a unique schema, all changes rolled back):
$env:TRANSACTION_TEST_DATABASE_URL = $env:DATABASE_URL
go test ./internal/repository/postgres -run TestRegisteredTransactionsPostgres -v
# packages/api-client/
npm.cmd run generate
# mobile-app/
node node_modules/typescript/bin/tsc --noEmit
```
