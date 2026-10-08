package postgres

import (
	"context"
	"fmt"
)

// Reviewer edits (infra_review set-status / add-point). Each records the official page and quote
// it rests on in infrastructure_review_evidence (migration 000038).

// ProjectSourceURLs returns the pages a project was extracted from: its primary source and every
// linked registry source. A reviewer-added point must be named on one of them.
func (s *InfraPipelineStore) ProjectSourceURLs(ctx context.Context, key string) ([]string, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT p.source_url FROM infrastructure_projects p WHERE p.canonical_key = $1
		UNION
		SELECT src.url FROM infrastructure_projects p
		JOIN infrastructure_project_sources ps ON ps.project_id = p.id
		JOIN infrastructure_sources src ON src.id = ps.source_id
		WHERE p.canonical_key = $1
	`, key)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var u string
		if err := rows.Scan(&u); err != nil {
			return nil, err
		}
		if u != "" {
			out = append(out, u)
		}
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("no project with key %q", key)
	}
	return out, rows.Err()
}

// SetStatusWithEvidence sets a project's status by hand, locks the field against pipeline runs,
// and records the page and quote it rests on.
func (s *InfraPipelineStore) SetStatusWithEvidence(ctx context.Context, key, status, sourceURL, quote, reviewer string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var id string
	err = tx.QueryRow(ctx, `
		UPDATE infrastructure_projects
		SET status = $2,
		    locked_fields = CASE WHEN 'status' = ANY(locked_fields) THEN locked_fields ELSE array_append(locked_fields, 'status') END,
		    updated_at = now()
		WHERE canonical_key = $1
		RETURNING id
	`, key, status).Scan(&id)
	if err != nil {
		return fmt.Errorf("setting status on %q: %w", key, err)
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO infrastructure_review_evidence (project_id, field, value, source_url, quote, reviewer)
		VALUES ($1, 'status', $2, $3, $4, $5)
	`, id, status, sourceURL, quote, reviewer); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// AddReviewedPoint adds a point a reviewer placed, as coord_source 'manual' (kept across pipeline
// runs), and records the page that names the place.
func (s *InfraPipelineStore) AddReviewedPoint(ctx context.Context, key, label, kind string, lat, lng float64, sourceURL, quote, reviewer string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var id string
	if err := tx.QueryRow(ctx, `SELECT id FROM infrastructure_projects WHERE canonical_key = $1`, key).Scan(&id); err != nil {
		return fmt.Errorf("no project with key %q: %w", key, err)
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO infrastructure_project_points (project_id, label, kind, latitude, longitude, coord_source)
		VALUES ($1, $2, $3, $4, $5, 'manual')
		ON CONFLICT (project_id, label) DO UPDATE
		SET kind = EXCLUDED.kind, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, coord_source = 'manual'
	`, id, label, kind, lat, lng); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO infrastructure_review_evidence (project_id, field, value, source_url, quote, reviewer)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, id, "point:"+label, fmt.Sprintf("%.5f,%.5f", lat, lng), sourceURL, quote, reviewer); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// ReviewEvidence returns what reviewers set by hand on a project, oldest first.
func (s *InfraPipelineStore) ReviewEvidence(ctx context.Context, key string) ([][4]string, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT e.field, e.value, e.quote, e.reviewer
		FROM infrastructure_review_evidence e JOIN infrastructure_projects p ON p.id = e.project_id
		WHERE p.canonical_key = $1 ORDER BY e.created_at
	`, key)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out [][4]string
	for rows.Next() {
		var r [4]string
		if err := rows.Scan(&r[0], &r[1], &r[2], &r[3]); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}
