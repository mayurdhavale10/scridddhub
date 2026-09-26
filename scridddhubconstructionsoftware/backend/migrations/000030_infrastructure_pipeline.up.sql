-- Planned-infrastructure data pipeline (services/plannedinfrastructure/PIPELINE_PLAN.md §4).
-- All pipeline state lives in the database so a deployed app can build and refresh the list with
-- no code changes. Reference/pipeline data: not wrapped in the ADR-0002 audit trail.

-- Registry of official pages the pipeline reads. Seeded by backend/seeds/infrastructure_sources.sql
-- and extended by the pipeline itself when an index page links to new project pages.
CREATE TABLE infrastructure_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL CHECK (kind IN ('project_index', 'project_page', 'geodata', 'document')),
    enabled BOOLEAN NOT NULL DEFAULT true,
    robots_status TEXT NOT NULL DEFAULT 'unknown' CHECK (robots_status IN ('allowed', 'disallowed', 'unknown')),
    -- Which source this one was discovered from (NULL for hand-seeded rows).
    discovered_from UUID REFERENCES infrastructure_sources(id) ON DELETE SET NULL,
    last_fetched_at TIMESTAMPTZ,
    last_status TEXT CHECK (last_status IN ('ok', 'unchanged', 'blocked', 'error')),
    last_content_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per pipeline execution, with counts so every run is reviewable.
CREATE TABLE infrastructure_pipeline_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trigger TEXT NOT NULL CHECK (trigger IN ('cli', 'on_demand', 'schedule')),
    params JSONB NOT NULL DEFAULT '{}',
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ,
    stats JSONB NOT NULL DEFAULT '{}',
    error TEXT
);

-- Every fetch is kept (normalized text + hash): extraction can be re-run and every published fact
-- can be traced back to the exact page text its evidence quote was checked against.
CREATE TABLE infrastructure_fetches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES infrastructure_sources(id) ON DELETE CASCADE,
    run_id UUID REFERENCES infrastructure_pipeline_runs(id) ON DELETE SET NULL,
    final_url TEXT NOT NULL,
    http_status INT,
    status TEXT NOT NULL CHECK (status IN ('ok', 'blocked', 'error')),
    detail TEXT,
    content_type TEXT,
    content_hash TEXT,
    content_text TEXT,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_infrastructure_fetches_source ON infrastructure_fetches (source_id, fetched_at DESC);

-- Which sources support which project, with the verified evidence quote per field.
CREATE TABLE infrastructure_project_sources (
    project_id UUID NOT NULL REFERENCES infrastructure_projects(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES infrastructure_sources(id) ON DELETE CASCADE,
    fetch_id UUID REFERENCES infrastructure_fetches(id) ON DELETE SET NULL,
    verified_fields JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, source_id)
);

-- Projects: which agency, a stable key for dedupe/upsert, and fields a human has edited that the
-- pipeline must never overwrite.
ALTER TABLE infrastructure_projects
    ADD COLUMN agency TEXT,
    ADD COLUMN canonical_key TEXT UNIQUE,
    ADD COLUMN locked_fields TEXT[] NOT NULL DEFAULT '{}';
