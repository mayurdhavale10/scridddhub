ALTER TABLE infrastructure_projects
    DROP COLUMN IF EXISTS locked_fields,
    DROP COLUMN IF EXISTS canonical_key,
    DROP COLUMN IF EXISTS agency;
DROP TABLE IF EXISTS infrastructure_project_sources;
DROP TABLE IF EXISTS infrastructure_fetches;
DROP TABLE IF EXISTS infrastructure_pipeline_runs;
DROP TABLE IF EXISTS infrastructure_sources;
