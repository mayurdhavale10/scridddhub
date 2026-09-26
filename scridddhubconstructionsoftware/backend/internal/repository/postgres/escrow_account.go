package postgres

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scridddhub/backend/internal/domain"
)

type EscrowAccountRepository struct {
	pool *pgxpool.Pool
}

func NewEscrowAccountRepository(pool *pgxpool.Pool) *EscrowAccountRepository {
	return &EscrowAccountRepository{pool: pool}
}

const escrowAccountSelectCols = `
	id, project_id, bank_balance_rupees, COALESCE(bank_source_name, ''), bank_synced_at,
	developer_ledger_balance_rupees, created_at, updated_at
`

func (r *EscrowAccountRepository) UpdateDeveloperLedger(ctx context.Context, actor string, projectID uuid.UUID, balanceRupees int64) (*domain.EscrowAccount, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	before, err := scanEscrowAccount(tx.QueryRow(ctx, `
		SELECT `+escrowAccountSelectCols+`
		FROM escrow_accounts
		WHERE project_id = $1
		FOR UPDATE
	`, projectID))
	action := "update"
	if err == domain.ErrNotFound {
		before = nil
		action = "insert"
	} else if err != nil {
		return nil, err
	}

	after, err := scanEscrowAccount(tx.QueryRow(ctx, `
		INSERT INTO escrow_accounts (project_id, developer_ledger_balance_rupees)
		VALUES ($1, $2)
		ON CONFLICT (project_id) DO UPDATE SET
			developer_ledger_balance_rupees = EXCLUDED.developer_ledger_balance_rupees,
			updated_at = now()
		RETURNING `+escrowAccountSelectCols+`
	`, projectID, balanceRupees))
	if err != nil {
		return nil, err
	}

	if err := writeAudit(ctx, tx, "escrow_accounts", after.ID, action, actor, before, after); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return after, nil
}

func (r *EscrowAccountRepository) UpdateBankFeed(ctx context.Context, actor string, projectID uuid.UUID, balanceRupees int64, sourceName string, syncedAt time.Time) (*domain.EscrowAccount, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	before, err := scanEscrowAccount(tx.QueryRow(ctx, `
		SELECT `+escrowAccountSelectCols+`
		FROM escrow_accounts
		WHERE project_id = $1
		FOR UPDATE
	`, projectID))
	action := "update"
	if err == domain.ErrNotFound {
		before = nil
		action = "insert"
	} else if err != nil {
		return nil, err
	}

	after, err := scanEscrowAccount(tx.QueryRow(ctx, `
		INSERT INTO escrow_accounts (project_id, bank_balance_rupees, bank_source_name, bank_synced_at)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (project_id) DO UPDATE SET
			bank_balance_rupees = EXCLUDED.bank_balance_rupees,
			bank_source_name = EXCLUDED.bank_source_name,
			bank_synced_at = EXCLUDED.bank_synced_at,
			updated_at = now()
		RETURNING `+escrowAccountSelectCols+`
	`, projectID, balanceRupees, sourceName, syncedAt))
	if err != nil {
		return nil, err
	}

	if err := writeAudit(ctx, tx, "escrow_accounts", after.ID, action, actor, before, after); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return after, nil
}

func (r *EscrowAccountRepository) GetByProject(ctx context.Context, projectID uuid.UUID) (*domain.EscrowAccount, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT `+escrowAccountSelectCols+`
		FROM escrow_accounts
		WHERE project_id = $1
	`, projectID)
	return scanEscrowAccount(row)
}

func scanEscrowAccount(row rowScanner) (*domain.EscrowAccount, error) {
	var e domain.EscrowAccount
	err := row.Scan(&e.ID, &e.ProjectID, &e.BankBalanceRupees, &e.BankSourceName, &e.BankSyncedAt,
		&e.DeveloperLedgerBalanceRupees, &e.CreatedAt, &e.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &e, nil
}
