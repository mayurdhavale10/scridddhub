# ScridddHub Construction Software

Construction/real-estate ERP for mid-size Indian developers. This repo is the real product
implementation — the low/high-fidelity wireframes live in a separate design artifact, not here.

## Layout

- `mobile-app/` — React Native (bare community CLI, not Expo — see `docs/adr/0003`). Primary
  client, built first.
- `web-app/` — added once the mobile app and backend are proven; shares `packages/api-client`.
- `backend/` — Go backend. Single API serving both mobile and web. See `backend/README.md`.
- `ml/` — added only when a real trained-model feature (e.g. cost benchmarking, Level 1 Screen
  8.8) actually needs it. Not scaffolded speculatively.
- `packages/api-client/` — TypeScript client generated from `backend/api/openapi.yaml`. Both
  frontends import from here — never hand-write API calls against the backend directly.
- `docs/adr/` — Architecture Decision Records, one per significant decision.
- `docs/domain-model.md` — the living entity model, starting with Level 1 (Planning).

## Principles carried over from the product design

- **AI drafts, a licensed/liable human decides and signs.** Nothing in this system auto-submits
  or auto-commits on a legal or financial matter.
- **Audit trail cannot be disabled.** See `docs/adr/0002-audit-trail-enforced-at-middleware-layer.md`.
- **Color/status conventions, RERA/GST/TDS logic, and screen-level detail** are specified in the
  wireframe artifact — treat it as the product spec when implementing a screen's backing feature.

## Getting started

Postgres + migrations (see `backend/README.md` for the full sequence, including seeding a
project):
```
docker compose up -d postgres
docker compose run --rm migrate up
```

Backend:
```
cd backend
go run ./cmd/server
```

API client (regenerate after any `backend/api/openapi.yaml` change):
```
cd packages/api-client
npm run generate
```

Mobile app:
```
cd mobile-app
npm run android   # or: npm run ios
npm run web       # dev server via react-native-web
```
