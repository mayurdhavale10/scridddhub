CREATE TABLE feasibility_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    land_parcel_id UUID NOT NULL UNIQUE REFERENCES land_parcels (id),
    current_valuation_rupees BIGINT NOT NULL,
    future_valuation_rupees BIGINT NOT NULL,
    future_valuation_year SMALLINT NOT NULL,
    verdict TEXT NOT NULL,
    compared_parcel_id UUID REFERENCES land_parcels (id),
    margin_pct NUMERIC(5, 2),
    infrastructure_note TEXT,
    comparable_sales_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One assessment per parcel for now (Screen 5 shows a single current assessment, not a history).
CREATE INDEX idx_feasibility_assessments_compared_parcel_id
    ON feasibility_assessments (compared_parcel_id);
