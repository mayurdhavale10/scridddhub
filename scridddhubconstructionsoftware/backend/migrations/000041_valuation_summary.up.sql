-- Valuation Summary (services/valuationsummary/README.md). The feasibility assessment shown on the
-- Compare screen was storage only: nothing ever wrote it, so every parcel said "Not assessed".
-- An "Assess" now fills it for any parcel: a value range today and in 5 years, plus a record of
-- exactly what that was based on (ADR-0005: versioned and disclosed, never a black-box number).
ALTER TABLE feasibility_assessments
    ADD COLUMN current_low_rupees  BIGINT,
    ADD COLUMN current_high_rupees BIGINT,
    ADD COLUMN future_low_rupees   BIGINT,
    ADD COLUMN future_high_rupees  BIGINT,
    -- 'manual': entered through PUT /feasibility-assessment; 'ai_assessed': produced by Assess.
    ADD COLUMN method TEXT NOT NULL DEFAULT 'manual' CHECK (method IN ('manual', 'ai_assessed')),
    -- Inputs the assessment rested on: area, Ready Reckoner rate, nearby sales, nearby
    -- infrastructure, model and date. Shown as "Based on …".
    ADD COLUMN basis JSONB NOT NULL DEFAULT '{}',
    ADD COLUMN reasoning TEXT,
    ADD COLUMN model TEXT,
    ADD COLUMN assessed_at TIMESTAMPTZ;
