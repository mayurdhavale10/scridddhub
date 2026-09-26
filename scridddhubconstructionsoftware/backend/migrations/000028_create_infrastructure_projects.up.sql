-- Reference/master data for Screen 5's "Planned Infrastructure" section. Same category and
-- precedent as ready_reckoner_rates (000024): one shared, manually verified list maintained by
-- whoever operates the app — NOT a per-parcel business entity, so NOT wrapped in the ADR-0002
-- audit trail and not editable through the app. Verify a project once; every parcel in the areas
-- it serves shows it.
--
-- Deliberately no coordinates or distances: neither parcels nor mh_villages carry coordinates
-- yet, so any "within 500m" claim would be invented. Matching is by district/taluka served.
CREATE TABLE infrastructure_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL CHECK (kind IN ('metro', 'suburban_rail', 'highway', 'road', 'airport', 'other')),
    status TEXT NOT NULL CHECK (status IN ('planned', 'under_construction', 'partially_operational', 'operational')),
    -- Free text on purpose: official and press timelines often disagree or give a range
    -- ("Dec 2027 – May 2028"); a single integer year would overstate precision.
    expected_completion TEXT,
    description TEXT NOT NULL DEFAULT '',
    -- The page a person actually checked the facts against, so every claim is checkable.
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    verified_at TIMESTAMPTZ NOT NULL,
    verified_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Which talukas a project serves. `note` says how, in human terms (e.g. which stations fall in
-- this taluka) — descriptive only, not used for matching.
CREATE TABLE infrastructure_project_areas (
    project_id UUID NOT NULL REFERENCES infrastructure_projects(id) ON DELETE CASCADE,
    district TEXT NOT NULL,
    taluka TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (project_id, district, taluka)
);

CREATE INDEX idx_infrastructure_project_areas_taluka ON infrastructure_project_areas (lower(district), lower(taluka));
