-- 1. A page may not state a project's status. Rather than force the pipeline to invent one,
--    allow 'unknown' (shown as "Status not stated").
ALTER TABLE infrastructure_projects DROP CONSTRAINT infrastructure_projects_status_check;
ALTER TABLE infrastructure_projects ADD CONSTRAINT infrastructure_projects_status_check
    CHECK (status IN ('planned', 'under_construction', 'partially_operational', 'operational', 'unknown'));

-- 2. A geodata file (KML/GeoJSON) carries coordinates but no project name the pipeline can verify,
--    so its registry row names the project it belongs to. Resolved with infrapipeline.CanonicalKey.
ALTER TABLE infrastructure_sources ADD COLUMN project_hint TEXT;
