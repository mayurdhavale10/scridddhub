package postgres

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scridddhub/backend/internal/domain"
)

type LenderCovenantRepository struct {
	pool *pgxpool.Pool
}

func NewLenderCovenantRepository(pool *pgxpool.Pool) *LenderCovenantRepository {
	return &LenderCovenantRepository{pool: pool}
}

const lenderCovenantSelectCols = `
	id, project_id, dscr, dscr_covenant_min, security_cover_ratio, security_cover_covenant_min,
	next_tpa_report_due_at, created_at, updated_at
`

func (r *LenderCovenantRepository) Upsert(ctx context.Context, actor string, covenant *domain.LenderCovenant) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	before, err := scanLenderCovenant(tx.QueryRow(ctx, `
		SELECT `+lenderCovenantSelectCols+`
		FROM lender_covenants
		WHERE project_id = $1
		FOR UPDATE
	`, covenant.ProjectID))
	action := "update"
	if err == domain.ErrNotFound {
		before = nil
		action = "insert"
	} else if err != nil {
		return err
	}

	row := tx.QueryRow(ctx, `
		INSERT INTO lender_covenants (
			project_id, dscr, dscr_covenant_min, security_cover_ratio, security_cover_covenant_min,
			next_tpa_report_due_at
		)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (project_id) DO UPDATE SET
			dscr = EXCLUDED.dscr,
			dscr_covenant_min = EXCLUDED.dscr_covenant_min,
			security_cover_ratio = EXCLUDED.security_cover_ratio,
			security_cover_covenant_min = EXCLUDED.security_cover_covenant_min,
			next_tpa_report_due_at = EXCLUDED.next_tpa_report_due_at,
			updated_at = now()
		RETURNING id, created_at, updated_at
	`, covenant.ProjectID, covenant.DSCR, covenant.DSCRCovenantMin,
		covenant.SecurityCoverRatio, covenant.SecurityCoverCovenantMin, covenant.NextTPAReportDueAt)
	if err := row.Scan(&covenant.ID, &covenant.CreatedAt, &covenant.UpdatedAt); err != nil {
		return err
	}

	if err := writeAudit(ctx, tx, "lender_covenants", covenant.ID, action, actor, before, covenant); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *LenderCovenantRepository) GetByProject(ctx context.Context, projectID uuid.UUID) (*domain.LenderCovenant, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT `+lenderCovenantSelectCols+`
		FROM lender_covenants
		WHERE project_id = $1
	`, projectID)
	return scanLenderCovenant(row)
}

func scanLenderCovenant(row rowScanner) (*domain.LenderCovenant, error) {
	var c domain.LenderCovenant
	err := row.Scan(&c.ID, &c.ProjectID, &c.DSCR, &c.DSCRCovenantMin,
		&c.SecurityCoverRatio, &c.SecurityCoverCovenantMin, &c.NextTPAReportDueAt,
		&c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &c, nil
}
