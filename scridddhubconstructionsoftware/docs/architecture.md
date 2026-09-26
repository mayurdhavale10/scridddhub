# System Architecture

This diagram is source of truth for the shape of the system — update it when a real container
(app, service, database) is added or removed, not when implementation details change inside one.

## Container diagram

```mermaid
flowchart TD
    Mobile["mobile-app<br/>React Native"]
    Web["web-app<br/>same App.tsx, via react-native-web"]
    API["backend<br/>Go — cmd/server"]
    DB[("Postgres")]
    Audit[("audit_log<br/>append-only, INSERT-only DB role")]
    Groq(["Groq API<br/>external — openai/gpt-oss-20b"])

    Mobile -->|REST, typed client from packages/api-client| API
    Web -->|REST, same typed client| API
    API -->|reads/writes via repository layer| DB
    API -->|every write also inserts here, same transaction<br/>ADR-0002| Audit
    API -->|internal/llm, behind usecase.SiteTextExtractor<br/>Screen 7 free-text extraction only| Groq
```

The cylinder shape is the standard convention for "this is a data store," not a stylistic choice
— any engineer reading this diagram for the first time knows `DB` and `Audit` are databases
without needing a legend. The stadium shape on `Groq` marks it as an external service call, not
something this repo owns or can guarantee the uptime of — if a second external AI provider or any
other third-party API is ever added, use the same shape so "things we don't control" stay visually
distinct from our own containers at a glance.

Notice `mobile-app` and `web-app` both point at the *same* backend through the *same* generated
client (ADR-0003) — if this diagram ever shows two different boxes for "mobile API" and "web
API," that's a sign the architecture drifted from the decision and needs a new ADR explaining
why, not a silent change.

## Sequence diagrams — the real, verified Land Parcels flow

These replace an earlier version of this file that diagrammed a hypothetical future feature
(engineer draft sign-off) that didn't exist in the code. Per "keeping this file honest" below,
that was already wrong the day it was written — these two diagrams instead trace the actual
`internal/handler/land_parcel.go` → `internal/usecase/land_parcel.go` →
`internal/repository/postgres/land_parcel.go` call chain, verified against a real Postgres on
2026-09-15 (see the "Status" section at the bottom).

**Create — the insert path.** No prior row exists, so `old_data` is `NULL`.

```mermaid
sequenceDiagram
    actor User
    participant Mobile as mobile-app / web-app
    participant API as LandParcelHandler.Create
    participant UC as LandParcelUsecase.Create
    participant Repo as LandParcelRepository.Create
    participant DB as Postgres: land_parcels
    participant Audit as Postgres: audit_log

    User->>Mobile: tap "+" on Screen 4
    Mobile->>API: POST /land-parcels
    API->>UC: Create(actor, parcel)
    UC->>UC: default stage="sourced", Validate()
    UC->>Repo: Create(actor, parcel)
    Repo->>DB: BEGIN
    Repo->>DB: INSERT INTO land_parcels (...) RETURNING id, created_at, updated_at
    Repo->>Audit: INSERT INTO audit_log (table_name='land_parcels', action='insert',<br/>actor, old_data=NULL, new_data=<row as JSON>)
    Repo->>DB: COMMIT
    DB-->>Repo: ok
    Repo-->>UC: parcel (with id, timestamps)
    UC-->>API: parcel
    API-->>Mobile: 201 Created
```

**Stage update — the update path.** The repository reads the current row under `FOR UPDATE`
*inside* the same transaction as the write, so the `before` snapshot in `audit_log.old_data` is
guaranteed consistent with what's actually being replaced — not a separate, potentially stale read.

```mermaid
sequenceDiagram
    actor User
    participant Mobile as mobile-app / web-app
    participant API as LandParcelHandler.UpdateStage
    participant UC as LandParcelUsecase.UpdateStage
    participant Repo as LandParcelRepository.UpdateStage
    participant DB as Postgres: land_parcels
    participant Audit as Postgres: audit_log

    User->>Mobile: tap a stage chip (Sourced → Screened)
    Mobile->>API: PATCH /land-parcels/{id}/stage
    API->>UC: UpdateStage(actor, id, stage)
    UC->>UC: stage.Valid()?
    UC->>Repo: UpdateStage(actor, id, stage)
    Repo->>DB: BEGIN
    Repo->>DB: SELECT ... FOR UPDATE (the "before" row)
    Repo->>DB: UPDATE land_parcels SET stage=..., updated_at=now()
    Repo->>Audit: INSERT INTO audit_log (action='update', actor,<br/>old_data=<before>, new_data=<after>)
    Repo->>DB: COMMIT
    DB-->>Repo: ok
    Repo-->>UC: parcel (updated)
    UC-->>API: parcel
    API-->>Mobile: 200 OK
```

Both diagrams show the same structural fact: the `Audit` insert happens inside `Repo`, in the
same transaction as the real write, never inside `API` or `UC` — a new mutable entity gets this
for free the moment its repository follows the same "write + audit, same transaction" shape,
without anyone needing to remember to call a logging function.

**The original version of this file's very first sequence diagram**, before it was replaced for
being hypothetical (see the note above), imagined exactly this: an engineer signing a cost-
incurred draft. As of 2026-09-15 that flow is real —
`CertificationPacketUsecase.SignEngineerDraft` (Screen 8.4.1's "Approve & Sign"), same
write-in-`Repo`-same-transaction shape, verified live with a real signature (`A. Mehta (Engineer)`)
producing a real `audit_log` row. Not re-diagrammed here in full to avoid this file ballooning
into one sequence diagram per entity — the two above already establish the pattern every
subsequent entity follows identically.

## Status — what's actually verified, not just designed

As of 2026-09-15, **eight entities** are built and verified end-to-end against a real Postgres +
real HTTP calls (not just designed): `Project`, `LandParcel`, `FeasibilityAssessment`,
`LegalCheck`, `GovernmentApproval`/`ApprovalPlaybook` (with a real Groq LLM call, see the `Groq`
node above), `LandTenure`, `FinancialStructure`, `EscrowAccount`, `CertificationPacket`. Each
followed the same pattern the two diagrams above establish. Specifics live in
`docs/domain-model.md` and the session's own memory notes, not duplicated here.

- The ADR-0002 guarantee was tested directly at the database role level, not just read in the
  migration SQL: connected *as* `scridddhub_app` and confirmed it can `INSERT` into `audit_log`
  but gets `permission denied` on `UPDATE` and `DELETE` against that same table.
- Two non-negotiable constraints from `docs/domain-model.md` are now enforced in code, verified
  live including their refusal paths: `EscrowAccount`'s bank balance can only be written by a
  separate, non-mobile-app endpoint (`UpdateBankFeed`, audited under a distinct
  `bank-integration` actor); `ArchitectCertificate` cannot be certified without a recorded site
  visit (`CertifyArchitect` returns a real 400 otherwise).
- Not yet done: no screen in the mobile app uses the real Stitch design tokens' font families
  (Plus Jakarta Sans/Inter/Public Sans) yet — colors are real, fonts are still system default. No
  device/emulator visual check has been done for any screen — deliberately deferred until all of
  Level 1 is built (two real Android emulators are available on this machine when that happens).

## Keeping this file honest

- If a new container (a service, a queue, a cache) gets added, it goes in this diagram before
  or alongside the code that introduces it — not as an afterthought.
- If this diagram and the actual code disagree, the diagram is wrong and gets fixed immediately
  — a stale diagram is worse than no diagram, since it actively misleads the next reader.
