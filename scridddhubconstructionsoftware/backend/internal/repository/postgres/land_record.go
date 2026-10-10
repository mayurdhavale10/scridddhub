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

// GetMutations returns the parcel's confirmed mutation register (migration 051).
func (r *LandRecordRepository) GetMutations(ctx context.Context, parcelID uuid.UUID) (*domain.LandMutations, error) {
	return scanLandMutations(r.pool.QueryRow(ctx, `SELECT `+landRecordCols+` FROM land_mutations WHERE land_parcel_id = $1`, parcelID))
}

// UpsertMutations saves the confirmed mutation register, replacing any earlier one. Audited.
func (r *LandRecordRepository) UpsertMutations(ctx context.Context, actor string, m *domain.LandMutations) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	before, err := scanLandMutations(tx.QueryRow(ctx, `SELECT `+landRecordCols+` FROM land_mutations WHERE land_parcel_id = $1 FOR UPDATE`, m.LandParcelID))
	if err != nil && err != domain.ErrNotFound {
		return err
	}
	data, err := json.Marshal(m.Data)
	if err != nil {
		return err
	}
	row := tx.QueryRow(ctx, `
		INSERT INTO land_mutations (land_parcel_id, data, read_by, confirmed_by, confirmed_at)
		VALUES ($1, $2::jsonb, NULLIF($3, ''), $4, $5)
		ON CONFLICT (land_parcel_id) DO UPDATE SET
			data = EXCLUDED.data, read_by = EXCLUDED.read_by, confirmed_by = EXCLUDED.confirmed_by,
			confirmed_at = EXCLUDED.confirmed_at, updated_at = now()
		RETURNING id, created_at, updated_at
	`, m.LandParcelID, string(data), m.ReadBy, m.ConfirmedBy, m.ConfirmedAt)
	if err := row.Scan(&m.ID, &m.CreatedAt, &m.UpdatedAt); err != nil {
		return err
	}
	action := "insert"
	var prev any
	if before != nil {
		action, prev = "update", before
	}
	if err := writeAudit(ctx, tx, "land_mutations", m.ID, action, actor, prev, m); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func scanLandMutations(row rowScanner) (*domain.LandMutations, error) {
	var m domain.LandMutations
	var data []byte
	err := row.Scan(&m.ID, &m.LandParcelID, &data, &m.ReadBy, &m.ConfirmedBy, &m.ConfirmedAt, &m.CreatedAt, &m.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	if err := json.Unmarshal(data, &m.Data); err != nil {
		return nil, err
	}
	return &m, nil
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
