package postgres

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scridddhub/backend/internal/domain"
)

type RiskRegisterEntryRepository struct {
	pool *pgxpool.Pool
}

func NewRiskRegisterEntryRepository(pool *pgxpool.Pool) *RiskRegisterEntryRepository {
	return &RiskRegisterEntryRepository{pool: pool}
}

const riskRegisterEntrySelectCols = `
	id, project_id, category, status, headline, detail, created_at, updated_at
`

func (r *RiskRegisterEntryRepository) Upsert(ctx context.Context, actor string, entry *domain.RiskRegisterEntry) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var before *domain.RiskRegisterEntry
	beforeVal := domain.RiskRegisterEntry{}
	scanErr := scanRiskRegisterEntry(tx.QueryRow(ctx, `
		SELECT `+riskRegisterEntrySelectCols+`
		FROM risk_register_entries
		WHERE project_id = $1 AND category = $2
		FOR UPDATE
	`, entry.ProjectID, entry.Category), &beforeVal)
	action := "update"
	if scanErr == domain.ErrNotFound {
		action = "insert"
	} else if scanErr != nil {
		return scanErr
	} else {
		before = &beforeVal
	}

	if err := scanRiskRegisterEntry(tx.QueryRow(ctx, `
		INSERT INTO risk_register_entries (project_id, category, status, headline, detail)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (project_id, category) DO UPDATE SET
			status = EXCLUDED.status,
			headline = EXCLUDED.headline,
			detail = EXCLUDED.detail,
			updated_at = now()
		RETURNING `+riskRegisterEntrySelectCols,
		entry.ProjectID, entry.Category, entry.Status, entry.Headline, entry.Detail), entry); err != nil {
		return err
	}

	if err := writeAudit(ctx, tx, "risk_register_entries", entry.ID, action, actor, before, entry); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *RiskRegisterEntryRepository) ListByProject(ctx context.Context, projectID uuid.UUID) ([]*domain.RiskRegisterEntry, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT `+riskRegisterEntrySelectCols+`
		FROM risk_register_entries
		WHERE project_id = $1
		ORDER BY category
	`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []*domain.RiskRegisterEntry
	for rows.Next() {
		var e domain.RiskRegisterEntry
		if err := scanRiskRegisterEntry(rows, &e); err != nil {
			return nil, err
		}
		entries = append(entries, &e)
	}
	return entries, rows.Err()
}

func scanRiskRegisterEntry(row rowScanner, e *domain.RiskRegisterEntry) error {
	err := row.Scan(&e.ID, &e.ProjectID, &e.Category, &e.Status, &e.Headline, &e.Detail, &e.CreatedAt, &e.UpdatedAt)
	if err == pgx.ErrNoRows {
		return domain.ErrNotFound
	}
	return err
}
