# Land Tenure & JDA (Screen 8.9, Level 1)

Rebuilt 2026-10-03.

## In short

**After a deal closes, the team records how the land is acquired.** Either it's bought
outright, or it's a Joint Development Agreement (JDA): the landowner keeps the land and takes
a share of the flats or the sales instead of cash. Under a JDA the project's money works
differently, so this has to be recorded before Financial Structuring.

Opened from **"Land Tenure & JDA Structure →"** on Government Approvals (Screen 7). Saved
**per parcel** (owner decision, 2026-10-03), because a JDA is signed with that land's owner.

## What the screen records

| Outright purchase | JDA |
|---|---|
| Agreed price (pre-filled from the asking price) | Type: area share, revenue share, or deposit + share |
| Stamp duty + registration | Your share of built area, with the landowner's share shown alongside (e.g. 62 : 38), or the landowner's share of revenue |
| Shows the land cost for the budget | Cash to the landowner on top of the share |
| | Security deposit, and whether it's refundable |
| | Stamp duty + registration on the JDA |
| | GST on development rights (reverse charge) |
| | Landowner is a co-promoter under RERA |

A "What changes vs buying outright" box updates as values are typed:
- no cash price for the land;
- the cash going out instead (deposit and stamp duty);
- the builder sells only their share of the flats;
- the Legal Check must also cover the landowner's title, the registered JDA and the power of
  attorney.

## Rules
- **The team enters every amount.** Law-driven items (stamp duty, TDS on a non-refundable
  deposit, GST timing) have hints saying the lawyer or CA confirms them. The app doesn't
  calculate legal amounts it can't stand behind.
- **Checks on save** (`domain.ParcelTenure.Validate`):
  - an area share must be between 0 and 100%;
  - a revenue share model needs the landowner's revenue share;
  - deposit + share needs the deposit amount;
  - switching tenure clears the other tenure's fields, so no stale JDA terms remain.
- **Every save is audited** (ADR-0002).

## API
- `GET /land-parcels/{parcelID}/tenure` returns 404 until terms are saved.
- `PUT /land-parcels/{parcelID}/tenure` saves the terms; 400 with a reason if they don't add up.

## Where the code is

| Part | File |
|---|---|
| Screen | `mobile-app/src/screens/LandTenureScreen.tsx` |
| Rules | `backend/internal/domain/parcel_tenure.go` (+ tests) |
| Storage | `backend/migrations/000045_land_parcel_tenures.*`, `repository/postgres/parcel_tenure.go` |
| Endpoints | `backend/internal/handler/parcel_tenure.go`, `usecase/parcel_tenure.go` |

## Not done yet
- **Financial Structuring doesn't read these terms yet.** The design says the JDA toggle should
  change Sources & Uses (no land purchase; deposit and stamp duty instead; revenue on the
  builder's share only). Financial Structuring still runs on the older project-level record
  (`land_tenures`, migration 009) and the single dev project. Connecting it is the next step.
- The older project-level `land_tenures` row still holds the September sample (62 : 38, ₹4 Cr).
  It's unused by this screen.
