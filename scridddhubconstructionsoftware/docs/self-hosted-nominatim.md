# Self-hosted Nominatim (geocoder for the infrastructure pipeline)

The planned-infrastructure pipeline geocodes station names in bulk (hundreds to thousands per run).
The public `nominatim.openstreetmap.org` service allows ≤1 request/second and **forbids bulk
geocoding**, so the pipeline caps itself at 40 public lookups per run unless it's pointed at our
own Nominatim. This doc sets that up. See `services/plannedinfrastructure/PIPELINE_PLAN.md`
(decision 8, task T1.4).

Map data © OpenStreetMap contributors (ODbL) — attribution is shown on the Planned Infrastructure
card.

## What it runs

- Image `mediagis/nominatim:5.3` (latest 5.3.x tag on Docker Hub, checked 2026-09-27).
- Data: Geofabrik's **western-zone India** extract (Maharashtra, Gujarat, Goa…), ≈220 MB as of
  25 Sep 2026: `https://download.geofabrik.de/asia/india/western-zone-latest.osm.pbf`.
- `IMPORT_STYLE=address` — enough for place and address lookups, much smaller than `full`.
- Host port **8088** (container 8080). The service has a compose profile `geo`, so a plain
  `docker compose up` never starts it.

## First-time start (one-off import)

```bash
docker compose --profile geo up -d nominatim
docker compose logs -f nominatim        # watch the import
```

The first start downloads the extract and builds the database. Expect this to take a while on a
laptop (tens of minutes to a few hours depending on CPU/disk) and several GB of disk in the
`nominatim_data` volume. It only happens once; later starts reuse the volume.

## Check it's ready

```bash
curl "http://localhost:8088/status"                                   # "OK" when ready
curl "http://localhost:8088/search?q=Asalpha,+Mumbai&format=jsonv2&limit=1"
```

## Point the pipeline at it

Add to `backend/.env`:

```
NOMINATIM_URL=http://localhost:8088
```

`cmd/infra_pipeline` then uses it with no per-run budget and no 1 req/s wait
(`geo.NewNominatimGeocoderWithBaseURL`). Without `NOMINATIM_URL` it falls back to the public
service with the 40-lookup cap.

The app server (`cmd/server`) still uses the public service for one-off parcel lookups (cached);
switching it too is a one-line change in `cmd/server/main.go` if wanted.

## Keeping it current

`REPLICATION_URL` is set to Geofabrik's daily diffs for the same extract. Updates are optional —
place names change slowly. To force a full re-import, remove the volume:
`docker compose --profile geo down -v` (this deletes only the Nominatim data).

## Stopping

```bash
docker compose --profile geo stop nominatim
```
