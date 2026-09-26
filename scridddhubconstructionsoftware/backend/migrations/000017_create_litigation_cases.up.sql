-- LitigationCase (Screen 8.17) — the developer's own complete internal record of every open
-- and closed matter (RERA tribunal, consumer court, contractor arbitration), as distinct from
-- Screen 37's curated, opt-in, buyer-facing case count.
--
-- Scope correction, caught by reading the real screen content rather than assuming it followed
-- every prior 8.x entity's project-scoping: the wireframe's own example cards reference THREE
-- different project names side by side on one screen ("Riverside Towers", "Deshmukh Builders" —
-- a contractor, "Sunrise Residency"). The screen's own framing — "this developer's own internal
-- record" — confirms this is scoped to the developer (org), not to a single project, unlike
-- LandTenure/FinancialStructure/EscrowAccount/etc. project_id is therefore nullable (some
-- matters, e.g. a corporate-level dispute, may not tie to one specific project) rather than
-- NOT NULL the way every other 8.x table's project_id is.
--
-- Honest limit (from the wireframe itself): case status is entered by the developer's legal team
-- or external counsel, not auto-scraped from tribunal/court systems.
CREATE TABLE litigation_cases (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                 UUID NOT NULL,
    project_id             UUID REFERENCES projects(id),

    case_type              TEXT NOT NULL CHECK (case_type IN ('rera_tribunal', 'consumer_court', 'arbitration')),
    counterparty_type      TEXT NOT NULL CHECK (counterparty_type IN ('buyer', 'contractor')),
    counterparty_name      TEXT,
    forum                  TEXT NOT NULL,
    subject                TEXT NOT NULL,

    status                 TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed')),
    next_hearing_at        TIMESTAMPTZ,
    claimed_amount_rupees  BIGINT,
    resolution_note        TEXT,

    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_litigation_cases_org_id ON litigation_cases (org_id);
CREATE INDEX idx_litigation_cases_project_id ON litigation_cases (project_id);
