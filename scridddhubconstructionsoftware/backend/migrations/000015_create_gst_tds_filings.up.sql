-- Screen 8.14 (GST Filing & Rule 42/43 ITC Reversal) and 8.15 (TDS Return Filing), both
-- project-scoped and period-based. The wireframe doesn't commit to monthly-vs-quarterly GST
-- periodicity (regular-scheme GSTR-1/3B is normally monthly; QRMP-scheme filers go quarterly) —
-- modeled as year+quarter here for consistency with every other period-based entity in this
-- session (CertificationPacket, LenderCovenant's TPA/QPR); a real product decision on GST
-- periodicity is still open, flagged here rather than assumed.
--
-- Both close with the same "AI drafts, licensed professional files" honest limit as the 8.4
-- family: neither table represents an actual GSTN/TRACES filing integration, just the prepared
-- data and status a CA/GST practitioner would file from.
CREATE TABLE gst_filings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    period_year SMALLINT NOT NULL,
    period_quarter SMALLINT NOT NULL CHECK (period_quarter BETWEEN 1 AND 4),

    gstr1_status TEXT NOT NULL DEFAULT 'not_started' CHECK (gstr1_status IN ('not_started', 'draft', 'filed')),
    gstr1_filed_late BOOLEAN,
    gstr3b_status TEXT NOT NULL DEFAULT 'not_started' CHECK (gstr3b_status IN ('not_started', 'draft', 'filed')),
    gstr3b_due_at TIMESTAMPTZ,

    itc_claimed_rupees BIGINT NOT NULL DEFAULT 0,
    exempt_turnover_ratio_pct NUMERIC(5, 2),
    common_itc_reversal_rupees BIGINT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (project_id, period_year, period_quarter),
    FOREIGN KEY (project_id) REFERENCES projects (id)
);

CREATE TABLE tds_filings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    period_year SMALLINT NOT NULL,
    period_quarter SMALLINT NOT NULL CHECK (period_quarter BETWEEN 1 AND 4),

    form26q_status TEXT NOT NULL DEFAULT 'not_started' CHECK (form26q_status IN ('not_started', 'draft', 'filed')),
    form26q_due_at TIMESTAMPTZ,
    section194c_deducted_rupees BIGINT NOT NULL DEFAULT 0,
    section194j_deducted_rupees BIGINT NOT NULL DEFAULT 0,
    -- Per-professional 194J breakdown only — the screen shows 194C purely as an aggregate
    -- (per-contractor detail lives on the not-yet-built Screen 15). One entry per payee:
    -- {payee_name, amount_rupees, deposit_status: 'deposited'|'pending_deposit', deposit_due_at}.
    section194j_by_professional JSONB NOT NULL DEFAULT '[]',

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (project_id, period_year, period_quarter),
    FOREIGN KEY (project_id) REFERENCES projects (id)
);
