# Pilot yield and decision

21 September 2026. Source: NoBroker. Run: `20260921T063915Z`.

| Measure | Observed |
|---|---:|
| Search pages captured | 1 |
| Direct listing cards / distinct direct source IDs | 3 / 3 |
| Nearby recommendation cards / distinct source IDs | 7 / 7 |
| Direct detail pages captured and reviewed | 3 |
| Direct addresses explicitly naming Khadakpada | 2 |
| Independently resolved parcel/locality locations | 0 |
| Potential source-label baseline candidate requiring review | 1 |
| Other direct candidates requiring substantive review | 2 |
| Observations admitted to training / baseline | 0 |
| Confirmed new physical properties | 0 |

The direct cards cover 760, 4,000 and 8,255 sqft. Arithmetic agrees with advertised rates within display rounding. These are asking prices, not sales. Seven nearby recommendations are retained separately and excluded from target coverage.

The 4,000-sqft result has an explicit Khadakpada address and consistent asking-price arithmetic. It is a potential experimental source-label observation, not a verified parcel. Its pin is a landmark, ownership is missing, and creation/reactivation/availability dates must not be conflated.

The 760-sqft Nebula CH result has a named project, unverified coordinates, unusual dimensions and road width. Keep it in review. Detail-page wording establishes that the floor count is permitted construction, not an existing building. Shared `BHK1` metadata alone also does not prove a building exists. Source approval claims are not legal verification. Do not read the generic “Listed by Broker / Sold Out / Wrong Info” reporting buttons as the listing's status or seller type.

The 8,255-sqft result names Gandhar Nagar in its address while the portal groups it under Khadakpada. Its exact target-locality membership remains unresolved; retain the original labels.

## Duplicate screening

Screened the three direct candidates against all 574 original source IDs, including excluded records, and against each other using project names, coarse pin proximity and similar area with locality text. Price was not used to establish distinctness. No candidate pair met those diagnostic rules. Descriptions, dimensions and authoritative parcel references are incomplete, so this does not prove any new independent physical property. The two original Kalyan observations name Kalyan Murbad Road and Dombivli, not resolved Khadakpada.

## Evidence and reproduction

- Diagnostic observations, review queue, duplicate candidates and unchanged-original-file hashes: `review/`.
- Machine-readable outcome: [pilot_report.json](review/pilot_report.json).

From the pipeline directory, reproduce offline into a **new** directory:

```powershell
.\.venv\Scripts\python.exe -B review_khadakpada_pilot.py --output residential_land_pilots/nobroker/20260921T063915Z/review_reproduced
```

The review refuses changed raw evidence and never writes the original dataset, audit or baseline. Diagnostic observations retain source-qualified IDs, original fields, raw pointers and hashes. Seller/contact data stays in raw diagnostic evidence and is not a modeling feature or proof of ownership.

Verification: four offline regression tests passed (`test_khadakpada_pilot`); all 11 generated review files reproduced byte-for-byte in `review_reproduced/`. SHA-256 checks verified 106 original collection/audit/benchmark files unchanged. These checks establish artifact preservation and reproducibility, not valuation accuracy.
