-- How the land in one deal is acquired (Screen 8.9), per parcel: a JDA is signed with that land's
-- owner, so each parcel has its own terms (owner decision, 2026-10-03). The older project-level
-- land_tenures table (migration 009) is left as it is; project finance screens will read the
-- terms of their parcels from here.
CREATE TABLE land_parcel_tenures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    land_parcel_id UUID NOT NULL UNIQUE REFERENCES land_parcels (id),
    tenure_type TEXT NOT NULL CHECK (tenure_type IN ('outright', 'jda')),

    -- Outright purchase.
    purchase_price_rupees BIGINT,
    purchase_stamp_duty_rupees BIGINT,

    -- JDA.
    jda_model TEXT CHECK (jda_model IN ('area_sharing', 'revenue_sharing', 'deposit_plus_share')),
    developer_area_share_pct NUMERIC(5, 2),
    landowner_revenue_share_pct NUMERIC(5, 2),
    cash_on_top_of_share BOOLEAN,
    security_deposit_rupees BIGINT,
    deposit_refundable BOOLEAN,
    jda_stamp_duty_rupees BIGINT,
    gst_reverse_charge_applicable BOOLEAN,
    landowner_is_co_promoter BOOLEAN,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
