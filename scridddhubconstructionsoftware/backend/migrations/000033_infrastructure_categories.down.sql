DROP INDEX IF EXISTS idx_infrastructure_projects_category;
UPDATE infrastructure_projects SET kind = 'other'
WHERE kind NOT IN ('metro', 'suburban_rail', 'highway', 'road', 'airport', 'other');
ALTER TABLE infrastructure_projects DROP CONSTRAINT infrastructure_projects_kind_check;
ALTER TABLE infrastructure_projects ADD CONSTRAINT infrastructure_projects_kind_check
    CHECK (kind IN ('metro', 'suburban_rail', 'highway', 'road', 'airport', 'other'));
ALTER TABLE infrastructure_projects DROP COLUMN IF EXISTS category;
