package postgres

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scridddhub/backend/internal/domain"
)

type LitigationCaseRepository struct {
	pool *pgxpool.Pool
}

func NewLitigationCaseRepository(pool *pgxpool.Pool) *LitigationCaseRepository {
	return &LitigationCaseRepository{pool: pool}
}

const litigationCaseSelectCols = `
	id, org_id, project_id, case_type, counterparty_type, counterparty_name, forum, subject,
	status, next_hearing_at, claimed_amount_rupees, resolution_note, created_at, updated_at
`

func (r *LitigationCaseRepository) Create(ctx context.Context, actor string, c *domain.LitigationCase) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if err := scanLitigationCase(tx.QueryRow(ctx, `
		INSERT INTO litigation_cases (
			org_id, project_id, case_type, counterparty_type, counterparty_name, forum, subject,
			status, next_hearing_at, claimed_amount_rupees, resolution_note
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING `+litigationCaseSelectCols,
		c.OrgID, c.ProjectID, c.CaseType, c.CounterpartyType, c.CounterpartyName, c.Forum, c.Subject,
		c.Status, c.NextHearingAt, c.ClaimedAmountRupees, c.ResolutionNote), c); err != nil {
		return err
	}

	if err := writeAudit(ctx, tx, "litigation_cases", c.ID, "insert", actor, nil, c); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *LitigationCaseRepository) Get(ctx context.Context, id uuid.UUID) (*domain.LitigationCase, error) {
	var c domain.LitigationCase
	err := scanLitigationCase(r.pool.QueryRow(ctx, `
		SELECT `+litigationCaseSelectCols+`
		FROM litigation_cases
		WHERE id = $1
	`, id), &c)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *LitigationCaseRepository) ListByOrg(ctx context.Context, orgID uuid.UUID) ([]*domain.LitigationCase, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT `+litigationCaseSelectCols+`
		FROM litigation_cases
		WHERE org_id = $1
		ORDER BY created_at DESC
	`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var cases []*domain.LitigationCase
	for rows.Next() {
		var c domain.LitigationCase
		if err := scanLitigationCase(rows, &c); err != nil {
			return nil, err
		}
		cases = append(cases, &c)
	}
	return cases, rows.Err()
}

func (r *LitigationCaseRepository) UpdateStatus(ctx context.Context, actor string, id uuid.UUID, status domain.LitigationCaseStatus, resolutionNote *string) (*domain.LitigationCase, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var before domain.LitigationCase
	if err := scanLitigationCase(tx.QueryRow(ctx, `
		SELECT `+litigationCaseSelectCols+`
		FROM litigation_cases
		WHERE id = $1
		FOR UPDATE
	`, id), &before); err != nil {
		return nil, err
	}

	var after domain.LitigationCase
	if err := scanLitigationCase(tx.QueryRow(ctx, `
		UPDATE litigation_cases
		SET status = $1, resolution_note = $2, updated_at = now()
		WHERE id = $3
		RETURNING `+litigationCaseSelectCols, status, resolutionNote, id), &after); err != nil {
		return nil, err
	}

	if err := writeAudit(ctx, tx, "litigation_cases", id, "update", actor, &before, &after); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &after, nil
}

func scanLitigationCase(row rowScanner, c *domain.LitigationCase) error {
	err := row.Scan(&c.ID, &c.OrgID, &c.ProjectID, &c.CaseType, &c.CounterpartyType, &c.CounterpartyName,
		&c.Forum, &c.Subject, &c.Status, &c.NextHearingAt, &c.ClaimedAmountRupees, &c.ResolutionNote,
		&c.CreatedAt, &c.UpdatedAt)
	if err == pgx.ErrNoRows {
		return domain.ErrNotFound
	}
	return err
}
