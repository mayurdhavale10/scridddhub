-- TPAReport (Screen 8.16) — the actual per-lender submission document, not just the countdown
-- LenderCovenant (8.13) already tracks. Assembled from figures certified elsewhere on the
-- platform (architect certificate physical progress, engineer draft cost incurred, lender
-- covenant DSCR/security cover) — never a new number invented for the bank.
--
-- Honest limit (from the wireframe itself): lender report templates vary and change; this does
-- not guess a bank's format, it fills one configured in advance at lender onboarding. That
-- configuration (lender_name + template_version) is entered here alongside the assembled report,
-- not derived from anything else in the system yet — there is no separate LenderTemplate registry
-- in this build.
--
-- units_sold/units_total (sales velocity) have no backing entity in this build yet (no
-- booking/sales-ledger screen has been implemented) so they are entered directly per report, same
-- as CertificationPacket's engineer/CA draft figures before Master Schedule/Buyer Collections
-- detail existed.
CREATE TABLE tpa_reports (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id              UUID NOT NULL REFERENCES projects(id),
    lender_name             TEXT NOT NULL,
    template_version        TEXT NOT NULL,
    period_year             SMALLINT NOT NULL,
    period_quarter          SMALLINT NOT NULL CHECK (period_quarter BETWEEN 1 AND 4),

    physical_progress_pct   NUMERIC(5,2) NOT NULL,
    cost_incurred_rupees    BIGINT NOT NULL,
    dscr                    NUMERIC(6,2) NOT NULL,
    security_cover_ratio    NUMERIC(6,2) NOT NULL,
    units_sold              INTEGER NOT NULL,
    units_total             INTEGER NOT NULL CHECK (units_total > 0),

    status                  TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
    submitted_at             TIMESTAMPTZ,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (project_id, lender_name, period_year, period_quarter)
);
