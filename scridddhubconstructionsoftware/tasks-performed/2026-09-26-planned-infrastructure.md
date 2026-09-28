# 2026-09-26 → 2026-09-28: Estimate Value, Compare Parcels, Planned Infrastructure

**Goal:** fix the Estimate Value flow, then build Screen 5 (Compare Parcels), starting with
"Planned Infrastructure": for any property, what's coming nearby, from official sources only.

## Done

### 1. Estimate Value (Add Parcel)
- Fixed the AI-fallback bug where a cost appeared before an area was entered.
- Path B (location not in our database) now has the same fields and layout as Path A.
- Valuation only runs when the user presses **Estimate Value**.
- Village dropdown restored. Path A sends location, area, source, notes and the database
  (Ready Reckoner) rate to the LLM. Path B sends the same minus the database rate.
- Explained how a ₹525 Cr estimate was derived.

### 2. Compare Parcels review
- Compared the screen against the Stitch design and the wireframe artifact.
- Agreed build order: Planned Infrastructure, then Nearby Registered Transactions, then
  Valuation Summary.

### 3. Planned Infrastructure: data model and API
- Shared reference list of projects (migrations 028–031): areas, located points, review status
  (pending / approved / rejected; only approved projects are shown), coordinate source,
  and a geocode cache.
- Matching: straight-line distance within 10 km of the property's resolved location, with
  taluka fallback for projects that have no points.
- API: `GET /land-parcels/{id}/planned-infrastructure` and
  `GET /reference/planned-infrastructure?location=`.
- Docs: `services/plannedinfrastructure/README.md`, `PIPELINE_PLAN.md`, `REVIEW_GUIDE.md`,
  `RUNBOOK.md`, ADR 0007, Mermaid architecture diagrams, `docs/self-hosted-nominatim.md`.

### 4. Data pipeline (Step B: fill the database)
- Stages: Sources → Fetch (robots.txt, 1 request per 5 s per host, no bypassing blocks) →
  Extract (Groq, with evidence quotes) → Verify (every value must be quoted from the page) →
  Locate (official KML first, then geocoder, limited to the Mumbai region) → Dedupe → Store.
- Publish policy `INFRA_PUBLISH_POLICY`: strict / evidence (default) / auto.
- Tools: `cmd/infra_pipeline` (run, dry-run, per agency or source) and `cmd/infra_review`
  (list, points, drop-point, approve, reject, reopen).
- MMRDA: 16 project pages and the Metro Line 5 KML registered. Reviewed at the owner's request:
  12 approved, 3 rejected (outdated pages), 4 left pending.

### 5. Step C: on-demand search for uncovered areas
- A lookup with nothing nearby queues its ~5 km area (migration 032). A background worker
  searches official domains only (Exa search API), then runs the pipeline on what it finds.
- Tested live on Alibag: 12 official pages found. PIB was skipped (robots.txt disallows it),
  and a CIDCO bot-challenge page was recorded, not bypassed.

### 6. Step D: automated runs
- `infra_pipeline --scheduled --max-duration 2h` searches queued areas, then refreshes all
  sources. It stops cleanly when Groq's daily limit runs out and keeps what it gathered.
- Windows Task Scheduler task **"ScridddHub infra pipeline"** runs daily at 13:00 (switch to
  weekly later).

### 7. UI fixes (Compare screen)
- Removed internal text ("Location understood as…", "Exact place not found…") and the
  "Claude (AI)" review label.
- Readable text: nothing under 12px; grey `#a3a3a3` replaced with `#6b7280`.
- Status wording: operational → "Already open", no stated status → "Planned / in progress".
  Never "we don't know".
- "Finding nearby infrastructure…" loader per parcel.

### 8. All six infrastructure groups
- Categories: **Connectivity, Jobs & growth, Schools & hospitals, Utilities, Planning &
  zoning, Watch out** (migration 033, 33 project kinds). The screen groups by category and
  shows the nearest 3 in each, with "See all".
- **Existing places from OpenStreetMap** (migrations 034–035): schools, colleges, hospitals,
  named industrial areas, transmission substations, water works, landfills, sewage plants and
  high-tension lines. Cached per ~1 km area for 30 days. Shown as "Source: OpenStreetMap"
  (not reviewed data).
