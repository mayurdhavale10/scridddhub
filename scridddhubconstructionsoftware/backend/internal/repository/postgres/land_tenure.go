package postgres

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scridddhub/backend/internal/domain"
)

type LandTenureRepository struct {
	pool *pgxpool.Pool
}

func NewLandTenureRepository(pool *pgxpool.Pool) *LandTenureRepository {
	return &LandTenureRepository{pool: pool}
}

const landTenureSelectCols = `
	id, project_id, tenure_type,
	COALESCE(jda_model, ''), developer_area_share_pct, cash_on_top_of_share,
	refundable_security_deposit_rupees, jda_stamp_duty_rupees,
	gst_reverse_charge_applicable, landowner_is_co_promoter,
	created_at, updated_at
`

func (r *LandTenureRepository) Upsert(ctx context.Context, actor string, tenure *domain.LandTenure) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	before, err := scanLandTenure(tx.QueryRow(ctx, `
		SELECT `+landTenureSelectCols+`
		FROM land_tenures
		WHERE project_id = $1
		FOR UPDATE
	`, tenure.ProjectID))
	action := "update"
	if err == domain.ErrNotFound {
		before = nil
		action = "insert"
	} else if err != nil {
		return err
	}

	row := tx.QueryRow(ctx, `
		INSERT INTO land_tenures (
			project_id, tenure_type, jda_model, developer_area_share_pct, cash_on_top_of_share,
			refundable_security_deposit_rupees, jda_stamp_duty_rupees,
			gst_reverse_charge_applicable, landowner_is_co_promoter
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (project_id) DO UPDATE SET
			tenure_type = EXCLUDED.tenure_type,
			jda_model = EXCLUDED.jda_model,
			developer_area_share_pct = EXCLUDED.developer_area_share_pct,
			cash_on_top_of_share = EXCLUDED.cash_on_top_of_share,
			refundable_security_deposit_rupees = EXCLUDED.refundable_security_deposit_rupees,
			jda_stamp_duty_rupees = EXCLUDED.jda_stamp_duty_rupees,
			gst_reverse_charge_applicable = EXCLUDED.gst_reverse_charge_applicable,
			landowner_is_co_promoter = EXCLUDED.landowner_is_co_promoter,
			updated_at = now()
		RETURNING id, created_at, updated_at
	`, tenure.ProjectID, tenure.TenureType, tenure.JDAModel, tenure.DeveloperAreaSharePct, tenure.CashOnTopOfShare,
		tenure.RefundableSecurityDepositRupees, tenure.JDAStampDutyRupees,
		tenure.GSTReverseChargeApplicable, tenure.LandownerIsCoPromoter)
	if err := row.Scan(&tenure.ID, &tenure.CreatedAt, &tenure.UpdatedAt); err != nil {
		return err
	}

	if err := writeAudit(ctx, tx, "land_tenures", tenure.ID, action, actor, before, tenure); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *LandTenureRepository) GetByProject(ctx context.Context, projectID uuid.UUID) (*domain.LandTenure, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT `+landTenureSelectCols+`
		FROM land_tenures
		WHERE project_id = $1
	`, projectID)
	return scanLandTenure(row)
}

func scanLandTenure(row rowScanner) (*domain.LandTenure, error) {
	var t domain.LandTenure
	err := row.Scan(&t.ID, &t.ProjectID, &t.TenureType,
		&t.JDAModel, &t.DeveloperAreaSharePct, &t.CashOnTopOfShare,
		&t.RefundableSecurityDepositRupees, &t.JDAStampDutyRupees,
		&t.GSTReverseChargeApplicable, &t.LandownerIsCoPromoter,
		&t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &t, nil
}
