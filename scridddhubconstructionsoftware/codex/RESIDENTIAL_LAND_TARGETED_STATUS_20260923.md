# Targeted residential-land evidence batch — 23 September 2026

Latest continuation after the 365-row benchmark promotion. The user authorized targeted Khadakpada discovery and missing-evidence collection for saved candidates. Broad pagination and source expansion remain paused.

## What was gathered

Four previously saved RealEstateIndia IDs now have new public detail-page captures, all HTTP 200. Raw bytes, extracted text, URLs, request/response timestamps and SHA-256 hashes are preserved. No new listing IDs were counted. One sandbox socket failure is separately recorded; the authorized network run succeeded without site retries.

| ID / region | New evidence | Remaining admission blocker |
|---|---|---|
| 1452064 / Vare village near Neral | 2,034 sqft, Rs 18 lakh, Rs 885/sqft agree; description names Whispering Woods | No explicitly labelled listing date; locality remains source-reported |
| 1443033 / Khardi, Thane | 2,112 sqft, Rs 29 lakh, Rs 1,373/sqft agree; detail identifies Our Town | No listing date or parcel number; linked to two saved Our Town advertisements |
| 1511639 / Juhu, Mumbai | 9 guntha, Rs 50 crore, Rs 5.56 crore/guntha agree in original unit | No listing date; retain source-rounded 9,800 sqft separately |
| 1184056 / Karjat–Patgaon/Murbad | Detail confirms named Madhusudan Heritage project and 1,744 sqft | Displays Rs 7.25 lakh **per sqft**, versus Rs 7.25 lakh total (~Rs 416/sqft); locality and same-area project identity also unresolved |

Three missing rates have been resolved. Three listing dates are still missing. Footer rendering timestamps and copyright years are not listing dates and were not substituted. The fourth candidate's rate conflict is now directly documented instead of merely missing.

## Duplicate checks and admission

Added two conservative same-project groups: Our Town (1443033, 1451382, 1346903) and Madhusudan Heritage (1184056, 291388, 1014923). The latter contains two 1,744 sqft advertisements; one labels the area built-up. This is a duplicate candidate, not proof of identical parcels. Both groups contribute zero rows. Existing cross-source counting decisions remain in force.

**Zero additions this batch. The current benchmark remains 365 research rows / 246 evidence clusters.** No duplicate copy was presented as a new benchmark version. Both the original 364-row snapshot and the current 365-row snapshot remain hash-unchanged. This batch resolved evidence gaps but did not establish freshness or resolve the remaining conflicts; it does not improve model coverage.

## Khadakpada

Four narrowly targeted discovery queries were checked. A Housing.com result remains an unverified lead labelled Kalyan West; its historical challenge block was respected, with no retry or workaround. NoBroker results repeat saved candidates with unresolved reuse/date/geometry issues. Reeltor still supplies other localities. The agent-site result advertises Khadakpada apartments and Dahanu land, not Khadakpada residential plots.

**Khadakpada verified coverage remains zero.** Search snippets were discovery only and were not promoted or treated as raw listing evidence. No source-wide collection was started.

## Storage and validation

All paths below are relative to `services/estimatedparcelvalue/pipeline/`:

- Raw captures: `residential_land_pilots/realestateindia/20260923_targeted_evidenceAuthorized/`
- URL plan: `residential_land_pilots/realestateindia/targeted_evidence_authorized_plan.json`
- Decisions, raw hash manifest, full extracted detail text, additional duplicate groups and discovery notes: `residential_land_pilots/targeted_review_20260923/`
- Current benchmark: `residential_land_pilots/benchmark_review_20260923T073144576096Z/benchmark_snapshot.jsonl`
- **50 tests passed** (25 MagicBricks, 6 PropertyWala, 19 exploration); logs and hash checks are under `targeted_review_20260923/validation/`.

RealEstateIndia detail-review coverage is now **12 IDs**, up from 8. Source-ID totals remain unchanged: 1,079 REI, 65 PropertyWala and 580 MagicBricks. Four detail captures are evidence enrichment, not four new listings. The 78 numeric REI candidates remain triaged, with four decisions refined here. No new benchmark evaluation was necessary because its rows did not change.

## Next work

Prioritize a concrete Khadakpada residential-land lead accessible through permitted routes. For existing candidates, only request a published page likely to supply the particular missing evidence: a listing date for 1452064/1511639; date and parcel identity for 1443033; corrected rate, locality and parcel identity for 1184056. Do not refetch these four detail pages merely to increase volume; they currently omit or contradict the required fields. Seller contact requires explicit user authorization to send messages, so none was attempted.

Mumbai/Juhu, Neral/Vare, Thane/Khardi and Karjat/Patgaon received targeted evidence review; none is a completed regional inventory. Khadakpada remains unresolved. MagicBricks Thane pagination, Shahad and broad new-source collection remain deferred.
