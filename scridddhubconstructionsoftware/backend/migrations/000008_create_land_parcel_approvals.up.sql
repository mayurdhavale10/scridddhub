CREATE TABLE land_parcel_site_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    land_parcel_id UUID NOT NULL UNIQUE REFERENCES land_parcels (id),
    state TEXT NOT NULL,
    free_text TEXT NOT NULL,
    near_airport BOOLEAN NOT NULL DEFAULT false,
    coastal_site BOOLEAN NOT NULL DEFAULT false,
    significant_tree_cover BOOLEAN NOT NULL DEFAULT false,
    uses_groundwater BOOLEAN NOT NULL DEFAULT false,
    unit_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE land_parcel_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    land_parcel_id UUID NOT NULL REFERENCES land_parcels (id),
    approval_playbook_id UUID NOT NULL REFERENCES approval_playbooks (id),
    status TEXT NOT NULL CHECK (status IN ('not_applicable', 'not_started', 'submitted', 'approved', 'not_yet_due')),
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (land_parcel_id, approval_playbook_id)
);

CREATE INDEX idx_land_parcel_approvals_land_parcel_id ON land_parcel_approvals (land_parcel_id);
