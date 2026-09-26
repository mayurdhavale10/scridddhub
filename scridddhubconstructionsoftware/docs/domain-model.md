# Level 1 (Planning) — Domain Model

Living document. Update this when the model changes; don't let it drift from `backend/internal/domain`.

**Implemented so far:** `Project`, `LandParcel`, `FeasibilityAssessment`, `LegalCheck` (Screens 4-6,
see prior notes), and **`GovernmentApproval` + `ApprovalPlaybook`** (Screen 7) — the first entity
with a real AI step. `ApprovalPlaybookEntry` is per-state reference data (seeded, not
user-generated — Maharashtra's 16-step sequence from the wireframe, **not independently verified
against real regulations yet**, see migration 000007's comment). `LandParcelSiteSummary` holds
the free-text project description plus 5 extracted characteristics (near_airport, coastal_site,
significant_tree_cover, uses_groundwater, unit_count) — extracted via Groq's API
(`internal/llm/groq_extractor.go`, model `openai/gpt-oss-20b`) through a
`usecase.SiteTextExtractor` interface, so the provider is swappable. `LandParcelApproval` tracks
one status per playbook entry per parcel; re-running the extraction ("Re-analyze") reconciles
conditional entries against the new characteristics **without ever resetting an approval that
already has real progress** (submitted/approved) — see `GovernmentApprovalUsecase.AnalyzeProject`.
**Also implemented: `LandTenure`** (Screen 8.9) — `outright | jda`, scoped to **Project**, not
LandParcel (a real scope transition: Screen 8 onward is project-scoped — "Sunrise Residency —
Sources & Uses", not a parcel name — confirmed by reading the real screen content, not assumed).
JDA-only fields (nullable when tenure_type=outright): jda_model, developer_area_share_pct
(landowner's share is derived as 100-x, never stored separately), cash_on_top_of_share,
refundable_security_deposit_rupees, jda_stamp_duty_rupees, gst_reverse_charge_applicable,
landowner_is_co_promoter.

**Also implemented: `FinancialStructure`** (Screen 8 — Sources & Uses summary, project-scoped).
Sources: buyer_collections, promoter_equity, construction_finance. Uses: construction, land,
approvals, marketing, working_capital — stored as 5 separate lines even though Screen 8's own UI
aggregates the last 4 into one "Land, Approvals, Marketing & Working Capital" display row, since
LandTenure (8.9) needs `land` addressable on its own ("Land STOPS being a cash Use" under a JDA).
`total_sources`, `total_uses`, and `balanced` are derived at read time, never stored — same
reasoning as LandTenure's derived landowner share. Deeper sub-screens (8.1 Buyer Collections
detail, 8.2 Promoter Equity detail, 8.3 Construction Finance detail, 8.5 Financial Health/Ask AI,
8.6 Uses detail, 8.7 Payment Schedule) are each their own future entities, not modeled here.

**Also implemented: `EscrowAccount`** (Screen 8.10) — the non-negotiable constraint at the top of
this file ("bank_balance must come from a bank statement source, never settable to an arbitrary
value by a request that only carries the developer's own claim") is now enforced structurally, not
just documented: two separate write paths, `UpdateDeveloperLedger` (the only one reachable from
the mobile app) and `UpdateBankFeed` (for a real bank integration to call, audited under a
distinct `bank-integration` actor — verified live, not just designed: the audit log genuinely
shows `bank-integration` vs `dev-user` as different actors). `Mismatch()` is computed at read
time and never silently reconciled either direction. No real bank statement-fetch integration
exists yet (a real per-bank engineering dependency, same honest limit the wireframe itself
states) — `bank_balance_rupees` stays unset until one exists.

**Also implemented: `CertificationPacket`** (Screen 8.4 + sub-drafts 8.4.1/8.4.2), one per project
per quarter, auto-creating its 3 child records: `EngineerDraft` (cost by tower, derived total,
Committed-vs-Actual cross-check flag), `ArchitectCertificate` (site-visit gated —
**the "no AI-draft path, ever" constraint above is enforced in code**, not just documented:
`CertificationPacketUsecase.CertifyArchitect` refuses to certify unless a site visit has already
been recorded completed — verified live, including the refusal), `CADraft` (escrow routing %,
compliance against a tolerance — calibrated to 2% from the wireframe's own worked example after
an initial 1% guess failed it, still flagged as unverified against real RERA guidance).
`WithdrawalEligible` is a genuine cross-entity derived value (depends on the architect's
certificate, not stored on either entity). Honest limit: engineer/CA draft figures are entered
directly for now — the wireframe's claimed AI auto-population from Tendering/Master
Schedule/Buyer Collections detail can't happen until those entities exist.

**Also implemented: `LenderCovenant`** (Screen 8.13, project-scoped) — DSCR and security cover
ratio compared against their covenant minimums; `DSCRBreached`/`SecurityCoverBreached`/
`AnyBreach` all derived at read time, never stored. Verified live including the actual breach
case (DSCR dropped below its minimum → `dscr_breached: true`), not just the healthy case.

**Also implemented: `AccountingSync`** (Screen 8.12, project-scoped) — a list of named external
system connections (Tally, GSTR-2B, Zoho Books, etc.) each with a connected/not_connected status,
plus last-sync figures (timestamp, vouchers posted/rejected). Every write already gets a real
`audit_log` row for free via the standard repository pattern (ADR-0002) — matches the screen's
own explicit requirement that "sync is not exempt from the same edit-log requirement," with no
special-casing needed. Honest limit, flagged in the migration: Tally's real API is XML
import/export, not a modern REST API — real per-installation integration work this table tracks
the resulting state of, doesn't solve.

**Also implemented: `GSTFiling` + `TDSFiling`** (Screens 8.14/8.15, project + period scoped, both
`period_year`+`period_quarter` — GST periodicity, monthly vs quarterly/QRMP, is a real open
product question flagged in the migration, not assumed). `GSTFiling` tracks GSTR-1/3B status and
the Rule 42/43 common-ITC-reversal calculation (exempt-turnover ratio, reversal amount).
`TDSFiling` tracks Form 26Q status, 194C/194J deducted totals, and a per-professional 194J
breakdown (194C stays aggregate-only — per-contractor detail lives on the not-yet-built Screen
15). Both carry the same "AI drafts, licensed professional files" honest limit as the 8.4
certification family — neither represents a real GSTN/TRACES filing integration.

**Also implemented: `TPAReport`** (Screen 8.16, project + lender + period scoped) — the actual
per-lender TPA/QPR submission document, distinct from `LenderCovenant`'s countdown-only tracking.
Assembled from a snapshot of figures certified elsewhere (physical progress, cost incurred, DSCR,
security cover) plus `units_sold`/`units_total` (sales velocity has no backing entity yet in this
build — no booking/sales-ledger screen exists — so those two fields are entered directly, same
honest limit as CertificationPacket's engineer/CA draft figures). `SalesVelocityPct()` is derived
at read time, never stored. `MarkSubmitted` is a distinct write path from `Upsert` — "a finance
team member reviews and submits it," never implied by saving a draft — mirroring
`CertifyArchitect`'s "AI drafts, human signs" discipline. **Caught while verifying live, not
silently matched**: the wireframe's own worked example shows "28/40" units sold *and* "71% sold"
in the same card, but 28/40 is exactly 70%, not 71% — the derived-value implementation here
computes the mathematically correct 70% rather than hardcoding the wireframe's apparent rounding
slip. Flagging this the same way the escrow-tolerance and negotiating-stage catches were flagged
in prior entities, not fixing the domain model to match a wireframe arithmetic error.

**Also implemented: `LitigationCase`** (Screen 8.17) — the developer's complete internal record
of every RERA tribunal complaint, consumer-court case, or contractor arbitration, open or closed.
Distinct from Screen 37's curated, opt-in, buyer-facing case count: a bad outcome logged here
never automatically becomes buyer-visible there.

**Real scope catch, caught the same way the LandTenure parcel-vs-project error was caught —
by reading the actual screen content instead of assuming it follows the prior 8.x pattern**: this
entity is **org-scoped, not project-scoped**. Every other 8.x entity this session belongs to one
project; this one doesn't, because the wireframe's own three example cards name three different
projects/counterparties side by side on a single screen ("Riverside Towers", "Deshmukh Builders",
"Sunrise Residency") and the screen's own framing calls it "this developer's own internal record"
— i.e. the whole portfolio, not one project's view. `ProjectID` is therefore nullable (a matter
may not tie to any single project) and the entity keys off `OrgID` instead. A `DEV_ORG_ID` dev
constant was added alongside `DEV_PROJECT_ID` for the mobile app, confirmed by querying the
seeded project's real `org_id`, not guessed.

Fields: `CaseType` (rera_tribunal | consumer_court | arbitration), `CounterpartyType` (buyer |
contractor), free-text `Forum` and `Subject`, `Status` (open | in_progress | closed),
`NextHearingAt`, `ClaimedAmountRupees`, `ResolutionNote`. `TotalExposureRupees` sums claimed
amounts across non-closed cases — "not yet a confirmed liability" per the wireframe — computed
from the case list, never stored. Verified live with all three of the wireframe's own example
cases (MahaRERA possession-delay complaint with an 11-day hearing countdown; a ₹6.2L contractor
arbitration moved from open to in_progress; a closed consumer-commission case with a resolution
note), including the `UpdateStatus` transition and its audit_log row. Honest limit: case status
is entered by the legal team/counsel, not scraped from tribunal/court systems.

**Also implemented: `RiskRegisterEntry`** (Screen 9, project-scoped) — "5 categories, not a
single score, matches how lenders actually track construction risk, not a generic checklist."
One row per project per fixed category (`legal_title`, `regulatory`, `financial`,
`contractor_execution`, `market`), unique on `(project_id, category)`. Each row carries a `status`
enum (`clear`/`flagged`/`on_track`, for badge coloring) plus free-text `headline` (the exact pill
label, e.g. "Clear · 4/4", "1 flagged") and `detail` (the explanation paragraph) — entered
directly by whoever reviews the register, not derived, since several categories (e.g. Market's
"2 competing projects launching nearby") have no backing entity in this build to compute them
from. Verified live with all 5 of the wireframe's own category assessments, including its one
genuinely mixed case (Legal & Title "Clear · 4/4" vs. Regulatory and Market both "1 flagged").
Mobile client re-sorts the alphabetically-returned rows into the wireframe's fixed display order
client-side (`CATEGORY_ORDER`) — presentation-only, not stored. The "Proceed to Tendering → 10"
CTA is rendered but inert: Contractor/Tender (Screen 10) doesn't exist yet in this build, so it
isn't wired as a real navigation link, same "don't link forward before the destination exists"
discipline the TPAReport → LitigationCase link was corrected to follow.

**Also implemented: `Tender` + `TenderBid`** (Screen 10, project-scoped) — "selective tendering:
3 shortlisted contractors, technical bid then financial bid, not an open public tender." A
project can run more than one tender over its life (civil work, MEP, finishing, ...), each scoped
by a free-text `TradePackage`; each `Tender` has its own shortlist of `TenderBid` rows.

`TenderBid` fields: `ContractorName`, `PastJobsWithDeveloper` (count), free-text
`PastPerformanceNote`, `TechnicalBidStatus` (qualified/disqualified/pending — the wireframe's own
examples show only "qualified," but disqualification is a real possible outcome of a shortlist,
not invented), nullable `FinancialBidRupees` (a contractor can be technically qualified before
submitting a financial number), and `Recommended` (the platform's own pick). **`Recommended` is
deliberately not the same thing as a final award** — the screen's own "Confirm & Set Master
Schedule" CTA is the actual award action, which belongs to Screen 11 (MasterScheduleMilestone),
not built yet, so no "awarded" state exists on this entity.

Verified live with all three of the wireframe's own bids under "civil work, Phase 1": Deshmukh
Builders (₹4.2 Cr, qualified, recommended, "2 past jobs with you · both on time, no RA bill
disputes"), Konkan Infra Co. (₹3.9 Cr, qualified, "1 past job with you · 3-week delay, no
disputes"), Patil & Sons (₹4.5 Cr, qualified, "no history with you — new contractor").

Mobile: `TenderScreen.tsx` renders the bid cards and the "Confirm & Set Master Schedule → 11" CTA
inertly (MasterScheduleMilestone doesn't exist yet), same discipline as RiskRegisterScreen's own
CTA — which, now that this entity exists, got wired into a real `onProceedToTendering` link
instead of staying inert.

**Also implemented: `MasterSchedule` + `MasterScheduleMilestone`** (Screen 11, project-scoped) —
"land to possession." One `MasterSchedule` per project, auto-creating its 5 fixed milestone rows
(`land_acquisition` → `approvals` → `construction_start` → `structure_complete` →
`committed_possession_date`) in one transaction, same parent+auto-created-children pattern as
CertificationPacket. Each milestone carries a `status` (complete/in_progress/pending) and a single
`TargetDate` — the actual completion date once complete, the current estimate otherwise; the
wireframe's differing subtitle phrasing ("complete — Mar 2026" vs. "in progress — est. complete
Dec 2026" vs. plain "est. Jan 2027") is reconstructed client-side from status + date, never stored
as three separate strings.

`ConfirmedAt` lives on `MasterSchedule` itself, not on any one milestone — RERA Section 18 stakes
(SBI MCLR + 2%/month buyer interest on a missed committed possession date) attach to the whole
schedule being locked in, not to a single row.

**Real bug caught and fixed while verifying live, not left in**: the initial handler declared
`TargetDate` as Go's `time.Time` in the request DTOs, which JSON-decodes RFC3339
(`2006-01-02T15:04:05Z07:00`) by default — the wireframe's month-precision dates ("Mar 2026") sent
as plain `"2026-03-01"` failed to parse. Fixed by accepting `target_date` as a plain date string
and parsing with `"2006-01-02"` explicitly. A second real bug surfaced right after: the usecase's
per-milestone `Validate()` required `MasterScheduleID` to already be set, but milestones are
constructed before the parent schedule's ID exists (the repository assigns it during the same
insert transaction) — fixed by removing that check from `Validate()`, since its only caller is
exactly the code path where the ID is legitimately still unset.

Verified live with the wireframe's own dates: Land Acquisition (complete, Mar 2026), Approvals
(in progress, est. complete Dec 2026), Construction Start (pending, est. Jan 2027), Structure
Complete (pending, est. Jun 2028), Committed Possession Date (pending, est. Mar 2029) — then a
real "Confirm Schedule" call setting `confirmed_at`. All 7 mutations (1 schedule + 5 milestones +
1 confirm) produced real audit_log rows.

Mobile: `MasterScheduleScreen.tsx` — the RERA Section 18 warning banner (verbatim), a timeline
with colored dots per status, and a "Confirm Schedule" button that disables once confirmed. Now
that this screen exists, **TenderScreen's own previously-inert "Confirm & Set Master Schedule"
CTA got wired into a real `onConfirmSetSchedule` link**, completing the same "wire forward links
only once built" chain as RiskRegister → Tender.

**Also implemented: `AuditLogEntry`** (Screen 8.11) — a read-only projection over the existing
`audit_log` table (ADR-0002), not a new domain table. `GET /audit-log?limit=N` returns the most
recent entries across every audited table, most recent first (default limit 50, capped at 200).

**Honest scope, matching what memory flagged before building this**: it is genuinely almost
entirely a read-only UI. The one design decision worth recording: the wireframe's own log entries
read as polished English ("A. Mehta (Engineer) edited cost-incurred, Tower A: ₹1.85 Cr → ₹1.9 Cr")
which requires bespoke per-table formatting knowledge that doesn't generalize across 20+ audited
tables. Instead, `AuditTrailScreen.tsx` computes a **generic field-level diff** between
`old_data`/`new_data` client-side (comparing JSON keys, skipping `ID`/`CreatedAt`/`UpdatedAt`) —
verified live to work correctly across genuinely different entity shapes (a `MasterSchedule`'s
`ConfirmedAt: null → <timestamp>`, a `MasterScheduleMilestone` insert with no prior value). This
is a faithful, generalizable version of "who changed what, previous value, new value, timestamp,"
not a re-implementation of the wireframe's bespoke sentences.

The "cannot be disabled" guarantee is unchanged from what ADR-0002 already established (append-
only storage, no admin delete path, no UPDATE/DELETE grant on the table at the DB role level) —
this screen doesn't add to that guarantee, it surfaces it. The MCA Companies (Accounts) Rules
citation is presented verbatim as the wireframe's own cited source, flagged in the screen's own
footnote as not independently re-verified against the current rule text in this build — same
honesty discipline as every other regulatory citation this session.

**Also implemented: `LandParcel.EstimatePrice`** (Screen 4 companion, `GET
/projects/{projectID}/land-parcels/estimate?area_acres=N`) — an on-demand price estimate for
someone adding a parcel who doesn't already know the price. Deliberately NOT automatic and never
used to second-guess a price actually entered (2026-09-16 product decision, prompted by a real
question about whether the app should verify/predict every entered price — it should not; a
builder's own entered price is trusted as-is, since they made the deal).

Algorithm, chosen over an external API or scraper for now: derive a ₹/acre range purely from
other `LandParcel` rows already recorded in the same project (their own `cost_rupees /
area_acres` ratios), then scale by the requested area. `comparable_count` is always returned so
the caller can judge confidence; zero comparables means no estimate at all, never a fabricated
one. Honest limit, deliberately chosen: no external market/listing data source yet — either a
paid real-estate data API or government sub-registrar records would be a real vendor/legal
decision, not something to wire up casually mid-feature. This starts thin (one project currently
has 2 real parcels to compare against) and gets more useful as real usage accumulates, rather
than depending on an external integration from day one.

Mobile: `CreateLandParcelScreen.tsx` shows a "Don't know the price? Estimate it" link only while
the Cost field is empty; on tap, shows the range and comparable count, with a "Use midpoint"
action that fills the (still fully editable) Cost field — never auto-fills silently.

Everything else below is design-stage only, not yet in `backend/internal/domain`.

**Correction (2026-09-15):** `LandParcel.stage` below was documented as `sourced | screened | dd`,
but the real Screen 5 design has a "Move to Negotiating" action the abbreviated list missed. The
actual stage set is **`sourced | screened | dd | negotiating`** — fixed in migration
`000004_add_negotiating_stage` after being caught by reading the real screen content instead of
trusting this file's summary. If any other entity's abbreviated description here turns out
similarly incomplete once its real screen is read, fix it the same way: migration + this file,
same session, not "someday."

## Core entities

```
Org
 └─ LitigationCase[]      (internal record — RERA tribunal / consumer court / arbitration; distinct
                           from the buyer-facing, curated TrustScore in Level 3; project_id
                           nullable — a matter may span or predate any one project. The only
                           org-scoped entity so far; everything below is Project-scoped)

Project
 ├─ LandParcel            (stage: sourced | screened | dd | negotiating; feeds FeasibilityAssessment)
 ├─ FeasibilityAssessment (valuation now vs. projected, verdict vs. alternative parcels)
 ├─ LegalCheck            (risk breakdown: ownership/litigation/encumbrance/regulatory; ownership chain; documents)
 ├─ GovernmentApproval[]  (state-specific playbook, sequenced, some conditionally excluded)
 ├─ LandTenure            (outright | JDA — governs FinancialStructure below)
 ├─ FinancialStructure
 │   ├─ Sources: BuyerCollections, PromoterEquity, ConstructionFinance
 │   └─ Uses: Construction, Land, Approvals, Marketing, WorkingCapital
 ├─ EscrowAccount         (bank-fed balance vs. developer ledger; mismatch flag)
 ├─ CertificationPacket   (quarterly)
 │   ├─ EngineerDraft         (cost incurred by tower; Committed-vs-Actual cross-check)
 │   ├─ ArchitectCertificate  (site-visit gated — never AI-draftable)
 │   └─ CADraft               (escrow routing %; withdrawal eligibility)
 ├─ LenderCovenant        (DSCR, security cover, next TPA/QPR due, breach flag)
 ├─ AccountingSync        (Tally/GST bridge — connection status, last sync, voucher count)
 ├─ GSTFiling             (period-based: GSTR-1/3B status, ITC claimed, Rule 42/43 reversal)
 ├─ TDSFiling             (quarter-based: Form 26Q status, deductions by 194C/194J)
 ├─ TPAReport             (per-lender template, assembled from certified figures, submission log)
 ├─ RiskRegisterEntry[]   (5 fixed categories: Legal, Regulatory, Financial, Contractor, Market)
 ├─ Tender
 │   └─ TenderBid[]       (per shortlisted contractor: technical + financial bid, recommended flag)
 ├─ MasterSchedule
 │   └─ MasterScheduleMilestone[] (5 fixed: land acquisition → approvals → construction start →
 │                                 structure complete → committed possession date)
 ├─ ApprovalPlaybook      (per-state; a project's GovernmentApproval[] is generated from one of these)
 └─ AuditLogEntry[]       (append-only — every mutation to any entity above writes here)
```

## Non-negotiable constraints

- **AuditLogEntry is append-only.** No UPDATE or DELETE grant on its table, enforced at the DB
  role level, not just application code. See ADR-0002.
- **EscrowAccount.bank_balance** must come from a bank statement source, never be settable to an
  arbitrary value by a request that only carries the developer's own claim. **Enforced, not just
  documented**: `UpdateBankFeed` and `UpdateDeveloperLedger` are separate write paths in
  `internal/usecase/escrow_account.go`; only the latter is wired to the mobile app.
- **ArchitectCertificate** has no AI-draft path. It is issued only after a recorded site visit.
  **Enforced, not just documented**: `CertifyArchitect` in
  `internal/usecase/certification_packet.go` refuses unless `SiteVisitCompletedAt` is already set
  — verified live, including the refusal case (a real 400 response, not a design intention).

## Parcel comparison (mobile, no new backend)

`LandParcelsScreen` supports a selection mode (checkboxes on cards; enter it via long-press on a
card, or the "Select" header link — added as a second, reliable entry point once long-press
proved awkward to reproduce with a mouse on an emulator). Normal tap still opens detail while not
selecting. Once 2+ parcels are selected, a "Compare" bar navigates to `ParcelComparisonScreen`.

Its layout was checked directly against the live Stitch screen ("Parcel A Feasibility Mobile
Screen", `projects/4654444127409167519/screens/b68e256c81424b49be2438e53171c9df`) rather than
inferred, and restructured to match it once the first cut (one flat table) turned out not to: a
top black-bordered **verdict card** (headline "`<parcel>` — `<verdict>`" + "est. margin X%" +
reasoning text), then three bordered card sections — **Planned Infrastructure**, **Nearby
Registered Transactions**, **Valuation Summary** (a table: Asking price / AI current valuation /
vs. asking / AI future valuation, per-parcel columns, plus a footer summary strip listing each
parcel's verdict + est. margin, mirroring the mockup's "A — growth pick / B — value pick" divider
line). Per explicit user direction, the mockup's own "Parcel A / vs. Parcel B" tab toggle was
deliberately left out (doesn't generalize past 2 parcels). Border weight is deliberately
hierarchical, matching the mockup: only the top verdict card gets the thick black border (2px,
`colors.primary`) — the three data cards (Infrastructure, Transactions, Valuation Summary) use a
thin light-gray border (1px, `colors.outlineVariant`), and the screen background is clean white
(`colors.surface`), not the app's usual off-white `colors.background`.

The top verdict card picks whichever selected parcel has a recorded verdict and the highest
`margin_pct` (`ParcelComparisonScreen`'s `recommended` computation) — never invented, and omitted
entirely if nothing in the selection has an assessment yet. Its reasoning line reuses
`FeasibilityAssessment.infrastructure_note`, since there's no separate narrative-reasoning field
in the data model; this is real data, not the mockup's exact sentence, so treat it as "closely
related," not identical wording. The infrastructure/transactions/margin content elsewhere uses
`.infrastructure_note`, `.comparable_sales_note`, `.margin_pct` — fields that already existed and
were already shown on `ParcelDetailScreen`, just missing from the first cut of this table.
Deliberately generalizes to N ≥ 2 parcels (columns scroll horizontally per card), not just a fixed
pair — this was the user's own explicit request for the entry point (multi-select from the list),
distinct from the Stitch mockup's own tab-toggle-inside-single-parcel-detail pattern (which
compares exactly one parcel against one `ComparedParcelID`). A parcel with no recorded assessment
shows "Not assessed" or "—" per column, never a fabricated value. No new backend endpoint was
needed — this composes the existing single-parcel and single-assessment endpoints client-side.

## Add Parcel: two-flow create screen (Screens 4.1/4.2, new field: Source)

`CreateLandParcelScreen` is a two-tab form, both tabs feeding the same `POST /land-parcels`:
**"I have a price"** (Flow A, Screen 4.1) — Name, Location, Area, Asking Price, Source, FSI,
Notes, all as before, price/area both required. **"Just checking a location"** (Flow B, Screen
4.2) — Location, Area (optional), Source, Notes; no Name field (the location itself stands in as
the name) and no price field at all; has its own "Estimate Value" button (reuses the existing
on-demand `/land-parcels/estimate` endpoint) and a "Save as Parcel" action that stores the parcel
with `cost_rupees = null` — the shown estimate is never persisted as an asking price.

This required real domain changes, not just UI: `LandParcel.CostRupees` and `.AreaAcres` are both
now `*int64`/`*float64` (migration 000021) — nullable for a Flow B parcel that hasn't been priced
or measured yet. Validation still requires `AreaAcres` whenever `CostRupees` is set (a priced deal
needs an area to make sense of that price elsewhere in the app); `EstimatePrice`'s comparable
selection explicitly skips parcels with no price or no area, so a scouted-but-unpriced parcel
never corrupts a future estimate with a ratio that doesn't exist. Every screen that reads
`cost_rupees`/`area_acres` (`LandParcelsScreen`, `ParcelDetailScreen`, `ParcelComparisonScreen`)
was updated to show "no price yet" / "area unknown" honestly rather than a fabricated `₹0.0 Cr`.

New field: `LandParcel.Source` (migration 000021) — free-form provenance ("where did you hear
about this parcel"), not a constrained enum, since it doesn't drive any business rule. The two
flows show different option vocabularies (a priced deal came through different channels than a
scouted location) but share the one column. New field: `LandParcel.SourceURL` (migration 000022)
— the actual listing/portal link backing up Source, so it's a checkable fact rather than just a
label, matching the same "cite a real source" discipline used elsewhere (Screen 5's infrastructure
note, "verified 3 days ago"). Only shown in the mobile form when the selected Source is one that
plausibly has a link (`SOURCE_OPTIONS_WITH_LINK` in `CreateLandParcelScreen.tsx`: "Online listing"
and "DP portal reservation check").

**SourceURL is actually verified now** (migration 000023, `LandParcel.SourceVerifiedAt`) — added
after the user directly asked "can we verify the source or not" and then "make it working." This
is a real HTTP reachability check (`LandParcelUsecase.VerifySource`, `POST /land-parcels/{id}/
verify-source`), deliberately narrow in scope: it only confirms the URL answers with a 2xx/3xx
status, and never reads, parses, or scrapes the page content — a link-liveness check, not a data
extraction. On-demand only (a "Verify" button on `ParcelDetailScreen`'s new Source section), same
discipline as `EstimatePrice`. A successful check sets `SourceVerifiedAt` to the real check time,
shown as "✓ Verified <date>"; a failed check reports "Could not reach this link just now" back to
the caller **without persisting anything** — deliberately, since "unreachable at this exact
moment" could be a transient blip, not a fact worth recording as permanent history, and a stale
`SourceVerifiedAt` from a past successful check is never cleared by a later failed one. Verified
live on-device against both a real reachable URL (`https://example.com`) and a deliberately
invalid one, confirming the honest-failure path actually leaves prior verification state intact.

Both Screens 4.1 and 4.2 also exist in the live Stitch project (screens `92ed89103160402b8ead
3968492ac8df` and `8b70b6a2d4a940e7bf19d6e5f02454cb`), generated from the user's own design-canvas
artifact rather than invented, and the mobile port was checked against those screenshots directly.

## Open questions (resolve before backend work touches these)

- Multi-tenancy: one Project belongs to one promoter/developer org. Confirm RBAC scoping
  (Developer / CA / Engineer / Architect roles) is enforced per-Project, not just per-org.
- JDA vs. outright purchase toggles which Uses lines apply — confirm this is a property of
  LandTenure, not duplicated logic in FinancialStructure.
- **Audit Trail's entry point is a placeholder, not a designed choice.** Screen 8.11 itself
  ("Audit Trail Mobile Screen" in the Stitch project) was built faithfully from its own design,
  but no screen in this build's actual mockups shows a link, button, or nav item leading to it —
  it's org-wide, not scoped to any one project, and the app has no real navigation shell yet
  (no tab bar, no settings menu) to give it a natural home. It currently lives as a link next to
  the "+" button on `LandParcelsScreen` (the app's root screen) purely because that's the only
  reachable screen not scoped to a single project — flagged 2026-09-16, pending a real decision
  once the app has actual navigation infrastructure.
