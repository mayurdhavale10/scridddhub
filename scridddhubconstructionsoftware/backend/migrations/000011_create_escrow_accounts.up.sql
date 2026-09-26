-- Screen 8.10's entire point: a self-reported escrow balance is exactly the failure mode this
-- product exists to prevent (the wireframe cites the Amrapali fraud pattern explicitly). So this
-- table deliberately has TWO separately-written balances, not one editable field:
--   - bank_balance_rupees: meant to be written ONLY by a real bank statement-fetch integration
--     (a scheduled job or webhook) — see internal/handler/escrow_account.go's UpdateBankFeed,
--     which is NOT wired to any mobile-app UI button. No such integration exists yet (a real,
--     per-bank engineering dependency the wireframe itself says isn't solved by this screen
--     alone) — until it does, this field simply stays unset for real developer use.
--   - developer_ledger_balance_rupees: the developer's own self-reported figure — freely
--     editable, shown side by side with the bank figure, never silently reconciled to it.
-- A mismatch between the two is computed at read time (see domain.EscrowAccount.Mismatch),
-- never hidden.
CREATE TABLE escrow_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL UNIQUE REFERENCES projects (id),

    bank_balance_rupees BIGINT,
    bank_source_name TEXT,
    bank_synced_at TIMESTAMPTZ,

    developer_ledger_balance_rupees BIGINT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
