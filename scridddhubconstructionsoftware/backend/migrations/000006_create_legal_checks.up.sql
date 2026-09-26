CREATE TABLE legal_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    land_parcel_id UUID NOT NULL UNIQUE REFERENCES land_parcels (id),

    ownership_risk TEXT NOT NULL CHECK (ownership_risk IN ('low', 'medium', 'high')),
    ownership_risk_note TEXT,
    litigation_risk TEXT NOT NULL CHECK (litigation_risk IN ('low', 'medium', 'high')),
    litigation_risk_note TEXT,
    encumbrance_risk TEXT NOT NULL CHECK (encumbrance_risk IN ('low', 'medium', 'high')),
    encumbrance_risk_note TEXT,
    regulatory_risk TEXT NOT NULL CHECK (regulatory_risk IN ('low', 'medium', 'high')),
    regulatory_risk_note TEXT,

    -- Repeating lists rendered and saved as a whole with the rest of the check (Screen 6 has no
    -- per-entry editing or cross-parcel querying of these yet) — JSONB, not 4 more child tables.
    -- Each is a JSON array; shape documented in internal/domain/legal_check.go.
    ownership_chain JSONB NOT NULL DEFAULT '[]',
    encumbrance_searches JSONB NOT NULL DEFAULT '[]',
    search_summary_note TEXT,
    rera_history JSONB NOT NULL DEFAULT '[]',
    rera_history_summary_note TEXT,
    documents JSONB NOT NULL DEFAULT '[]',

    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'cleared')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
