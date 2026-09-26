> Continued in [the targeted evidence status](RESIDENTIAL_LAND_TARGETED_STATUS_20260923.md): four detail captures, zero further admissions; benchmark still 365 rows.

# Residential land review and promotion — 23 September 2026

This is the latest status. It supersedes the growth report's review counts, not its raw inventory. Broad collection is paused under the user's revised priority.

## Delivered benchmark

- New version: **365 research asking-price rows / 246 evidence clusters**, from the original 364 rows / 245 clusters plus **one PropertyWala observation**.
- Original reviewed benchmark remains byte-for-byte unchanged: SHA-256 `250762e9678af0e6478a568743e17e8ee06fe089d3fa5009d3d8802831767b86`.
- New snapshot: `services/estimatedparcelvalue/pipeline/residential_land_pilots/benchmark_review_20260923T073144576096Z/benchmark_snapshot.jsonl`.
- New snapshot SHA-256: `d8de57bb1641a033e638c979ee49f99bd1c0895a0540403da3e853728f7f083c`.
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
