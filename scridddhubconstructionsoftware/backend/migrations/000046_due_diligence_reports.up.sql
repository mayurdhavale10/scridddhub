-- The Parcel Due-Diligence Report (screen 6.2), the product builders pay for (council review,
-- 2026-10-02). One row per order. Sections A, B, C, F and G are composed live from data that
-- already exists (parcel, legal check, valuation, infrastructure); this table holds only what the
-- report adds: land status (D), zoning/FSI (E), the verdict (H) and the sign-off. When a report is
-- signed (Full) or issued (Quick), the whole composed report is frozen in frozen_report so it never
-- changes afterwards, even if the parcel's data does.
CREATE TABLE due_diligence_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    land_parcel_id UUID NOT NULL REFERENCES land_parcels (id),
    tier TEXT NOT NULL CHECK (tier IN ('quick', 'full')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'signed', 'issued')),

    -- D. Land status
    occupancy_class TEXT NOT NULL DEFAULT 'unknown' CHECK (occupancy_class IN ('unknown', 'class_1', 'class_2')),
    na_status TEXT NOT NULL DEFAULT 'unknown' CHECK (na_status IN ('unknown', 'na_granted', 'in_process', 'not_na', 'not_needed')),
    tenancy_remarks TEXT,
    crz_forest_esz TEXT,
    dp_zone TEXT,
    dp_reservation TEXT,

    -- E. Development potential (infrastructure itself comes from Planned Infrastructure)
    base_fsi NUMERIC(4, 2),
    max_fsi NUMERIC(4, 2),
    development_note TEXT,

    -- H. Verdict
    verdict TEXT CHECK (verdict IN ('go', 'fix_first', 'no_go')),
    verdict_summary TEXT,
    fix_list JSONB NOT NULL DEFAULT '[]',
    verdict_source TEXT CHECK (verdict_source IN ('ai_draft', 'edited', 'person')),
    verdict_model TEXT,

    -- Sign-off (Full report only)
    advocate_name TEXT,
    advocate_enrolment TEXT,
    finalised_at TIMESTAMPTZ,
    frozen_report JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX due_diligence_reports_parcel_idx ON due_diligence_reports (land_parcel_id, created_at DESC);
