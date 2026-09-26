package postgres

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scridddhub/backend/internal/domain"
	"github.com/scridddhub/backend/internal/usecase"
)

type GeocodeCacheRepository struct {
	pool *pgxpool.Pool
}

func NewGeocodeCacheRepository(pool *pgxpool.Pool) *GeocodeCacheRepository {
	return &GeocodeCacheRepository{pool: pool}
}

func (r *GeocodeCacheRepository) Get(ctx context.Context, query string) (*usecase.GeocodeResult, error) {
	var (
		res            usecase.GeocodeResult
		lat, lng       *float64
		display, match *string
	)
	err := r.pool.QueryRow(ctx, `
		SELECT found, latitude, longitude, display_name, matched_query FROM geocode_cache WHERE query = $1
	`, query).Scan(&res.Found, &lat, &lng, &display, &match)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if lat != nil && lng != nil {
		res.Point = domain.GeoPoint{Latitude: *lat, Longitude: *lng}
	}
	if display != nil {
		res.DisplayName = *display
	}
	if match != nil {
		res.MatchedQuery = *match
	}
	return &res, nil
}

func (r *GeocodeCacheRepository) Put(ctx context.Context, query string, res usecase.GeocodeResult, provider string) error {
	var lat, lng *float64
	var display, match *string
	if res.Found {
		lat, lng = &res.Point.Latitude, &res.Point.Longitude
		display, match = &res.DisplayName, &res.MatchedQuery
	}
	_, err := r.pool.Exec(ctx, `
		INSERT INTO geocode_cache (query, found, latitude, longitude, display_name, matched_query, provider)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (query) DO UPDATE SET
			found = EXCLUDED.found, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
			display_name = EXCLUDED.display_name, matched_query = EXCLUDED.matched_query,
			provider = EXCLUDED.provider, fetched_at = now()
	`, query, res.Found, lat, lng, display, match, provider)
	return err
}
