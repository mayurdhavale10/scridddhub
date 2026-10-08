# Knowing where a parcel is: a first-principles design

Status: layer 1 (pin the parcel) built and checked on the emulator, 2026-09-29. Layers 2–4 are
proposed. Owner decision: a free OpenStreetMap map for the pin.

## 1. The problem, in one sentence

**For any parcel a user adds, anywhere we operate, show a correct, sourced and honest picture of
what is around it and what is coming, without our team having prepared that area in advance.**

Today that is true only for places we filled by hand (Godrej Hill and Riverfront in Khadakpada).
A stranger's parcel in a village we've never heard of, or in Pune, gets a weaker answer or none.

## 2. Asking "why" until we hit the root

**Why does a user look at nearby infrastructure at all?**
They are deciding whether to buy a piece of land and at what price. Land value is driven by
future access (a metro station, an expressway exit) and by risks (a dumping ground, a mangrove
buffer, a reservation). So the answer feeds a money decision.

**Why is our answer unreliable for a parcel we didn't prepare?** Three reasons, checked in the
code on 2026-09-29:
1. We don't know where the parcel is. A parcel stores only free text ("Godrej Hill,
   Khadakpada"), with no latitude or longitude. The geocoder didn't know "Godrej Hill", so it
   used the centre of Khadakpada, 1–2 km from the plot. An unknown village gets no location at
   all.
2. The system assumes Mumbai. The locator only accepts points inside a hard-coded Mumbai-region
   box, and the official-agency list is mostly Mumbai agencies. A Pune parcel silently gets
   no planned projects. (The OpenStreetMap layer for schools, stations and hazards already works
   anywhere.)
3. New information waits. An area is only searched when someone opens Compare, and what's found
   waits for a person to review it on a laptop.

**Why don't we know where the parcel is?**
Because we ask for an address, and land in India doesn't have one. Land is identified by a
survey number inside a village, not a street and building number. Geocoders are built for
addresses, so turning free text into a coordinate is the wrong tool for land. We will always
be guessing.

**So what is the root?**
The only party who reliably knows where the land is, is the person adding it: the owner or
broker, often standing on it. Everything downstream (every distance, every "nearby") inherits
the error of that first step. **The root fix is to capture the location at the source, from the
person who knows, instead of inferring it.**

The other two causes have their own roots:
- Mumbai-only: geography was written into code instead of kept as data.
- Waiting: we (rightly) require a person to review, but make that person review everything,
  on a laptop, in whatever order. The root is where human attention is spent, not the review
  itself.

## 3. Principles we'll hold to

1. **Capture truth at the source.** Ask the person who knows (a pin, GPS on site, a Maps link)
   rather than guessing from text.
2. **Degrade honestly.** Best available wins: pin, then village centre, then text geocode. Keep
   how precise each location is, and never present a guess as exact ("About 2 km").
3. **A wrong answer is worse than a missing one.** Already our rule for map points. A distance
   from a wrong location misleads a money decision; a gap only prompts a question.
4. **Geography is data, not code.** Adding a city means adding rows (bounds, agencies,
   sources), not editing the locator.
5. **Spend human attention where it changes the answer.** Review only what is uncertain,
   first where real parcels are waiting, and make reviewing possible from a phone.
6. **Every fact traceable to a source.** Unchanged: official pages with quotes, or
   OpenStreetMap with attribution.

## 4. What we'll build (in order of how much it fixes)

| # | Layer | What it is | Principle |
|---|---|---|---|
| 1 | **Pin the parcel** | Parcels get latitude, longitude and how the location was obtained (`pin`, `gps`, `maps_link`, `village`, `text`). When adding or editing a parcel, a free OpenStreetMap map opens with a pin at our best guess; the user drags it onto the plot, taps "I'm at the land", or pastes a Google Maps link. Nearby infrastructure uses the pin first. | 1, 2 |
| 2 | **Village centres** | Give each of the 44,918 villages in our government master list a centre point, matched by name within its taluka against OpenStreetMap, with a confidence level; unsure matches are flagged, not used. | 2, 3 |
| 3 | **Regions as data** | A regions table (boundary, official agencies, sources). The locator and area search use the region the parcel is in. Mumbai first, then Pune. | 4 |
| 4 | **Found to shown, faster** | Search a parcel's area as soon as the parcel is created; search areas with parcels first; auto-publish a narrow safe class (rule to be decided by the owner); an in-app review queue; tell the owner when new projects appear near their land. | 5 |

**Not doing now:** survey-number boundaries from 7/12 or Bhunaksha maps (a pin is enough for
distances; boundaries matter later for area and FSI); road-distance routing (straight-line is
stated as such).

## 5. How we'll know it worked

- **Share of parcels with a precise location** (pin, GPS or Maps link). Target: most new
  parcels.
- **Location error:** distance between the text guess and the pin on parcels that have both.
  This tells us how wrong we were before.
- **Coverage:** share of parcels whose area has been searched for planned projects.
- **Time to answer:** from parcel created to first approved planned project nearby.
- **Review queue age:** how long found projects wait.

## 6. Layer 1 in detail (the part being built first)

- **Data:** `land_parcels` gains `latitude`, `longitude`, `location_source`
  (`pin | gps | maps_link | village | text`) and `location_set_at`. Existing parcels keep their
  text and get a pin when next edited.
- **Map:** a Leaflet map inside a WebView (`react-native-webview`, one native dependency and an
  app rebuild), with OpenStreetMap tiles and the required "© OpenStreetMap contributors"
  credit.
  - OpenStreetMap's public tile servers are fine for development and light use. Their usage
    policy forbids heavy app traffic, so the tile URL is a setting, to be switched to a tile
    provider or our own tiles before launch.
- **Starting point of the pin:** our best guess from the typed location (the existing
  geocoder), else the chosen village, else the centre of Maharashtra.
- **"I'm at the land":** the phone's GPS, with the location permission asked only when tapped.
- **Paste a Google Maps link:** the coordinates are read from the link. Short `maps.app.goo.gl`
  links are expanded by our backend, which follows the redirect.
- **Use:** planned and nearby infrastructure use the parcel's coordinates when present. The
  geocoder stays as the fallback for parcels without a pin.
