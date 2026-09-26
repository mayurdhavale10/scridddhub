// There is no project-picker screen yet (earlier in Level 1, not built) and no real auth/tenant
// scoping — this is seeded manually via the API. See backend/README.md "Seeding a project".
// "Wagholi Phase 1", seeded 2026-09-15 — if the Postgres volume is ever wiped, reseed and update.
export const DEV_PROJECT_ID = '1b8c981b-0cd1-4ebb-803c-2e15f62b92d9';

// The org "Wagholi Phase 1" belongs to — org-scoped entities (LitigationCase, Screen 8.17) key
// off this instead of DEV_PROJECT_ID. Confirmed via `select org_id from projects` against the
// seeded row, not guessed.
export const DEV_ORG_ID = '11111111-1111-1111-1111-111111111111';
