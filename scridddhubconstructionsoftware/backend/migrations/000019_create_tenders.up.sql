-- Tender + TenderBid (Screen 10) — "selective tendering: 3 shortlisted contractors, technical
-- bid then financial bid, not an open public tender." A project can run more than one tender
-- over its life (civil work, MEP, finishing, ...), each scoped by trade_package; each tender has
-- its own shortlist of bids.
CREATE TABLE tenders (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id    UUID NOT NULL REFERENCES projects(id),
    trade_package TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenders_project_id ON tenders (project_id);

-- technical_bid_status: qualified/disqualified/pending — the wireframe's own examples show only
-- "qualified," but a selective shortlist implies disqualification is a real possible outcome, not
-- an invented one. financial_bid_rupees is nullable — a contractor can be technically qualified
-- before submitting a financial bid. recommended is the platform's own pick shown on one card
-- ("Deshmukh Builders ... recommended"), not the same thing as a final award decision — this
-- screen's own CTA ("Confirm & Set Master Schedule") is the actual award action, which belongs to
-- Screen 11 (MasterScheduleMilestone), not yet built.
CREATE TABLE tender_bids (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tender_id               UUID NOT NULL REFERENCES tenders(id),
    contractor_name         TEXT NOT NULL,
    past_jobs_with_developer INTEGER NOT NULL DEFAULT 0,
    past_performance_note   TEXT NOT NULL,
    technical_bid_status    TEXT NOT NULL CHECK (technical_bid_status IN ('qualified', 'disqualified', 'pending')),
    financial_bid_rupees    BIGINT,
    recommended             BOOLEAN NOT NULL DEFAULT false,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tender_bids_tender_id ON tender_bids (tender_id);
