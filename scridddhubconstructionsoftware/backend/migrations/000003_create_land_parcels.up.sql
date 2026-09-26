CREATE TABLE land_parcels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects (id),
    name TEXT NOT NULL,
    location TEXT,
    area_acres NUMERIC(8, 2) NOT NULL,
    cost_rupees BIGINT NOT NULL,
    fsi NUMERIC(4, 2),
    stage TEXT NOT NULL DEFAULT 'sourced' CHECK (stage IN ('sourced', 'screened', 'dd')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_land_parcels_project_id ON land_parcels (project_id);
