package postgres

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scridddhub/backend/internal/domain"
)

type AccountingSyncRepository struct {
	pool *pgxpool.Pool
}

func NewAccountingSyncRepository(pool *pgxpool.Pool) *AccountingSyncRepository {
	return &AccountingSyncRepository{pool: pool}
}

const accountingSyncSelectCols = `
	id, project_id, connections, last_sync_at, last_sync_vouchers_posted,
	last_sync_vouchers_rejected, created_at, updated_at
`

func (r *AccountingSyncRepository) Upsert(ctx context.Context, actor string, sync *domain.AccountingSync) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var before *domain.AccountingSync
	beforeVal := domain.AccountingSync{}
	err = scanAccountingSync(tx.QueryRow(ctx, `
		SELECT `+accountingSyncSelectCols+`
		FROM accounting_syncs
		WHERE project_id = $1
		FOR UPDATE
	`, sync.ProjectID), &beforeVal)
	if err == nil {
		before = &beforeVal
	}
	action := "update"
	if err == domain.ErrNotFound {
		before = nil
		action = "insert"
	} else if err != nil {
		return err
	}

	connectionsJSON, err := json.Marshal(sync.Connections)
	if err != nil {
		return err
	}

	if err := scanAccountingSync(tx.QueryRow(ctx, `
		INSERT INTO accounting_syncs (
			project_id, connections, last_sync_at, last_sync_vouchers_posted, last_sync_vouchers_rejected
		)
		VALUES ($1, $2::jsonb, $3, $4, $5)
		ON CONFLICT (project_id) DO UPDATE SET
			connections = EXCLUDED.connections,
			last_sync_at = EXCLUDED.last_sync_at,
			last_sync_vouchers_posted = EXCLUDED.last_sync_vouchers_posted,
			last_sync_vouchers_rejected = EXCLUDED.last_sync_vouchers_rejected,
			updated_at = now()
		RETURNING `+accountingSyncSelectCols,
		sync.ProjectID, string(connectionsJSON), sync.LastSyncAt,
		sync.LastSyncVouchersPosted, sync.LastSyncVouchersRejected), sync); err != nil {
		return err
	}

	if err := writeAudit(ctx, tx, "accounting_syncs", sync.ID, action, actor, before, sync); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *AccountingSyncRepository) GetByProject(ctx context.Context, projectID uuid.UUID) (*domain.AccountingSync, error) {
	var s domain.AccountingSync
	err := scanAccountingSync(r.pool.QueryRow(ctx, `
		SELECT `+accountingSyncSelectCols+`
		FROM accounting_syncs
		WHERE project_id = $1
	`, projectID), &s)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func scanAccountingSync(row rowScanner, s *domain.AccountingSync) error {
	var connectionsJSON []byte
	err := row.Scan(&s.ID, &s.ProjectID, &connectionsJSON, &s.LastSyncAt,
		&s.LastSyncVouchersPosted, &s.LastSyncVouchersRejected, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return domain.ErrNotFound
		}
		return err
	}
	return json.Unmarshal(connectionsJSON, &s.Connections)
}
