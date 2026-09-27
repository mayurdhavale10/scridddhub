package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scridddhub/backend/internal/domain"
	"github.com/scridddhub/backend/internal/osm"
)

var _ osm.Cache = (*OSMPlaceCache)(nil)

// OSMPlaceCache implements osm.Cache over osm_place_cache (migration 000034).
type OSMPlaceCache struct {
	pool *pgxpool.Pool
}

func NewOSMPlaceCache(pool *pgxpool.Pool) *OSMPlaceCache {
	return &OSMPlaceCache{pool: pool}
}

type cachedPlace struct {
	OSMType  string       `json:"osm_type"`
	OSMID    int64        `json:"osm_id"`
	Name     string       `json:"name"`
	Kind     string       `json:"kind"`
	Category string       `json:"category"`
	Points   [][2]float64 `json:"points"` // [lat, lng]
}

func (c *OSMPlaceCache) Get(ctx context.Context, cell, group string) ([]domain.NearbyPlace, time.Time, bool, error) {
	var raw []byte
	var fetchedAt time.Time
	err := c.pool.QueryRow(ctx, `SELECT places, fetched_at FROM osm_place_cache WHERE cell = $1 AND query_group = $2`,
		cell, group).Scan(&raw, &fetchedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, time.Time{}, false, nil
	}
	if err != nil {
		return nil, time.Time{}, false, err
	}
	var cps []cachedPlace
	if err := json.Unmarshal(raw, &cps); err != nil {
		return nil, time.Time{}, false, err
	}
	places := make([]domain.NearbyPlace, 0, len(cps))
	for _, cp := range cps {
		p := domain.NearbyPlace{OSMType: cp.OSMType, OSMID: cp.OSMID, Name: cp.Name, Kind: cp.Kind, Category: cp.Category}
		for _, pt := range cp.Points {
			p.Points = append(p.Points, domain.GeoPoint{Latitude: pt[0], Longitude: pt[1]})
		}
		places = append(places, p)
	}
	return places, fetchedAt, true, nil
}

func (c *OSMPlaceCache) Put(ctx context.Context, cell, group string, places []domain.NearbyPlace) error {
	cps := make([]cachedPlace, 0, len(places))
	for _, p := range places {
		cp := cachedPlace{OSMType: p.OSMType, OSMID: p.OSMID, Name: p.Name, Kind: p.Kind, Category: p.Category}
		for _, pt := range p.Points {
			cp.Points = append(cp.Points, [2]float64{pt.Latitude, pt.Longitude})
		}
		cps = append(cps, cp)
	}
	raw, err := json.Marshal(cps)
	if err != nil {
		return err
	}
	_, err = c.pool.Exec(ctx, `
		INSERT INTO osm_place_cache (cell, query_group, places) VALUES ($1, $2, $3)
		ON CONFLICT (cell, query_group) DO UPDATE SET places = EXCLUDED.places, fetched_at = now()
	`, cell, group, raw)
	return err
}
