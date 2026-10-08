package postgres

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scridddhub/backend/internal/domain"
)

// ParcelTenureRepository stores how each deal's land is acquired (migration 045).
type ParcelTenureRepository struct {
	pool *pgxpool.Pool
}

func NewParcelTenureRepository(pool *pgxpool.Pool) *ParcelTenureRepository {
	return &ParcelTenureRepository{pool: pool}
}

const parcelTenureSelectCols = `
	id, land_parcel_id, tenure_type,
	purchase_price_rupees, purchase_stamp_duty_rupees,
	COALESCE(jda_model, ''), developer_area_share_pct, landowner_revenue_share_pct,
	cash_on_top_of_share, security_deposit_rupees, deposit_refundable, jda_stamp_duty_rupees,
	gst_reverse_charge_applicable, landowner_is_co_promoter,
	created_at, updated_at
`

func (r *ParcelTenureRepository) Upsert(ctx context.Context, actor string, t *domain.ParcelTenure) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	before, err := scanParcelTenure(tx.QueryRow(ctx, `
		SELECT `+parcelTenureSelectCols+` FROM land_parcel_tenures WHERE land_parcel_id = $1 FOR UPDATE
	`, t.LandParcelID))
	action := "update"
	if err == domain.ErrNotFound {
		before = nil
		action = "insert"
	} else if err != nil {
		return err
	}

	var jdaModel *string
	if t.JDAModel != "" {
		jdaModel = &t.JDAModel
	}
	row := tx.QueryRow(ctx, `
		INSERT INTO land_parcel_tenures (
			land_parcel_id, tenure_type, purchase_price_rupees, purchase_stamp_duty_rupees,
			jda_model, developer_area_share_pct, landowner_revenue_share_pct, cash_on_top_of_share,
			security_deposit_rupees, deposit_refundable, jda_stamp_duty_rupees,
			gst_reverse_charge_applicable, landowner_is_co_promoter
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		ON CONFLICT (land_parcel_id) DO UPDATE SET
			tenure_type = EXCLUDED.tenure_type,
			purchase_price_rupees = EXCLUDED.purchase_price_rupees,
			purchase_stamp_duty_rupees = EXCLUDED.purchase_stamp_duty_rupees,
			jda_model = EXCLUDED.jda_model,
			developer_area_share_pct = EXCLUDED.developer_area_share_pct,
			landowner_revenue_share_pct = EXCLUDED.landowner_revenue_share_pct,
			cash_on_top_of_share = EXCLUDED.cash_on_top_of_share,
			security_deposit_rupees = EXCLUDED.security_deposit_rupees,
			deposit_refundable = EXCLUDED.deposit_refundable,
			jda_stamp_duty_rupees = EXCLUDED.jda_stamp_duty_rupees,
			gst_reverse_charge_applicable = EXCLUDED.gst_reverse_charge_applicable,
			landowner_is_co_promoter = EXCLUDED.landowner_is_co_promoter,
			updated_at = now()
		RETURNING id, created_at, updated_at
	`, t.LandParcelID, t.TenureType, t.PurchasePriceRupees, t.PurchaseStampDutyRupees,
		jdaModel, t.DeveloperAreaSharePct, t.LandownerRevenueSharePct, t.CashOnTopOfShare,
		t.SecurityDepositRupees, t.DepositRefundable, t.JDAStampDutyRupees,
		t.GSTReverseChargeApplicable, t.LandownerIsCoPromoter)
	if err := row.Scan(&t.ID, &t.CreatedAt, &t.UpdatedAt); err != nil {
		return err
	}
	if err := writeAudit(ctx, tx, "land_parcel_tenures", t.ID, action, actor, before, t); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *ParcelTenureRepository) GetByLandParcel(ctx context.Context, landParcelID uuid.UUID) (*domain.ParcelTenure, error) {
	return scanParcelTenure(r.pool.QueryRow(ctx, `
		SELECT `+parcelTenureSelectCols+` FROM land_parcel_tenures WHERE land_parcel_id = $1
	`, landParcelID))
}

func scanParcelTenure(row rowScanner) (*domain.ParcelTenure, error) {
	var t domain.ParcelTenure
	err := row.Scan(&t.ID, &t.LandParcelID, &t.TenureType,
		&t.PurchasePriceRupees, &t.PurchaseStampDutyRupees,
		&t.JDAModel, &t.DeveloperAreaSharePct, &t.LandownerRevenueSharePct,
		&t.CashOnTopOfShare, &t.SecurityDepositRupees, &t.DepositRefundable, &t.JDAStampDutyRupees,
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
