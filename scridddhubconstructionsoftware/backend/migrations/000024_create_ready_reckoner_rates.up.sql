-- Reference/master data for the Estimate Value feature (services/estimatedparcelvalue).
-- Deliberately NOT user-editable through the app and NOT wrapped in the audit-trail pattern
-- (ADR-0002) — same precedent as approval_playbooks (migration 000007): this is seeded reference
-- data maintained by whoever operates the app, not a business entity a user of the app mutates.
--
-- One row = one government-published Ready Reckoner Rate (Maharashtra e-ASR) for a specific
-- village/zone, for one effective year. village + zone_no + effective_year is the real-world key;
-- zone_no defaults to '' (not NULL) so the UNIQUE constraint actually holds — Postgres treats NULLs
-- as distinct from each other, which would otherwise allow duplicate rows for villages with no
-- zone breakdown.
CREATE TABLE ready_reckoner_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    district TEXT NOT NULL,
    taluka TEXT NOT NULL,
    village TEXT NOT NULL,
    zone_no TEXT NOT NULL DEFAULT '',
    rate_per_sqm_rupees BIGINT NOT NULL CHECK (rate_per_sqm_rupees > 0),
    effective_year TEXT NOT NULL,
    -- The exact e-ASR URL/query used to look this rate up, so the figure is checkable, not just
    -- asserted.
    source_url TEXT NOT NULL,
    -- Who confirmed this figure against the live portal, and when — this table has no ingestion
    -- pipeline yet (the portal is an interactive form, not a public API), so every row starts as a
    -- manually verified entry. See services/estimatedparcelvalue/README.md.
    verified_at TIMESTAMPTZ NOT NULL,
    verified_by TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (district, taluka, village, zone_no, effective_year)
);

CREATE INDEX idx_ready_reckoner_rates_lookup ON ready_reckoner_rates (district, taluka, village);
