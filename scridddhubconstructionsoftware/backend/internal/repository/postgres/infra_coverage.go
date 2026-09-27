package postgres

import (
	"context"
	"time"

	"github.com/scridddhub/backend/internal/infrapipeline"
	"github.com/scridddhub/backend/internal/usecase"
)

// Coverage methods (migration 000032) live on InfraPipelineStore: it implements both
// infrapipeline.CoverageStore (the searcher) and usecase.CoverageRecorder (the request path).
var (
	_ infrapipeline.CoverageStore = (*InfraPipelineStore)(nil)
	_ usecase.CoverageRecorder    = (*InfraPipelineStore)(nil)
)

// researchAfter: an area searched with nothing found is re-queued when someone asks again after
// this long — new projects get announced.
const researchAfter = 30 * 24 * time.Hour

// RequestCoverage records that someone looked up this area with nothing nearby on file. A new
// area is queued; a stale "searched" or a "failed" one is re-queued; otherwise only the request
// count moves. Returns the area's current state.
func (s *InfraPipelineStore) RequestCoverage(ctx context.Context, cell, place string, lat, lng float64) (usecase.CoverageStatus, error) {
	var st usecase.CoverageStatus
	err := s.pool.QueryRow(ctx, `
		INSERT INTO infrastructure_coverage (cell, place_name, center_lat, center_lng)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (cell) DO UPDATE SET
			requested_count = infrastructure_coverage.requested_count + 1,
			last_requested_at = now(),
			status = CASE
				WHEN infrastructure_coverage.status = 'failed' THEN 'queued'
				WHEN infrastructure_coverage.status = 'searched'
				     AND infrastructure_coverage.last_searched_at < now() - $5::interval THEN 'queued'
				ELSE infrastructure_coverage.status END
		RETURNING status, last_searched_at, projects_found
	`, cell, place, lat, lng, researchAfter.String()).Scan(&st.Status, &st.LastSearchedAt, &st.ProjectsFound)
	return st, err
}

func (s *InfraPipelineStore) NextQueuedAreas(ctx context.Context, limit int) ([]infrapipeline.CoverageArea, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT cell, place_name, center_lat, center_lng FROM infrastructure_coverage
		WHERE status = 'queued'
		-- most-asked-about first, then oldest
		ORDER BY requested_count DESC, first_requested_at
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []infrapipeline.CoverageArea
	for rows.Next() {
		var a infrapipeline.CoverageArea
		if err := rows.Scan(&a.Cell, &a.PlaceName, &a.Latitude, &a.Longitude); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func (s *InfraPipelineStore) MarkAreaSearching(ctx context.Context, cell string) error {
	_, err := s.pool.Exec(ctx, `UPDATE infrastructure_coverage SET status = 'searching' WHERE cell = $1`, cell)
	return err
}

func (s *InfraPipelineStore) FinishArea(ctx context.Context, cell, status string, sourcesFound, projectsFound int, errText string) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE infrastructure_coverage
		SET status = $2, last_searched_at = now(), sources_found = $3, projects_found = $4, last_error = NULLIF($5, '')
		WHERE cell = $1
	`, cell, status, sourcesFound, projectsFound, errText)
	return err
}

func (s *InfraPipelineStore) OfficialDomains(ctx context.Context) (map[string]string, error) {
	rows, err := s.pool.Query(ctx, `SELECT domain, agency FROM infrastructure_official_domains`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]string{}
	for rows.Next() {
		var d, a string
		if err := rows.Scan(&d, &a); err != nil {
			return nil, err
		}
		out[d] = a
	}
	return out, rows.Err()
}
