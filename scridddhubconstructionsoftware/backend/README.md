# backend

Go backend for ScridddHub. Single API, shared by `mobile-app` and (later) `web-app`.

## Structure

```
cmd/server/       entry point
internal/domain/       entities — no framework or DB imports here
internal/usecase/      business logic, depends only on domain + repository interfaces
internal/repository/   Postgres implementations of domain repository interfaces
internal/handler/      HTTP layer — translates requests to usecase calls
internal/middleware/   auth, audit-log enforcement (see docs/adr/0002)
migrations/            SQL migrations, versioned
api/openapi.yaml        source of truth for the generated TS client in packages/api-client
```

Dependencies point inward: `domain` knows nothing about `repository` or `handler`; those depend
on `domain`, not the other way around.

## Run

Start Postgres and apply migrations (from the repo root):

```
docker compose up -d postgres
docker compose run --rm migrate up
```

Then run the server:

```
cd backend
cp .env.example .env   # adjust if your Postgres isn't on localhost:5434 (see docker-compose.yml
                        # comment — this machine had other native Postgres services already on
                        # 5432 and 5433, hence the less obvious port)
go run ./cmd/server
```

## Seeding a project (until a project-picker screen exists)

The Land Parcels screen needs a real `project_id`. Create one and copy its `id` from the
response into `mobile-app/src/screens/LandParcelsScreen.tsx`'s `DEV_PROJECT_ID`:

```
curl -X POST localhost:8080/projects \
  -H 'Content-Type: application/json' \
  -d '{"org_id": "11111111-1111-1111-1111-111111111111", "name": "Wagholi Phase 1", "city": "Pune"}'

curl -X POST localhost:8080/land-parcels \
  -H 'Content-Type: application/json' \
  -d '{"project_id": "<id from above>", "name": "Parcel A - Wagholi Rd", "location": "Wagholi Rd", "area_acres": 2.1, "cost_rupees": 32000000, "fsi": 1.5, "notes": "Metro station planned nearby"}'
```

## Status

Level 1 / Screen 4 (Land Parcels) vertical slice: `projects` + `land_parcels` tables, audit-log
enforced at the repository layer (ADR-0002), `POST/GET /projects`, `GET
/projects/{id}/land-parcels`, `POST /land-parcels`, `GET /land-parcels/{id}`, `PATCH
/land-parcels/{id}/stage`. Documented in `api/openapi.yaml`; consumed by
`mobile-app/src/screens/LandParcelsScreen.tsx` via `packages/api-client`.

Not implemented yet: real auth (one hardcoded dev actor for now, see
`internal/middleware/auth.go`), FeasibilityAssessment and every other Level 1 entity in
`docs/domain-model.md`, DB and endpoint runtime not yet verified end-to-end (this machine had no
Docker/Postgres installed when this slice was built — see project memory).