- **More agencies:** MSRDC (project list, with a link rule that keeps `?ID=` and follows
  sub-lists) and NHSRCL (bullet train overview and stations). The area search now runs two
  queries: transport, then jobs/utilities/hazards.

## Decisions (and why)
- **Official sources only, robots.txt respected, no bypassing blocks or captchas.** Legal
  safety and trust.
- **AI drafts, a human approves.** Nothing extracted by the LLM is shown until approved.
  Approved projects only accept points from official files, never geocoder guesses.
- **Free public geocoder (Nominatim) for development**, capped at 300 lookups per run.
  Self-host before launch.
- **No Redis.** Postgres caches (geocode, OpenStreetMap places) are enough at this scale.
  Discussed Shopify's reasoning.
- **Exa for search.** Google Custom Search is closed to new customers, Tavily and Brave wanted
  a card, and Groq browser search was unreliable.
- **Existing places are kept separate from planned projects** in the API (`existing` vs
  `items`), so unreviewed community data is never presented as an official plan.
- **Agencies not registered** (reasons in `backend/seeds/infrastructure_sources_more_agencies.sql`):
  - CIDCO: pages default to Marathi. The area search already finds its English pages.
  - MIDC: no per-estate pages. The Jobs section uses OpenStreetMap instead.
  - MJP and MSETCL: content is only in PDFs or on an external dashboard.
  - MMRCL: bot challenge.
  - NHAI, NMMC, MRVC: JavaScript-only sites.
  - KDMC, TMC: citizen-service portals only.
- **Nearby Registered Transactions:** IGR's free search sits behind a captcha, which we won't
  bypass. Options: manual comparables, pooled deal data, or licensed data.

## Problems hit and fixes
- **MMRDA page reduced to 98 characters:** the "sidebar" navigation filter stripped the
  content. Narrowed the filter and pinned the real page as a test.
- **ASP.NET sites (MSRDC) gave 0 characters:** the whole page sits inside one `<form>`, which
  was being skipped. Now only form controls are skipped. Pinned as a test.
- **"Kalyan, Mumbai" geocoded to Chembur**, and that guess hid approved Metro Line 12. Now
  state-wide lookup comes first, and approved projects accept official points only.
- **Groq limits:** per-minute limits are retried after the stated wait. The daily limit
  (200k tokens) stops the run cleanly. Occasional invalid JSON is retried once.
- **Model split bullet-train stations into separate projects.** The prompt now says stations
  belong to their line.
- **OpenStreetMap public server often returns 504.** Queries go one at a time with retries,
  there's a 12 s cap per request, and after a failure the area isn't retried for 2 minutes.
  Regex queries and `office=it` made queries time out, so they were dropped.
- **Duplicate URLs** (`www.`, `?page=1`) and Marathi duplicates of English pages: fixed by URL
  normalisation.
- **PowerShell 5.1 broke on em dashes in scripts:** replaced with hyphens.
- **Docker CLI missing on PATH:** migrations run through golang-migrate via `go run` (command in
  RUNBOOK §2.3).

## Commits
- `0d14977` Replace old app with the ScridddHub construction software monorepo
- `4fccdc0` Planned infrastructure: on-demand area search, scheduled runs, review tooling
- `0b6814d` Planned infrastructure: six groups, OpenStreetMap nearby places, more agencies

## Still open / next
- **Planning & zoning (group E):** DP reservations, TOD zones, CRZ, as its own feature.
- **Nearby Registered Transactions:** choose a data source (manual comparables, pooled deals,
  or licensed).
- **Valuation Summary:** computed from real inputs (Ready Reckoner floor, asking price, AI
  range, cited uplift), with an "Assess" button that drafts for human review.
- MSRDC items whose only place name is in the title get skipped, e.g. "Flyover at Barfiwala
  Junction, Andheri". Use the title as the place.
- Review the MSRDC and NHSRCL projects after the next 1 PM run (they arrive as pending).
- Before launch: self-host Nominatim and Overpass.
- Android hardware back button exits the app.
- In-app review screen (phase 3).
