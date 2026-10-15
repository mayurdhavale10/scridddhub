package postgres

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scridddhub/backend/internal/domain"
)

// LandRecordRepository stores a parcel's confirmed 7/12s (migrations 049, 053): one per survey
// number the parcel spans; saving the same survey number again replaces it. Every change is
// audited.
type LandRecordRepository struct {
	pool *pgxpool.Pool
}

func NewLandRecordRepository(pool *pgxpool.Pool) *LandRecordRepository {
	return &LandRecordRepository{pool: pool}
}

const landRecordCols = `id, land_parcel_id, data, COALESCE(read_by, ''), confirmed_by, confirmed_at, created_at, updated_at`

// ListByLandParcel returns the parcel's confirmed 7/12s (empty if none), in no particular order.
func (r *LandRecordRepository) ListByLandParcel(ctx context.Context, parcelID uuid.UUID) ([]domain.LandRecord, error) {
	rows, err := r.pool.Query(ctx, `SELECT `+landRecordCols+`, survey_key FROM land_records WHERE land_parcel_id = $1`, parcelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.LandRecord
	for rows.Next() {
		rec, err := scanLandRecordKeyed(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *rec)
	}
	return out, rows.Err()
}

func (r *LandRecordRepository) Upsert(ctx context.Context, actor string, rec *domain.LandRecord) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	before, err := scanLandRecordKeyed(tx.QueryRow(ctx, `SELECT `+landRecordCols+`, survey_key FROM land_records
		WHERE land_parcel_id = $1 AND survey_key = $2 FOR UPDATE`, rec.LandParcelID, rec.SurveyKey))
	if err != nil && err != domain.ErrNotFound {
		return err
	}
	data, err := json.Marshal(rec.Data)
	if err != nil {
		return err
	}
	row := tx.QueryRow(ctx, `
		INSERT INTO land_records (land_parcel_id, survey_key, data, read_by, confirmed_by, confirmed_at)
		VALUES ($1, $2, $3::jsonb, NULLIF($4, ''), $5, $6)
		ON CONFLICT (land_parcel_id, survey_key) DO UPDATE SET
			data = EXCLUDED.data, read_by = EXCLUDED.read_by, confirmed_by = EXCLUDED.confirmed_by,
			confirmed_at = EXCLUDED.confirmed_at, updated_at = now()
		RETURNING id, created_at, updated_at
	`, rec.LandParcelID, rec.SurveyKey, string(data), rec.ReadBy, rec.ConfirmedBy, rec.ConfirmedAt)
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

// Delete removes the 7/12 saved for one survey number of the parcel (e.g. saved on the wrong
// parcel). Audited; ErrNotFound if there's none.
func (r *LandRecordRepository) Delete(ctx context.Context, actor string, parcelID uuid.UUID, surveyKey string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	before, err := scanLandRecordKeyed(tx.QueryRow(ctx, `SELECT `+landRecordCols+`, survey_key FROM land_records
		WHERE land_parcel_id = $1 AND survey_key = $2 FOR UPDATE`, parcelID, surveyKey))
	if err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM land_records WHERE id = $1`, before.ID); err != nil {
		return err
	}
	if err := writeAudit(ctx, tx, "land_records", before.ID, "delete", actor, before, nil); err != nil {
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

func scanLandRecordKeyed(row rowScanner) (*domain.LandRecord, error) {
	var rec domain.LandRecord
	var data []byte
	err := row.Scan(&rec.ID, &rec.LandParcelID, &data, &rec.ReadBy, &rec.ConfirmedBy, &rec.ConfirmedAt, &rec.CreatedAt, &rec.UpdatedAt, &rec.SurveyKey)
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
