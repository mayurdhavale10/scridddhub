# Session Handoff Context — paste this into a new Claude Code session

## What ScridddHub is

A construction/real-estate ERP for mid-size Indian developers, covering 6 product levels
(Planning → Execution → Sales/Marketing → Customer Experience → Handover/After-Sales →
Executive Intelligence). Standing rules carried through all of this work: never present
unverified facts as researched (verify via search first); give honest pushback rather than
comply blindly; fix root causes not symptoms; every AI feature follows "AI drafts, a
licensed/liable human decides and signs" — nothing auto-submits or auto-commits on a legal or
financial matter.

## Two separate deliverables exist — don't confuse them

1. **The low/high-fidelity wireframe** — a published Claude Artifact (a design canvas, not code)
   at `https://claude.ai/code/artifact/22b33f7e-06e0-4c02-863f-088e24b8d0c7`. 112+ screens across
   all 6 levels, fully designed with real research (RERA law, GST/TDS rules, JDA structures,
   escrow mechanics, etc.) baked into each screen's content. This artifact is hosted on
   Anthropic's servers — completely independent of any local folder. **Not affected by any of
   the folder moves below.**
2. **This repo** (`scridddhubconstructionsoftware`) — the actual product implementation, started
   fresh in this same session, building toward what the wireframe specifies.

A separate Stitch (Google's AI design tool) project was also used to turn ~15 of those wireframe
screens into polished high-fidelity mockups (Splash, Login, Signup, Trial/Demo/Pay, Payment,
Module Picker, and most of Level 1's screens 4 through 8.17) — project id
`4654444127409167519` at stitch.google.com. Established a strict color-scarcity design system
there (brand green only for logo + one primary CTA; glassy green/blue/orange/red reserved for
genuinely positive/pending/warning/critical states, never decorative) — if resuming Stitch work,
that design system asset (`assets/13437888027671049982`) already encodes the rule.

## Stack decisions made (see ADRs in docs/adr/ for full reasoning)

- **Backend**: Go, clean architecture (`cmd/`, `internal/domain|usecase|repository|handler|middleware`).
  Module path is a placeholder (`github.com/scridddhub/backend`) — update once a real GitHub org exists.
- **Mobile**: React Native, bare (community CLI, NOT Expo) — chosen for full native module access.
- **Web**: NOT a separate codebase. `web-app/` is a thin deploy target that renders the SAME
  `mobile-app/App.tsx` via `react-native-web` + a custom webpack config. One shared component
  tree, mobile-shaped layout first, desktop breakpoints added later to the same components.
- **API contract**: `backend/api/openapi.yaml` is meant to be the source of truth; a TypeScript
  client gets generated from it into `packages/api-client/`, imported by both mobile and web —
  not built yet, this is the plan, not done.
- **Audit trail**: MUST be enforced at the repository/middleware layer (every DB write produces
  an audit_log row in the same transaction), not something each handler remembers to call — this
  maps to a real legal requirement (MCA Companies (Accounts) Rules, Rule 3(1), effective 1 April
  2023) and was a hard requirement in the wireframe (Screen 8.11). See ADR-0002.

## Current repo state — what's actually built and verified (not just scaffolded)

```
scridddhubconstructionsoftware/
├── README.md
├── .gitignore
├── backend/            Go — builds clean (`go build ./...` verified), has /healthz only.
│                       No domain entities, DB, or auth implemented yet.
├── mobile-app/         React Native 0.87.1 + TS, bare CLI scaffold.
│                       npm install clean, tsc --noEmit clean, jest passes (default test).
│                       Has react-native-web + react-dom installed.
├── web-app/            index.web.js + webpack.config.js + index.html.
│                       `npm run web:build` (from mobile-app/) verified compiling successfully —
│                       real proof the shared-codebase plan works, not just documented.
├── packages/
│   └── api-client/     empty — waiting on the OpenAPI spec to generate from.
├── docs/
│   ├── domain-model.md      Level 1 (Planning) entity model, derived from the wireframe screens
│   ├── architecture.md      Mermaid container diagram + a real sequence diagram (audit trail flow)
│   └── adr/
│       ├── 0001-record-architecture-decisions.md
│       ├── 0002-audit-trail-enforced-at-middleware-layer.md
│       └── 0003-bare-react-native-with-shared-web-target.md
```

Nothing implemented yet: Postgres schema/migrations, any domain entities in Go, any real API
endpoint beyond /healthz, any real screen in the RN app beyond the default template, auth.

## Folder layout / important gotchas from this session

- Repo root moved during this session: now lives at
  `C:\Users\dhava\Downloads\scridddhub\scridddhubconstructionsoftware\`
  (parent `scridddhub\` also contains the marketing site as a sibling, see below).
- The marketing site (`ScridddHubHome`, Next.js, separate GitHub repo
  `github.com/ScridddHub/ScridddHubHome`) lives alongside this repo at
  `C:\Users\dhava\Downloads\scridddhub\Scridddhubhome\` — a **separate, independent git repo**,
  not part of this monorepo. Don't nest its `.git` inside this repo's history.
- Two old, unrelated experiments (`scridddhub-backend` — Next.js+MongoDB, and `scridddhubmobile`
  — an older React Native attempt) were found pre-existing at the `scridddhub\` parent level and
  **deliberately deleted** as confirmed-abandoned work. If anything references them, that's
  stale — they're gone on purpose.
- Windows path-length gotcha: `node_modules` for the RN app got corrupted during a folder move
  (PowerShell `Move-Item` chokes on deeply-nested RN native module paths past ~260 chars) — fixed
  by deleting `node_modules` and running `npm install` fresh at the new location, which worked
  fine (npm handles long paths better than `Move-Item`). If moving this repo again, prefer
  `robocopy /E` over `Move-Item`, and always re-verify with a fresh install + typecheck + test
  run afterward rather than assuming the move was byte-perfect.

## Recommended next step (agreed but not yet started)

First real vertical slice, chosen deliberately over "design everything first" or "build all
screens first": **Screen 4, Land Parcels** — the simplest entity, actual entry point of Level 1.
1. Postgres: `projects` + `land_parcels` tables.
2. Go: domain struct → repository (Postgres, audit-trail pattern from ADR-0002) → usecase → handler.
3. Document those 2 endpoints in `backend/api/openapi.yaml`.
4. Generate the TS client into `packages/api-client/`.
5. One real screen in `mobile-app` calling the real backend, verified working on both the mobile
   build and the `web-app` build.

Auth is deliberately stubbed (one hardcoded dev user) until this first slice proves the pattern
— real RBAC (Developer/CA/Engineer/Architect roles) becomes its own vertical slice later.
