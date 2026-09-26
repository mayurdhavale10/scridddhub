package postgres

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scridddhub/backend/internal/domain"
)

type FeasibilityAssessmentRepository struct {
	pool *pgxpool.Pool
}

func NewFeasibilityAssessmentRepository(pool *pgxpool.Pool) *FeasibilityAssessmentRepository {
	return &FeasibilityAssessmentRepository{pool: pool}
}

const feasibilityAssessmentSelectCols = `
	id, land_parcel_id, current_valuation_rupees, future_valuation_rupees, future_valuation_year,
	verdict, compared_parcel_id, margin_pct, COALESCE(infrastructure_note, ''),
	COALESCE(comparable_sales_note, ''), created_at, updated_at
`

// Upsert creates the parcel's assessment if none exists yet, or replaces it if one does — Screen
// 5 shows a single current assessment per parcel, not a history of recalculations. Either way,
// the write and its audit_log row happen in the same transaction (ADR-0002).
func (r *FeasibilityAssessmentRepository) Upsert(ctx context.Context, actor string, assessment *domain.FeasibilityAssessment) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	before, err := scanFeasibilityAssessment(tx.QueryRow(ctx, `
		SELECT `+feasibilityAssessmentSelectCols+`
		FROM feasibility_assessments
		WHERE land_parcel_id = $1
		FOR UPDATE
	`, assessment.LandParcelID))
	action := "update"
	if err == domain.ErrNotFound {
		before = nil
		action = "insert"
	} else if err != nil {
		return err
	}

	row := tx.QueryRow(ctx, `
		INSERT INTO feasibility_assessments (
			land_parcel_id, current_valuation_rupees, future_valuation_rupees, future_valuation_year,
			verdict, compared_parcel_id, margin_pct, infrastructure_note, comparable_sales_note
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (land_parcel_id) DO UPDATE SET
			current_valuation_rupees = EXCLUDED.current_valuation_rupees,
			future_valuation_rupees = EXCLUDED.future_valuation_rupees,
			future_valuation_year = EXCLUDED.future_valuation_year,
			verdict = EXCLUDED.verdict,
			compared_parcel_id = EXCLUDED.compared_parcel_id,
			margin_pct = EXCLUDED.margin_pct,
			infrastructure_note = EXCLUDED.infrastructure_note,
			comparable_sales_note = EXCLUDED.comparable_sales_note,
			updated_at = now()
		RETURNING id, created_at, updated_at
	`, assessment.LandParcelID, assessment.CurrentValuationRupees, assessment.FutureValuationRupees,
		assessment.FutureValuationYear, assessment.Verdict, assessment.ComparedParcelID,
		assessment.MarginPct, assessment.InfrastructureNote, assessment.ComparableSalesNote)
	if err := row.Scan(&assessment.ID, &assessment.CreatedAt, &assessment.UpdatedAt); err != nil {
		return err
	}

	if err := writeAudit(ctx, tx, "feasibility_assessments", assessment.ID, action, actor, before, assessment); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *FeasibilityAssessmentRepository) GetByLandParcel(ctx context.Context, landParcelID uuid.UUID) (*domain.FeasibilityAssessment, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT `+feasibilityAssessmentSelectCols+`
		FROM feasibility_assessments
		WHERE land_parcel_id = $1
	`, landParcelID)
	return scanFeasibilityAssessment(row)
}

func scanFeasibilityAssessment(row rowScanner) (*domain.FeasibilityAssessment, error) {
	var a domain.FeasibilityAssessment
	err := row.Scan(&a.ID, &a.LandParcelID, &a.CurrentValuationRupees, &a.FutureValuationRupees,
		&a.FutureValuationYear, &a.Verdict, &a.ComparedParcelID, &a.MarginPct,
		&a.InfrastructureNote, &a.ComparableSalesNote, &a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &a, nil
}
