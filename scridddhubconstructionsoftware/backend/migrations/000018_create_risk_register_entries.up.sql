-- RiskRegisterEntry (Screen 9) — "5 categories, not a single score, matches how lenders
-- actually track construction risk, not a generic checklist." One row per project per fixed
-- category, reviewed at each gate (no separate gate-history table — this build tracks current
-- state only, the same "current state, not a timeline" scope every other project-summary entity
-- this session has kept to).
--
-- status drives badge color programmatically; headline is the exact pill text (e.g. "Clear ·
-- 4/4", "1 flagged", "On track") and detail is the explanation paragraph — both free text,
-- entered by whoever reviews the register. Several categories (e.g. Market's "2 competing
-- projects launching nearby") have no backing entity in this build to derive them from, so
-- entering them directly here is the honest choice, not a shortcut.
CREATE TABLE risk_register_entries (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID NOT NULL REFERENCES projects(id),
    category    TEXT NOT NULL CHECK (category IN (
        'legal_title', 'regulatory', 'financial', 'contractor_execution', 'market'
    )),
    status      TEXT NOT NULL CHECK (status IN ('clear', 'flagged', 'on_track')),
    headline    TEXT NOT NULL,
    detail      TEXT NOT NULL,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (project_id, category)
);
