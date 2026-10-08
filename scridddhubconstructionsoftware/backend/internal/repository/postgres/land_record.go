package postgres

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scridddhub/backend/internal/domain"
)

// LandRecordRepository stores a parcel's confirmed 7/12 (migration 049). One per parcel; saving
// again replaces it. Every save is audited.
type LandRecordRepository struct {
	pool *pgxpool.Pool
}

func NewLandRecordRepository(pool *pgxpool.Pool) *LandRecordRepository {
	return &LandRecordRepository{pool: pool}
}

const landRecordCols = `id, land_parcel_id, data, COALESCE(read_by, ''), confirmed_by, confirmed_at, created_at, updated_at`

func (r *LandRecordRepository) GetByLandParcel(ctx context.Context, parcelID uuid.UUID) (*domain.LandRecord, error) {
	return scanLandRecord(r.pool.QueryRow(ctx, `SELECT `+landRecordCols+` FROM land_records WHERE land_parcel_id = $1`, parcelID))
}

func (r *LandRecordRepository) Upsert(ctx context.Context, actor string, rec *domain.LandRecord) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	before, err := scanLandRecord(tx.QueryRow(ctx, `SELECT `+landRecordCols+` FROM land_records WHERE land_parcel_id = $1 FOR UPDATE`, rec.LandParcelID))
	if err != nil && err != domain.ErrNotFound {
		return err
	}
	data, err := json.Marshal(rec.Data)
	if err != nil {
		return err
	}
	row := tx.QueryRow(ctx, `
		INSERT INTO land_records (land_parcel_id, data, read_by, confirmed_by, confirmed_at)
		VALUES ($1, $2::jsonb, NULLIF($3, ''), $4, $5)
		ON CONFLICT (land_parcel_id) DO UPDATE SET
			data = EXCLUDED.data, read_by = EXCLUDED.read_by, confirmed_by = EXCLUDED.confirmed_by,
			confirmed_at = EXCLUDED.confirmed_at, updated_at = now()
		RETURNING id, created_at, updated_at
	`, rec.LandParcelID, string(data), rec.ReadBy, rec.ConfirmedBy, rec.ConfirmedAt)
	if err := row.Scan(&rec.ID, &rec.CreatedAt, &rec.UpdatedAt); err != nil {
		return err
	}
	action := "insert"
	var prev any
	if before != nil {
		action, prev = "update", before
	}
	if err := writeAudit(ctx, tx, "land_records", rec.ID, action, actor, prev, rec); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func scanLandRecord(row rowScanner) (*domain.LandRecord, error) {
	var rec domain.LandRecord
	var data []byte
	err := row.Scan(&rec.ID, &rec.LandParcelID, &data, &rec.ReadBy, &rec.ConfirmedBy, &rec.ConfirmedAt, &rec.CreatedAt, &rec.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	if err := json.Unmarshal(data, &rec.Data); err != nil {
		return nil, err
	}
	return &rec, nil
}
