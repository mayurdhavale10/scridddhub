package postgres

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scridddhub/backend/internal/domain"
)

type ReadyReckonerRateRepository struct {
	pool *pgxpool.Pool
}

func NewReadyReckonerRateRepository(pool *pgxpool.Pool) *ReadyReckonerRateRepository {
	return &ReadyReckonerRateRepository{pool: pool}
}

// Get returns the most recently effective rate on file for this exact district/taluka/village.
// Does not disambiguate by zone — v1 scope is villages without a per-zone rate split (see
// services/estimatedparcelvalue/README.md's open questions).
func (r *ReadyReckonerRateRepository) Get(ctx context.Context, district, taluka, village string) (*domain.ReadyReckonerRate, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT id, district, taluka, village, zone_no, rate_per_sqm_rupees, effective_year,
		       source_url, verified_at, verified_by, COALESCE(note, ''), created_at, updated_at
		FROM ready_reckoner_rates
		WHERE district = $1 AND taluka = $2 AND village = $3
		ORDER BY effective_year DESC
		LIMIT 1
	`, district, taluka, village)

	var rate domain.ReadyReckonerRate
	err := row.Scan(&rate.ID, &rate.District, &rate.Taluka, &rate.Village, &rate.ZoneNo,
		&rate.RatePerSqmRupees, &rate.EffectiveYear, &rate.SourceURL, &rate.VerifiedAt,
		&rate.VerifiedBy, &rate.Note, &rate.CreatedAt, &rate.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &rate, nil
}

// The old ListDistricts/ListTalukas/ListVillages (DISTINCT over ready_reckoner_rates — only ever
// showed the handful of villages we'd manually seeded a rate for) were removed 2026-09-20 per
// docs/adr/0006 — see GeographyRepository (geography.go) for their replacement, backed by the
// real, complete Maharashtra government village directory (44,918 villages), decoupled from
// which villages happen to have a rate on file.

func scanStrings(rows pgx.Rows) ([]string, error) {
	values := make([]string, 0)
	for rows.Next() {
		var v string
		if err := rows.Scan(&v); err != nil {
			return nil, err
		}
		values = append(values, v)
	}
	return values, rows.Err()
}
