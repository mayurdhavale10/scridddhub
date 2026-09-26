package postgres

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scridddhub/backend/internal/domain"
)

type TPAReportRepository struct {
	pool *pgxpool.Pool
}

func NewTPAReportRepository(pool *pgxpool.Pool) *TPAReportRepository {
	return &TPAReportRepository{pool: pool}
}

const tpaReportSelectCols = `
	id, project_id, lender_name, template_version, period_year, period_quarter,
	physical_progress_pct, cost_incurred_rupees, dscr, security_cover_ratio,
	units_sold, units_total, status, submitted_at, created_at, updated_at
`

func (r *TPAReportRepository) Upsert(ctx context.Context, actor string, report *domain.TPAReport) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var before *domain.TPAReport
	beforeVal := domain.TPAReport{}
	scanErr := scanTPAReport(tx.QueryRow(ctx, `
		SELECT `+tpaReportSelectCols+`
		FROM tpa_reports
		WHERE project_id = $1 AND lender_name = $2 AND period_year = $3 AND period_quarter = $4
		FOR UPDATE
	`, report.ProjectID, report.LenderName, report.PeriodYear, report.PeriodQuarter), &beforeVal)
	action := "update"
	if scanErr == domain.ErrNotFound {
		action = "insert"
	} else if scanErr != nil {
		return scanErr
	} else {
		before = &beforeVal
	}

	if err := scanTPAReport(tx.QueryRow(ctx, `
		INSERT INTO tpa_reports (
			project_id, lender_name, template_version, period_year, period_quarter,
			physical_progress_pct, cost_incurred_rupees, dscr, security_cover_ratio,
			units_sold, units_total
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (project_id, lender_name, period_year, period_quarter) DO UPDATE SET
			template_version = EXCLUDED.template_version,
			physical_progress_pct = EXCLUDED.physical_progress_pct,
			cost_incurred_rupees = EXCLUDED.cost_incurred_rupees,
			dscr = EXCLUDED.dscr,
			security_cover_ratio = EXCLUDED.security_cover_ratio,
			units_sold = EXCLUDED.units_sold,
			units_total = EXCLUDED.units_total,
			updated_at = now()
		RETURNING `+tpaReportSelectCols,
		report.ProjectID, report.LenderName, report.TemplateVersion, report.PeriodYear, report.PeriodQuarter,
		report.PhysicalProgressPct, report.CostIncurredRupees, report.DSCR, report.SecurityCoverRatio,
		report.UnitsSold, report.UnitsTotal), report); err != nil {
		return err
	}

	if err := writeAudit(ctx, tx, "tpa_reports", report.ID, action, actor, before, report); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *TPAReportRepository) GetByLenderPeriod(ctx context.Context, projectID uuid.UUID, lenderName string, year, quarter int16) (*domain.TPAReport, error) {
	var rep domain.TPAReport
	err := scanTPAReport(r.pool.QueryRow(ctx, `
		SELECT `+tpaReportSelectCols+`
		FROM tpa_reports
		WHERE project_id = $1 AND lender_name = $2 AND period_year = $3 AND period_quarter = $4
	`, projectID, lenderName, year, quarter), &rep)
	if err != nil {
		return nil, err
	}
	return &rep, nil
}

// MarkSubmitted is a distinct write path from Upsert — "a finance team member reviews and
// submits it," never implied by saving a draft.
func (r *TPAReportRepository) MarkSubmitted(ctx context.Context, actor string, reportID uuid.UUID) (*domain.TPAReport, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var before domain.TPAReport
	if err := scanTPAReport(tx.QueryRow(ctx, `
		SELECT `+tpaReportSelectCols+`
		FROM tpa_reports
		WHERE id = $1
		FOR UPDATE
	`, reportID), &before); err != nil {
		return nil, err
	}

	var after domain.TPAReport
	if err := scanTPAReport(tx.QueryRow(ctx, `
		UPDATE tpa_reports
		SET status = 'submitted', submitted_at = now(), updated_at = now()
		WHERE id = $1
		RETURNING `+tpaReportSelectCols, reportID), &after); err != nil {
		return nil, err
	}

	if err := writeAudit(ctx, tx, "tpa_reports", reportID, "update", actor, &before, &after); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &after, nil
}

func scanTPAReport(row rowScanner, r *domain.TPAReport) error {
	err := row.Scan(&r.ID, &r.ProjectID, &r.LenderName, &r.TemplateVersion, &r.PeriodYear, &r.PeriodQuarter,
		&r.PhysicalProgressPct, &r.CostIncurredRupees, &r.DSCR, &r.SecurityCoverRatio,
		&r.UnitsSold, &r.UnitsTotal, &r.Status, &r.SubmittedAt, &r.CreatedAt, &r.UpdatedAt)
	if err == pgx.ErrNoRows {
		return domain.ErrNotFound
	}
	return err
}
