DROP TABLE IF EXISTS geocode_cache;
DROP TABLE IF EXISTS infrastructure_project_points;
ALTER TABLE infrastructure_projects DROP COLUMN IF EXISTS review_status;
