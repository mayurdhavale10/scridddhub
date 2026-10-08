-- Values a reviewer set by hand (infra_review set-status / add-point), each with the official page
-- and the exact quote it rests on. Kept apart from infrastructure_project_sources, which each
-- pipeline run rewrites. A field set here is also added to the project's locked_fields, so later
-- runs don't overwrite it.
-- Why (2026-09-29): MMRDA's Metro Line 7 page says "operational from 19th January, 2023", but the
-- extractor missed it and the line would have shown as "Planned / in progress".
CREATE TABLE infrastructure_review_evidence (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID        NOT NULL REFERENCES infrastructure_projects(id) ON DELETE CASCADE,
    field       TEXT        NOT NULL,   -- 'status' | 'point:<label>'
    value       TEXT        NOT NULL,
    source_url  TEXT        NOT NULL,
    quote       TEXT        NOT NULL,
    reviewer    TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_infrastructure_review_evidence_project ON infrastructure_review_evidence (project_id);
