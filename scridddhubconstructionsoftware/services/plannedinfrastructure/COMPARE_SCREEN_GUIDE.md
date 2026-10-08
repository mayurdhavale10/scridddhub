# Compare Parcels: what the "Planned Infrastructure" section shows

For anyone joining the project: what this section tells a land buyer, where each item comes
from, and how far we look. For how planned projects are collected and reviewed, see
[README.md](README.md), [RUNBOOK.md](RUNBOOK.md) and [REVIEW_GUIDE.md](REVIEW_GUIDE.md).

## Why it exists

A land buyer comparing parcels is really asking: **what is around this land, and what is
coming?** Future access (a metro station, an expressway exit), everyday needs (schools,
hospitals) and risks (a dumping ground, a mangrove buffer) move land value more than almost
anything else. This section answers that for every parcel side by side, with a source for each
fact.

## Where the parcel is measured from

Every distance is straight-line, from the parcel's location, most precise first:

1. **Its pin:** dropped on the map when the parcel was added (the Location field in both tabs
   of New Land Parcel), or later from the parcel's detail screen ("Location on map"). A pinned
   parcel is measured from the exact plot.
2. **Its typed location**, if not pinned. We look up the area name (OpenStreetMap's Nominatim),
   which can be 1–2 km from the actual plot. The detail screen says so, and suggests pinning.

Why the pin matters: land in India has no street address, so turning typed text into a location
is always a guess. The person adding the parcel knows where it is.
See `docs/design/parcel-location-first-principles.md`.

## Two kinds of items

| | Planned projects | Places already there |
|---|---|---|
| Examples | Metro Line 12, the Missing Link, the bullet train | Kalyan Junction station, a school, a dumping ground |
| Source | Official agency websites (MMRDA, MSRDC, NHSRCL…), every fact quoted from the page | OpenStreetMap (community map data) |
| Checked by a person? | Yes: only approved projects are shown | No: shown as mapped |
| How far we look | 10 km | Depends on the kind (table below) |
| Status shown | Planned / In progress / Partly open / Already open | Existing places show only their type and distance |

In each group, planned projects are listed first, then places already there. Each group shows
its nearest 3, with "See all" for the rest. The footer credits the sources once ("Projects:
MMRDA … Map data © OpenStreetMap contributors"); OpenStreetMap's licence requires that
credit.

## The six groups

| Group on screen | What's in it | Why a buyer cares |
|---|---|---|
| **Connectivity** | Planned: metro, suburban rail, high-speed rail, highways, roads, bridges, flyovers, airports, bus depots, jetties. Existing: railway and metro stations, expressway exits, airports | Commute and access drive demand and price |
| **Jobs & growth** | Planned: IT parks, SEZs, industrial estates (MIDC), logistics parks, data centres, growth centres, new towns. Existing: named industrial areas | Jobs nearby mean buyers and tenants |
| **Schools, hospitals & parks** | Schools, colleges, hospitals, parks and grounds, malls | Everyday livability for residential projects |
| **Utilities** | Planned: water supply schemes, sewage treatment, power substations. Existing: transmission substations, water works | Whether the land can be serviced |
| **Planning & zoning** | Existing: mangroves, forest land, protected areas, measured to their nearest edge. Planned (no data yet): Development Plan reservations, TOD zones, coastal zone (CRZ), eco-sensitive zones | Legal limits on what can be built |
| **Watch out** (red) | Existing: landfills and dumping grounds, sewage plants, high-tension power lines, cemeteries and crematoria, quarries. Planned (no source yet): polluting industry, flood zones | Things that can lower value or block approval |

## How far we look (places already there)

| Distance | Kinds |
|---|---|
| 40 km | Airports |
| 5 km | Landfills, industrial areas, expressway exits |
| 3 km | Railway and metro stations, schools, colleges, hospitals, malls, sewage plants, quarries |
| 2 km | Parks, power substations, water works |
| 1.5 km | Forest land, protected areas |
| 1 km | High-tension lines, cemeteries and crematoria, mangroves |

The distances are in `domain.NearbyPlaceRadiusKm` (`backend/internal/domain/nearby_places.go`).
A place appears once, at its nearest point: OpenStreetMap maps one power line as many segments,
and some schools both as a point and as a building outline.

## How fresh it is, and why a new area can start empty

- **Places already there:** looked up live from OpenStreetMap's Overpass service the first time
  anyone opens an area, then kept for 30 days per ~1 km square. The first lookup waits up to
  12 s. Anything still loading appears on the next open. The public Overpass server is
  often overloaded (HTTP 504), so a brand-new area can take a few minutes to fill in.
- **Planned projects:** come from the daily 1 PM pipeline run and from the on-demand area search.
  If nothing is within 10 km, the screen says "Searching official sources for projects around
  here — check back later". Found projects wait for review before they show.

## Known gaps (as of 2026-09-29)

- **Planned projects cover the Mumbai region only.** A Pune parcel gets OpenStreetMap places, but
  no planned metros or roads, until regions are added (design doc, layer 3).
- **The public OpenStreetMap server is unreliable.** The fix is to run our own copy (planned,
  like the self-hosted geocoder).
- **Some lines have few map points.** Metro Line 12 has Taloja, Pisarve and Kalyan only, the
  places MMRDA's page names. Points in between wait for an official station list.
- **Planning & zoning planned data**, flood zones and polluting industry have no source yet.
- The other Compare sections are documented separately: **Nearby Registered Transactions**
  (`services/registeredtransactions/README.md`) and **Valuation Summary**
  (`services/valuationsummary/README.md`).

## Where the code is

| Part | File |
|---|---|
| Screen and grouping | `mobile-app/src/screens/ParcelComparisonScreen.tsx` |
| Pin picker | `mobile-app/src/components/LocationPicker.tsx` (used by `CreateLandParcelScreen.tsx` and `PinLocationScreen.tsx`) |
| API (planned items + places already there) | `GET /land-parcels/{id}/planned-infrastructure`: `backend/internal/handler/planned_infrastructure.go` |
| Matching and pin-first logic | `backend/internal/usecase/planned_infrastructure.go` |
| Groups, kinds, distances | `backend/internal/domain/infrastructure_kinds.go`, `nearby_places.go` |
| OpenStreetMap lookups and cache | `backend/internal/osm/` (queries in `overpass.go`, caching and queueing in `finder.go`) |
