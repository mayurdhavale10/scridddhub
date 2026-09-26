-- Screen 8.4 (+ sub-drafts 8.4.1, 8.4.2). Three professionals sign three legally distinct
-- documents each quarter — kept as 3 separate tables, not one JSONB blob, because each has its
-- own signer/timestamp with its own legal weight (audit_log must show WHO signed WHAT, not just
-- that "the packet" changed).
--
-- Honest limit: the wireframe says these drafts are AI-populated "from Tendering, Master
-- Schedule and Buyer Collections" — those entities don't exist in this backend yet (each is its
-- own future Level 1 entity). So engineer_drafts.cost_by_tower and
-- ca_drafts.collected_from_buyers_rupees are entered directly for now, standing in for what
-- would eventually be auto-populated once those source entities are built. Not a shortcut being
-- hidden — flagged here and in the Go code that reads it.
CREATE TABLE certification_packets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects (id),
    period_year SMALLINT NOT NULL,
    period_quarter SMALLINT NOT NULL CHECK (period_quarter BETWEEN 1 AND 4),
    sent_to_professionals_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (project_id, period_year, period_quarter)
);

CREATE TABLE engineer_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certification_packet_id UUID NOT NULL UNIQUE REFERENCES certification_packets (id),
    cost_by_tower JSONB NOT NULL DEFAULT '[]',
    committed_not_reflected_rupees BIGINT,
    source_note TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'signed')),
    signed_by TEXT,
    signed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No AI-draft path, ever (non-negotiable constraint, docs/domain-model.md) — completion_pct can
-- only be set once site_visit_completed_at is non-null, enforced in
-- usecase.CertificationPacketUsecase.SignArchitectCertificate, not just by UI convention.
CREATE TABLE architect_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certification_packet_id UUID NOT NULL UNIQUE REFERENCES certification_packets (id),
    completion_pct NUMERIC(5, 2),
    site_visit_scheduled_at TIMESTAMPTZ,
    site_visit_completed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'awaiting_site_visit' CHECK (status IN ('awaiting_site_visit', 'certified')),
    signed_by TEXT,
    signed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ca_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certification_packet_id UUID NOT NULL UNIQUE REFERENCES certification_packets (id),
    collected_from_buyers_rupees BIGINT NOT NULL DEFAULT 0,
    required_escrow_pct NUMERIC(5, 2) NOT NULL DEFAULT 70.00,
    actually_routed_to_escrow_rupees BIGINT NOT NULL DEFAULT 0,
    source_note TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'signed')),
    signed_by TEXT,
    signed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
