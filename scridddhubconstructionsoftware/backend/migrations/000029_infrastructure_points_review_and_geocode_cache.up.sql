-- Distance-based "what's planned near this property" (extends 000028).

-- Review gate for the shared list: AI-drafted projects arrive as 'pending' and are never shown on
-- a parcel until a person approves them (AI drafts, human signs). Existing hand-verified rows are
-- approved.
ALTER TABLE infrastructure_projects
    ADD COLUMN review_status TEXT NOT NULL DEFAULT 'approved'
        CHECK (review_status IN ('pending', 'approved', 'rejected'));

-- Where a project physically is: stations (and, later, route vertices). coord_source records how
-- trustworthy the position is, so the app never presents an approximate point as an exact one.
CREATE TABLE infrastructure_project_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES infrastructure_projects(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('station', 'route')),
    latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    -- official_file: from the agency's own published geodata (e.g. MMRDA KML)
    -- approximate:   placed from a name/area, not surveyed — shown as approximate
    -- manual:        entered by a person from a map
    coord_source TEXT NOT NULL CHECK (coord_source IN ('official_file', 'approximate', 'manual')),
    UNIQUE (project_id, label)
);

CREATE INDEX idx_infrastructure_project_points_project ON infrastructure_project_points (project_id);

-- Cache of free-text location -> coordinates lookups. Deliberately keyed by the normalized text,
-- not by parcel: land_parcels is an audited business entity (ADR-0002) and a derived lookup must
-- not mutate it. Also required by the public geocoder's usage policy (no repeated identical
-- requests). `found = false` rows cache misses too.
CREATE TABLE geocode_cache (
    query TEXT PRIMARY KEY,
    found BOOLEAN NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    display_name TEXT,
    -- The text that actually matched, when the full query didn't and a shorter part of it did
    -- (e.g. "Godrej Hill, Khadakpada" -> "Khadakpada, Maharashtra").
    matched_query TEXT,
    provider TEXT NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
