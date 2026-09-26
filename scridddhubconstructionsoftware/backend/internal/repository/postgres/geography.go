package postgres

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scridddhub/backend/internal/domain"
)

// GeographyRepository serves Maharashtra's real, complete administrative geography (docs/adr/0006)
// — 36 districts, 358 talukas, 44,918 villages, sourced from the government's own public Common
// Village Master API, not from whatever villages happen to have a Ready Reckoner rate on file.
// Read-only: this data is seeded once (backend/cmd/seed_mh_geography), never written by the app.
type GeographyRepository struct {
	pool *pgxpool.Pool
}

func NewGeographyRepository(pool *pgxpool.Pool) *GeographyRepository {
	return &GeographyRepository{pool: pool}
}

func (r *GeographyRepository) ListDistricts(ctx context.Context) ([]string, error) {
	rows, err := r.pool.Query(ctx, `SELECT name FROM mh_districts ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanStrings(rows)
}

func (r *GeographyRepository) ListTalukas(ctx context.Context, district string) ([]string, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT t.name
		FROM mh_talukas t
		JOIN mh_districts d ON d.code = t.district_code
		WHERE d.name = $1
		ORDER BY t.name
	`, district)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanStrings(rows)
}

func (r *GeographyRepository) ListVillages(ctx context.Context, district, taluka string) ([]string, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT v.name
		FROM mh_villages v
		JOIN mh_talukas t ON t.district_code = v.district_code AND t.code = v.taluka_code
		JOIN mh_districts d ON d.code = v.district_code
		WHERE d.name = $1 AND t.name = $2
		ORDER BY v.name
	`, district, taluka)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanStrings(rows)
}

// SearchVillages powers free-text location entry (no district/taluka picking required) — returns
// each hit with its full district/taluka/village context, since that's what
// EstimateParcelValueUsecase needs. Capped at 20: a short/common prefix can match hundreds of
// villages across Maharashtra's real 44,918-village set, and this is autocomplete, not a browse
// list.
//
// Ranks exact prefix matches first, then falls back to pg_trgm similarity — real users type
// colloquial spellings (e.g. "Khadakpada") that differ from the government's canonical spelling
// (e.g. "Kakadpada"); a prefix-only match misses these entirely (confirmed live, 2026-09-21).
func (r *GeographyRepository) SearchVillages(ctx context.Context, query string) ([]domain.VillageMatch, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT d.name, t.name, v.name
		FROM mh_villages v
		JOIN mh_talukas t ON t.district_code = v.district_code AND t.code = v.taluka_code
		JOIN mh_districts d ON d.code = v.district_code
		WHERE v.name ILIKE $1 || '%' OR v.name % $1
		ORDER BY similarity(v.name, $1) DESC, v.name
		LIMIT 20
	`, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var matches []domain.VillageMatch
	for rows.Next() {
		var m domain.VillageMatch
		if err := rows.Scan(&m.District, &m.Taluka, &m.Village); err != nil {
			return nil, err
		}
		matches = append(matches, m)
	}
	return matches, rows.Err()
}
