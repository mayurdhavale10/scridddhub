package postgres

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scridddhub/backend/internal/domain"
)

type LandParcelRepository struct {
	pool *pgxpool.Pool
}

func NewLandParcelRepository(pool *pgxpool.Pool) *LandParcelRepository {
	return &LandParcelRepository{pool: pool}
}

const landParcelSelectColumns = `
	id, project_id, name, COALESCE(location, ''), area_acres, cost_rupees, fsi, source, source_url,
	source_verified_at, district, taluka, village, closed_price_rupees, closed_at, stage,
	COALESCE(notes, ''), created_at, updated_at
`

func (r *LandParcelRepository) Create(ctx context.Context, actor string, parcel *domain.LandParcel) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	row := tx.QueryRow(ctx, `
		INSERT INTO land_parcels (project_id, name, location, area_acres, cost_rupees, fsi, source, source_url, district, taluka, village, stage, notes)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		RETURNING id, created_at, updated_at
	`, parcel.ProjectID, parcel.Name, parcel.Location, parcel.AreaAcres, parcel.CostRupees, parcel.FSI, parcel.Source, parcel.SourceURL, parcel.District, parcel.Taluka, parcel.Village, parcel.Stage, parcel.Notes)
	if err := row.Scan(&parcel.ID, &parcel.CreatedAt, &parcel.UpdatedAt); err != nil {
		return err
	}

	if err := writeAudit(ctx, tx, "land_parcels", parcel.ID, "insert", actor, nil, parcel); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *LandParcelRepository) Get(ctx context.Context, id uuid.UUID) (*domain.LandParcel, error) {
	row := r.pool.QueryRow(ctx, `SELECT `+landParcelSelectColumns+` FROM land_parcels WHERE id = $1`, id)
	return scanLandParcel(row)
}

func (r *LandParcelRepository) ListByProject(ctx context.Context, projectID uuid.UUID) ([]*domain.LandParcel, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT `+landParcelSelectColumns+`
		FROM land_parcels
		WHERE project_id = $1
		ORDER BY created_at DESC
	`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var parcels []*domain.LandParcel
	for rows.Next() {
		parcel, err := scanLandParcel(rows)
		if err != nil {
			return nil, err
		}
		parcels = append(parcels, parcel)
	}
	return parcels, rows.Err()
}

func (r *LandParcelRepository) UpdateStage(ctx context.Context, actor string, id uuid.UUID, stage domain.LandParcelStage) (*domain.LandParcel, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	before, err := scanLandParcel(tx.QueryRow(ctx, `SELECT `+landParcelSelectColumns+` FROM land_parcels WHERE id = $1 FOR UPDATE`, id))
	if err != nil {
		return nil, err
	}

	after := *before
	after.Stage = stage

	row := tx.QueryRow(ctx, `
		UPDATE land_parcels
		SET stage = $1, updated_at = now()
		WHERE id = $2
		RETURNING updated_at
	`, stage, id)
	if err := row.Scan(&after.UpdatedAt); err != nil {
		return nil, err
	}

	if err := writeAudit(ctx, tx, "land_parcels", id, "update", actor, before, &after); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &after, nil
}

func (r *LandParcelRepository) UpdateSourceVerifiedAt(ctx context.Context, actor string, id uuid.UUID, verifiedAt time.Time) (*domain.LandParcel, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	before, err := scanLandParcel(tx.QueryRow(ctx, `SELECT `+landParcelSelectColumns+` FROM land_parcels WHERE id = $1 FOR UPDATE`, id))
	if err != nil {
		return nil, err
	}

	after := *before
	after.SourceVerifiedAt = &verifiedAt

	row := tx.QueryRow(ctx, `
		UPDATE land_parcels
		SET source_verified_at = $1, updated_at = now()
		WHERE id = $2
		RETURNING updated_at
	`, verifiedAt, id)
	if err := row.Scan(&after.UpdatedAt); err != nil {
		return nil, err
	}

	if err := writeAudit(ctx, tx, "land_parcels", id, "update", actor, before, &after); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &after, nil
}

// RecordClosedPrice sets the real, final transacted price once a deal actually closes — a
// separate event from the original asking price (see docs/adr/0005). closedPriceRupees must
// already be validated positive by the caller.
func (r *LandParcelRepository) RecordClosedPrice(ctx context.Context, actor string, id uuid.UUID, closedPriceRupees int64, closedAt time.Time) (*domain.LandParcel, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	before, err := scanLandParcel(tx.QueryRow(ctx, `SELECT `+landParcelSelectColumns+` FROM land_parcels WHERE id = $1 FOR UPDATE`, id))
	if err != nil {
		return nil, err
	}

	after := *before
	after.ClosedPriceRupees = &closedPriceRupees
	after.ClosedAt = &closedAt

	row := tx.QueryRow(ctx, `
		UPDATE land_parcels
		SET closed_price_rupees = $1, closed_at = $2, updated_at = now()
		WHERE id = $3
		RETURNING updated_at
	`, closedPriceRupees, closedAt, id)
	if err := row.Scan(&after.UpdatedAt); err != nil {
		return nil, err
	}

	if err := writeAudit(ctx, tx, "land_parcels", id, "update", actor, before, &after); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &after, nil
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanLandParcel(row rowScanner) (*domain.LandParcel, error) {
	var p domain.LandParcel
	err := row.Scan(&p.ID, &p.ProjectID, &p.Name, &p.Location, &p.AreaAcres, &p.CostRupees, &p.FSI,
		&p.Source, &p.SourceURL, &p.SourceVerifiedAt, &p.District, &p.Taluka, &p.Village,
		&p.ClosedPriceRupees, &p.ClosedAt, &p.Stage, &p.Notes, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &p, nil
}
