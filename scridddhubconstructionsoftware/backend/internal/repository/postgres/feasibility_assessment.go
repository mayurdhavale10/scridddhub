package postgres

import (
	"context"
	"encoding/json"

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
	COALESCE(comparable_sales_note, ''), created_at, updated_at,
	current_low_rupees, current_high_rupees, future_low_rupees, future_high_rupees,
	method, basis, COALESCE(reasoning, ''), COALESCE(model, ''), assessed_at
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

	method := assessment.Method
	if method == "" {
		method = "manual"
	}
	basis, err := json.Marshal(assessment.Basis)
	if err != nil {
		return err
	}
	if method == "manual" {
		basis = []byte("{}")
	}
	row := tx.QueryRow(ctx, `
		INSERT INTO feasibility_assessments (
			land_parcel_id, current_valuation_rupees, future_valuation_rupees, future_valuation_year,
			verdict, compared_parcel_id, margin_pct, infrastructure_note, comparable_sales_note,
			current_low_rupees, current_high_rupees, future_low_rupees, future_high_rupees,
			method, basis, reasoning, model, assessed_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NULLIF($16, ''), NULLIF($17, ''), $18)
		ON CONFLICT (land_parcel_id) DO UPDATE SET
			current_valuation_rupees = EXCLUDED.current_valuation_rupees,
			future_valuation_rupees = EXCLUDED.future_valuation_rupees,
			future_valuation_year = EXCLUDED.future_valuation_year,
			verdict = EXCLUDED.verdict,
			compared_parcel_id = EXCLUDED.compared_parcel_id,
			margin_pct = EXCLUDED.margin_pct,
			infrastructure_note = EXCLUDED.infrastructure_note,
			comparable_sales_note = EXCLUDED.comparable_sales_note,
			current_low_rupees = EXCLUDED.current_low_rupees,
			current_high_rupees = EXCLUDED.current_high_rupees,
			future_low_rupees = EXCLUDED.future_low_rupees,
			future_high_rupees = EXCLUDED.future_high_rupees,
			method = EXCLUDED.method,
			basis = EXCLUDED.basis,
			reasoning = EXCLUDED.reasoning,
			model = EXCLUDED.model,
			assessed_at = EXCLUDED.assessed_at,
			updated_at = now()
		RETURNING id, created_at, updated_at
	`, assessment.LandParcelID, assessment.CurrentValuationRupees, assessment.FutureValuationRupees,
		assessment.FutureValuationYear, assessment.Verdict, assessment.ComparedParcelID,
		assessment.MarginPct, assessment.InfrastructureNote, assessment.ComparableSalesNote,
		assessment.CurrentLowRupees, assessment.CurrentHighRupees, assessment.FutureLowRupees,
		assessment.FutureHighRupees, method, basis, assessment.Reasoning, assessment.Model,
		assessment.AssessedAt)
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
	var basis []byte
	err := row.Scan(&a.ID, &a.LandParcelID, &a.CurrentValuationRupees, &a.FutureValuationRupees,
		&a.FutureValuationYear, &a.Verdict, &a.ComparedParcelID, &a.MarginPct,
		&a.InfrastructureNote, &a.ComparableSalesNote, &a.CreatedAt, &a.UpdatedAt,
		&a.CurrentLowRupees, &a.CurrentHighRupees, &a.FutureLowRupees, &a.FutureHighRupees,
		&a.Method, &basis, &a.Reasoning, &a.Model, &a.AssessedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	if len(basis) > 0 {
		if err := json.Unmarshal(basis, &a.Basis); err != nil {
			return nil, err
		}
	}
	return &a, nil
}
