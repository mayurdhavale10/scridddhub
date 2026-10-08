-- Public MahaRERA records, collected by cmd/rera_import, used to fill a seller's RERA track
-- record on the Legal & RERA Check screen. Reference data copied from a public source, so no
-- audit rows; fetched_at says how fresh each row is.
CREATE TABLE rera_projects (
    registration_number TEXT PRIMARY KEY,
    project_name TEXT NOT NULL,
    promoter_name TEXT NOT NULL,
    promoter_name_norm TEXT NOT NULL,
    location TEXT,
    pincode TEXT,
    district TEXT,
    last_modified DATE,
    has_extension BOOLEAN NOT NULL DEFAULT false,
    details_url TEXT,
    fetched_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX rera_projects_promoter_norm_idx ON rera_projects (promoter_name_norm);
CREATE INDEX rera_projects_promoter_norm_trgm_idx ON rera_projects USING gin (promoter_name_norm gin_trgm_ops);

-- MahaRERA's "Promoter Wise Complaint List". A promoter missing here has no complaints on record.
CREATE TABLE rera_promoter_complaints (
    promoter_name TEXT NOT NULL,
    promoter_name_norm TEXT NOT NULL,
    complaints INTEGER NOT NULL,
    view_url TEXT NOT NULL PRIMARY KEY,
    fetched_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX rera_promoter_complaints_norm_idx ON rera_promoter_complaints (promoter_name_norm);
