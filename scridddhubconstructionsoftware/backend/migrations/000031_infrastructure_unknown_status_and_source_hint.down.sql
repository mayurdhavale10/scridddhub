ALTER TABLE infrastructure_sources DROP COLUMN IF EXISTS project_hint;
UPDATE infrastructure_projects SET status = 'planned' WHERE status = 'unknown';
ALTER TABLE infrastructure_projects DROP CONSTRAINT infrastructure_projects_status_check;
ALTER TABLE infrastructure_projects ADD CONSTRAINT infrastructure_projects_status_check
    CHECK (status IN ('planned', 'under_construction', 'partially_operational', 'operational'));
