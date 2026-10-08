-- Which MahaRERA collections have finished completely. A complaint count is shown only after a
-- complete complaint-list run (otherwise "0" or "6" might just mean "not collected yet"), and a
-- project count is called a total only after a complete statewide run.
CREATE TABLE rera_collection_runs (
    kind TEXT PRIMARY KEY CHECK (kind IN ('projects_state', 'complaints')),
    completed_at TIMESTAMPTZ NOT NULL
);
