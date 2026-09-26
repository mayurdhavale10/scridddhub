-- Land Tenure & JDA Structure (Screen 8.9) governs FinancialStructure (Screen 8) per
-- docs/domain-model.md. Scoped to Project, not LandParcel — Screen 8's own subtitle is
-- "Sunrise Residency — Sources & Uses", a project name, not a parcel; Screens 4-7 were the last
-- parcel-scoped ones. Confirmed by reading both screens' real content before writing this.
CREATE TABLE land_tenures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL UNIQUE REFERENCES projects (id),
    tenure_type TEXT NOT NULL CHECK (tenure_type IN ('outright', 'jda')),

    -- JDA-only fields below; NULL when tenure_type = 'outright'.
    jda_model TEXT,
    developer_area_share_pct NUMERIC(5, 2),
    cash_on_top_of_share BOOLEAN,
    refundable_security_deposit_rupees BIGINT,
    jda_stamp_duty_rupees BIGINT,
    gst_reverse_charge_applicable BOOLEAN,
    landowner_is_co_promoter BOOLEAN,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
