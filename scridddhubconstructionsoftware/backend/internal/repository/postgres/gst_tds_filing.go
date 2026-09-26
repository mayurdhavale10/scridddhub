package postgres

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scridddhub/backend/internal/domain"
)

// --- GST filing ---

type GSTFilingRepository struct {
	pool *pgxpool.Pool
}

func NewGSTFilingRepository(pool *pgxpool.Pool) *GSTFilingRepository {
	return &GSTFilingRepository{pool: pool}
}

const gstFilingSelectCols = `
	id, project_id, period_year, period_quarter,
	gstr1_status, gstr1_filed_late, gstr3b_status, gstr3b_due_at,
	itc_claimed_rupees, exempt_turnover_ratio_pct, common_itc_reversal_rupees,
	created_at, updated_at
`

func (r *GSTFilingRepository) Upsert(ctx context.Context, actor string, filing *domain.GSTFiling) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var before *domain.GSTFiling
	beforeVal := domain.GSTFiling{}
	scanErr := scanGSTFiling(tx.QueryRow(ctx, `
		SELECT `+gstFilingSelectCols+`
		FROM gst_filings
		WHERE project_id = $1 AND period_year = $2 AND period_quarter = $3
		FOR UPDATE
	`, filing.ProjectID, filing.PeriodYear, filing.PeriodQuarter), &beforeVal)
	action := "update"
	if scanErr == domain.ErrNotFound {
		action = "insert"
	} else if scanErr != nil {
		return scanErr
	} else {
		before = &beforeVal
	}

	if err := scanGSTFiling(tx.QueryRow(ctx, `
		INSERT INTO gst_filings (
			project_id, period_year, period_quarter,
			gstr1_status, gstr1_filed_late, gstr3b_status, gstr3b_due_at,
			itc_claimed_rupees, exempt_turnover_ratio_pct, common_itc_reversal_rupees
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (project_id, period_year, period_quarter) DO UPDATE SET
			gstr1_status = EXCLUDED.gstr1_status,
			gstr1_filed_late = EXCLUDED.gstr1_filed_late,
			gstr3b_status = EXCLUDED.gstr3b_status,
			gstr3b_due_at = EXCLUDED.gstr3b_due_at,
			itc_claimed_rupees = EXCLUDED.itc_claimed_rupees,
			exempt_turnover_ratio_pct = EXCLUDED.exempt_turnover_ratio_pct,
			common_itc_reversal_rupees = EXCLUDED.common_itc_reversal_rupees,
			updated_at = now()
		RETURNING `+gstFilingSelectCols,
		filing.ProjectID, filing.PeriodYear, filing.PeriodQuarter,
		filing.GSTR1Status, filing.GSTR1FiledLate, filing.GSTR3BStatus, filing.GSTR3BDueAt,
		filing.ITCClaimedRupees, filing.ExemptTurnoverRatioPct, filing.CommonITCReversalRupees), filing); err != nil {
		return err
	}

	if err := writeAudit(ctx, tx, "gst_filings", filing.ID, action, actor, before, filing); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *GSTFilingRepository) GetByPeriod(ctx context.Context, projectID uuid.UUID, year, quarter int16) (*domain.GSTFiling, error) {
	var f domain.GSTFiling
	err := scanGSTFiling(r.pool.QueryRow(ctx, `
		SELECT `+gstFilingSelectCols+`
		FROM gst_filings
		WHERE project_id = $1 AND period_year = $2 AND period_quarter = $3
	`, projectID, year, quarter), &f)
	if err != nil {
		return nil, err
	}
	return &f, nil
}

func scanGSTFiling(row rowScanner, f *domain.GSTFiling) error {
	err := row.Scan(&f.ID, &f.ProjectID, &f.PeriodYear, &f.PeriodQuarter,
		&f.GSTR1Status, &f.GSTR1FiledLate, &f.GSTR3BStatus, &f.GSTR3BDueAt,
		&f.ITCClaimedRupees, &f.ExemptTurnoverRatioPct, &f.CommonITCReversalRupees,
		&f.CreatedAt, &f.UpdatedAt)
	if err == pgx.ErrNoRows {
		return domain.ErrNotFound
	}
	return err
}

