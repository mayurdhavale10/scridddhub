# Planned Infrastructure pipeline — Codex tasks

The plan, architecture, rules and ready-to-paste prompts live in
[services/plannedinfrastructure/PIPELINE_PLAN.md](../services/plannedinfrastructure/PIPELINE_PLAN.md).
Read it fully before starting a task. Work on one task at a time.

| Task | Owner | Depends on | Status |
|---|---|---|---|
| T1.1 Migration 000030 + stage interfaces (`backend/internal/infrapipeline/pipeline.go`) | Claude | — | done 2026-09-26 |
| T2.1 Groq extractor (`backend/internal/llm/groq_infra_extractor.go`) | Claude | T1.1 | done 2026-09-26 |
| T2.2 Evidence verifier + publish policy (`infrapipeline/verify`, `infrapipeline/policy.go`) | Claude | T1.1 | done 2026-09-26 |
| T4.1 Postgres store + orchestrator + `cmd/infra_pipeline` (migration 000031) | Claude | T1.2, T1.3 | done 2026-09-27; MMRDA dry runs in progress |
| T1.2 Fetcher (`backend/internal/infrapipeline/fetch`) | Claude (Codex unavailable) | T1.1 | done 2026-09-27 |
| T1.3 Geodata parser (`backend/internal/infrapipeline/geodata`) | Claude (Codex unavailable) | T1.1 | done 2026-09-27 |
| T1.4 Self-hosted Nominatim (`docker-compose.yml` profile `geo`, `docs/self-hosted-nominatim.md`) | Claude (Codex unavailable) | — | done 2026-09-27 (import not yet run) |
| T3.1 Source registry (`backend/seeds/infrastructure_sources.sql`) | Claude | T1.1 | MMRDA done (16 pages + ML5 KML); other agencies open |
| Locator (`infrapipeline/locate`) | Claude | — | done 2026-09-27 |

The interfaces and types you implement are in `backend/internal/infrapipeline/pipeline.go`;
their doc comments are the contract. Don't change that file — if a contract needs to change,
say so in your report and Claude will update it.

Rules that apply to every task (plan §2, decision 7): official public pages only, obey
robots.txt, identify the app in the User-Agent, rate-limit per domain, and record blocks instead
of working around them. Stay inside the files each task names. Update the Status column when done.
