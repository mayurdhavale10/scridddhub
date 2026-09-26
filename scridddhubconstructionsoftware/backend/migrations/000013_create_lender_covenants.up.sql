-- Screen 8.13, extends 8.3 (Construction Finance detail) — project-scoped, same as LandTenure/
-- FinancialStructure/EscrowAccount. Breach flags and days-until-due are derived at read time,
-- never stored (same reasoning as every other computed value in this codebase).
CREATE TABLE lender_covenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL UNIQUE REFERENCES projects (id),

    dscr NUMERIC(5, 2) NOT NULL,
    dscr_covenant_min NUMERIC(5, 2) NOT NULL,
    security_cover_ratio NUMERIC(5, 2) NOT NULL,
    security_cover_covenant_min NUMERIC(5, 2) NOT NULL,
    next_tpa_report_due_at TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