// --- TDS filing ---

type TDSFilingRepository struct {
	pool *pgxpool.Pool
}

func NewTDSFilingRepository(pool *pgxpool.Pool) *TDSFilingRepository {
	return &TDSFilingRepository{pool: pool}
}

const tdsFilingSelectCols = `
	id, project_id, period_year, period_quarter,
	form26q_status, form26q_due_at, section194c_deducted_rupees, section194j_deducted_rupees,
	section194j_by_professional, created_at, updated_at
`

func (r *TDSFilingRepository) Upsert(ctx context.Context, actor string, filing *domain.TDSFiling) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var before *domain.TDSFiling
	beforeVal := domain.TDSFiling{}
	scanErr := scanTDSFiling(tx.QueryRow(ctx, `
		SELECT `+tdsFilingSelectCols+`
		FROM tds_filings
		WHERE project_id = $1 AND period_year = $2 AND period_quarter = $3
		FOR UPDATE
	`, filing.ProjectID, filing.PeriodYear, filing.PeriodQuarter), &beforeVal)
	action := "update"
	if scanErr == domain.ErrNotFound {
		action = "insert"
	} else if scanErr != nil {
		return scanErr
	} else {
		before = &beforeVal
	}

	professionalsJSON, err := json.Marshal(filing.Section194JByProfessional)
	if err != nil {
		return err
	}

	if err := scanTDSFiling(tx.QueryRow(ctx, `
		INSERT INTO tds_filings (
			project_id, period_year, period_quarter,
			form26q_status, form26q_due_at, section194c_deducted_rupees, section194j_deducted_rupees,
			section194j_by_professional
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
		ON CONFLICT (project_id, period_year, period_quarter) DO UPDATE SET
			form26q_status = EXCLUDED.form26q_status,
			form26q_due_at = EXCLUDED.form26q_due_at,
			section194c_deducted_rupees = EXCLUDED.section194c_deducted_rupees,
			section194j_deducted_rupees = EXCLUDED.section194j_deducted_rupees,
			section194j_by_professional = EXCLUDED.section194j_by_professional,
			updated_at = now()
		RETURNING `+tdsFilingSelectCols,
		filing.ProjectID, filing.PeriodYear, filing.PeriodQuarter,
		filing.Form26QStatus, filing.Form26QDueAt, filing.Section194CDeductedRupees,
		filing.Section194JDeductedRupees, string(professionalsJSON)), filing); err != nil {
		return err
	}

	if err := writeAudit(ctx, tx, "tds_filings", filing.ID, action, actor, before, filing); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *TDSFilingRepository) GetByPeriod(ctx context.Context, projectID uuid.UUID, year, quarter int16) (*domain.TDSFiling, error) {
	var f domain.TDSFiling
	err := scanTDSFiling(r.pool.QueryRow(ctx, `
		SELECT `+tdsFilingSelectCols+`
		FROM tds_filings
		WHERE project_id = $1 AND period_year = $2 AND period_quarter = $3
	`, projectID, year, quarter), &f)
	if err != nil {
		return nil, err
	}
	return &f, nil
}

func scanTDSFiling(row rowScanner, f *domain.TDSFiling) error {
	var professionalsJSON []byte
	err := row.Scan(&f.ID, &f.ProjectID, &f.PeriodYear, &f.PeriodQuarter,
		&f.Form26QStatus, &f.Form26QDueAt, &f.Section194CDeductedRupees, &f.Section194JDeductedRupees,
		&professionalsJSON, &f.CreatedAt, &f.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return domain.ErrNotFound
		}
		return err
	}
	return json.Unmarshal(professionalsJSON, &f.Section194JByProfessional)
}
