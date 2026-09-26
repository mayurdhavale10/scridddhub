-- Screen 8.12, project-scoped. `connections` is a JSONB list (same reasoning as LegalCheck's
-- repeating lists — read/written as a whole with the rest of the record, no independent query
-- need on individual connections yet).
--
-- Honest limit, same category as EscrowAccount's bank feed and GovernmentApproval's LLM step:
-- Tally's own API is XML import/export, not a modern REST API — real per-installation
-- integration work this table doesn't solve, just tracks the resulting state of. No real sync
-- job exists yet; these columns are written directly for now.
CREATE TABLE accounting_syncs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL UNIQUE REFERENCES projects (id),
    connections JSONB NOT NULL DEFAULT '[]',
    last_sync_at TIMESTAMPTZ,
    last_sync_vouchers_posted INTEGER,
    last_sync_vouchers_rejected INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
