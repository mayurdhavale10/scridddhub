-- Screen 8 (Sources & Uses summary). Sub-screens (8.1 Buyer Collections detail, 8.2 Promoter
-- Equity detail, 8.3 Construction Finance detail, 8.5 Financial Health/Ask AI, 8.6 Uses detail,
-- 8.7 Payment Schedule) are each their own future entities, not modeled here.
--
-- Uses stores all 5 categories from docs/domain-model.md (Construction, Land, Approvals,
-- Marketing, WorkingCapital) individually even though Screen 8's own UI aggregates the last 4
-- into one "Land, Approvals, Marketing & Working Capital" display row — LandTenure (Screen 8.9)
-- explicitly references Land as its own zeroable line under a JDA ("Land STOPS being a cash
-- Use"), so the underlying data must stay granular regardless of how one screen rolls it up.
--
-- Total sources/uses and the "balanced" check are deliberately NOT stored — always derived from
-- these 8 lines, same reasoning as LandTenure's derived landowner_area_share_pct.
CREATE TABLE financial_structures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL UNIQUE REFERENCES projects (id),

    buyer_collections_rupees BIGINT NOT NULL DEFAULT 0,
    promoter_equity_rupees BIGINT NOT NULL DEFAULT 0,
    construction_finance_rupees BIGINT NOT NULL DEFAULT 0,

    construction_use_rupees BIGINT NOT NULL DEFAULT 0,
    land_use_rupees BIGINT NOT NULL DEFAULT 0,
    approvals_use_rupees BIGINT NOT NULL DEFAULT 0,
    marketing_use_rupees BIGINT NOT NULL DEFAULT 0,
    working_capital_use_rupees BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
