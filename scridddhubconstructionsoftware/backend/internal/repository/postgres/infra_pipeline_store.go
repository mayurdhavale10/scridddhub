package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scridddhub/backend/internal/infrapipeline"
)

// InfraPipelineStore implements infrapipeline.Store over the tables from migrations 000028–000031.
type InfraPipelineStore struct {
	pool *pgxpool.Pool
}

var _ infrapipeline.Store = (*InfraPipelineStore)(nil)

func NewInfraPipelineStore(pool *pgxpool.Pool) *InfraPipelineStore {
	return &InfraPipelineStore{pool: pool}
}

// pipelineVerifiedBy is recorded on rows the pipeline writes (internal provenance, not shown in the UI).
const pipelineVerifiedBy = "infra-pipeline v1 (evidence-checked)"

func (s *InfraPipelineStore) ListEnabledSources(ctx context.Context, agency string) ([]infrapipeline.Source, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, agency, url, kind, enabled, robots_status, COALESCE(last_content_hash, ''), COALESCE(project_hint, '')
		FROM infrastructure_sources
		WHERE enabled AND robots_status <> 'disallowed' AND ($1 = '' OR lower(agency) = lower($1))
		-- Hand-seeded rows first (index/project pages before geodata), then discovered ones.
		ORDER BY discovered_from IS NOT NULL, CASE kind WHEN 'project_index' THEN 0 WHEN 'project_page' THEN 1 ELSE 2 END, created_at
	`, agency)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []infrapipeline.Source
	for rows.Next() {
		var src infrapipeline.Source
		var kind, robots string
		if err := rows.Scan(&src.ID, &src.Agency, &src.URL, &kind, &src.Enabled, &robots, &src.LastContentHash, &src.ProjectHint); err != nil {
			return nil, err
		}
		src.Kind, src.RobotsStatus = infrapipeline.SourceKind(kind), infrapipeline.RobotsStatus(robots)
		out = append(out, src)
	}
	return out, rows.Err()
}

func (s *InfraPipelineStore) AddDiscoveredSources(ctx context.Context, from uuid.UUID, agency string, found []infrapipeline.DiscoveredSource) (int, error) {
	added := 0
	for _, d := range found {
		tag, err := s.pool.Exec(ctx, `
			INSERT INTO infrastructure_sources (agency, url, kind, discovered_from)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (url) DO NOTHING
		`, agency, d.URL, string(d.Kind), from)
		if err != nil {
			return added, err
		}
		added += int(tag.RowsAffected())
	}
	return added, nil
}

func (s *InfraPipelineStore) StartRun(ctx context.Context, trigger infrapipeline.RunTrigger, params map[string]any) (uuid.UUID, error) {
	p, err := json.Marshal(params)
	if err != nil {
		return uuid.Nil, err
	}
	var id uuid.UUID
	err = s.pool.QueryRow(ctx, `
		INSERT INTO infrastructure_pipeline_runs (trigger, params) VALUES ($1, $2) RETURNING id
	`, string(trigger), p).Scan(&id)
	return id, err
}

func (s *InfraPipelineStore) FinishRun(ctx context.Context, runID uuid.UUID, stats infrapipeline.RunStats, runErr error) error {
	st, err := json.Marshal(stats)
	if err != nil {
		return err
	}
	var errText *string
	if runErr != nil {
		e := runErr.Error()
		errText = &e
	}
	_, err = s.pool.Exec(ctx, `
		UPDATE infrastructure_pipeline_runs SET finished_at = now(), stats = $2, error = $3 WHERE id = $1
	`, runID, st, errText)
	return err
}

func (s *InfraPipelineStore) SaveFetch(ctx context.Context, runID uuid.UUID, src infrapipeline.Source, res infrapipeline.FetchResult) (uuid.UUID, error) {
	var run *uuid.UUID
	if runID != uuid.Nil {
		run = &runID
	}
	var id uuid.UUID
	err := s.pool.QueryRow(ctx, `
		INSERT INTO infrastructure_fetches
			(source_id, run_id, final_url, http_status, status, detail, content_type, content_hash, content_text, fetched_at)
		VALUES ($1, $2, $3, NULLIF($4, 0), $5, NULLIF($6, ''), NULLIF($7, ''), NULLIF($8, ''), NULLIF($9, ''), $10)
		RETURNING id
	`, src.ID, run, res.FinalURL, res.HTTPStatus, string(res.Status), res.Detail, res.ContentType, res.ContentHash, res.Text, res.FetchedAt).Scan(&id)
	if err != nil {
		return uuid.Nil, err
	}
	// Only a successful fetch updates the stored hash; blocked/error keep the last good one.
	_, err = s.pool.Exec(ctx, `
		UPDATE infrastructure_sources
		SET last_fetched_at = $2, last_status = $3,
		    last_content_hash = CASE WHEN $3 = 'ok' THEN NULLIF($4, '') ELSE last_content_hash END,
		    robots_status = CASE WHEN $5 THEN 'disallowed' WHEN $3 = 'ok' THEN 'allowed' ELSE robots_status END,
		    updated_at = now()
		WHERE id = $1
	`, src.ID, res.FetchedAt, string(res.Status), res.ContentHash, res.Detail == "disallowed by robots.txt")
	return id, err
}

func (s *InfraPipelineStore) MarkUnchanged(ctx context.Context, sourceID uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE infrastructure_sources SET last_fetched_at = now(), last_status = 'unchanged', updated_at = now() WHERE id = $1
	`, sourceID)
	return err
}

func (s *InfraPipelineStore) UpsertProject(ctx context.Context, cp infrapipeline.CanonicalProject) (bool, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer tx.Rollback(ctx)

	var (
		id      uuid.UUID
		locked  []string
		review  string
		exists  = true
		p       = cp.Project.Project
		_, name = cp.Project.FieldEvidence["name"]
	)
	err = tx.QueryRow(ctx, `
		SELECT id, locked_fields, review_status FROM infrastructure_projects WHERE canonical_key = $1 FOR UPDATE
	`, cp.Key).Scan(&id, &locked, &review)
	if errors.Is(err, pgx.ErrNoRows) {
		exists = false
	} else if err != nil {
		return false, err
	}

	if !exists && !name {
		return false, nil // never create a project without a verified name
	}

	status := "unknown"
	if p.Status.Value != nil {
		status = *p.Status.Value
	}
	var completion *string
	if p.ExpectedCompletion.Value != nil {
		completion = p.ExpectedCompletion.Value
	}
	kind := p.Kind
	if kind == "" {
		kind = "other"
	}
	primary := primarySource(cp.Sources)
	sourceName := cp.Agency + " — official project page"
	description := composeDescription(p)
	reviewStatus := string(cp.Review)

	if !exists {
		err = tx.QueryRow(ctx, `
			INSERT INTO infrastructure_projects
				(name, kind, status, expected_completion, description, source_name, source_url,
				 verified_at, verified_by, review_status, agency, canonical_key)
			VALUES ($1, $2, $3, $4, $5, $6, $7, now(), $8, $9, $10, $11)
			RETURNING id
		`, p.Name, kind, status, completion, description, sourceName, primary, pipelineVerifiedBy,
			reviewStatus, cp.Agency, cp.Key).Scan(&id)
		if err != nil {
			return false, fmt.Errorf("inserting project: %w", err)
		}
	} else {
		// Build the update from verified values only, skipping locked fields; never erase a known
		// value just because this run didn't find it, never downgrade approved -> pending.
		sets := []string{"verified_at = now()", "verified_by = $2", "updated_at = now()", "agency = COALESCE(agency, $3)"}
		args := []any{id, pipelineVerifiedBy, cp.Agency}
		add := func(field, expr string, v any) {
			if slices.Contains(locked, field) {
				return
			}
			args = append(args, v)
			sets = append(sets, fmt.Sprintf(expr, len(args)))
		}
		if name {
			add("name", "name = $%d", p.Name)
			add("kind", "kind = $%d", kind)
			add("source_name", "source_name = $%d", sourceName)
			if primary != "" {
				add("source_url", "source_url = $%d", primary)
			}
		}
		if p.Status.Value != nil {
			add("status", "status = $%d", status)
		}
		if completion != nil {
			add("expected_completion", "expected_completion = $%d", *completion)
		}
		if description != "" {
			add("description", "description = $%d", description)
		}
		if review != string(infrapipeline.ReviewApproved) && review != "rejected" {
			add("review_status", "review_status = $%d", reviewStatus)
		}
		if _, err := tx.Exec(ctx, "UPDATE infrastructure_projects SET "+strings.Join(sets, ", ")+" WHERE id = $1", args...); err != nil {
			return false, fmt.Errorf("updating project: %w", err)
		}
	}

	// Points: replace the pipeline-managed ones only when this run produced some; keep points a
	// person placed by hand ('manual'). On an APPROVED project only official-file points may
	// replace existing ones — an unreviewed geocoded guess must never go live under an existing
	// approval (2026-09-27: a geocode put Metro Line 12's "Kalyan" in Chembur and hid it from
	// Kalyan parcels). Approximate points only land on pending projects, which a person reviews.
	if len(cp.Points) > 0 && (review != string(infrapipeline.ReviewApproved) || allOfficial(cp.Points)) {
		if _, err := tx.Exec(ctx, `DELETE FROM infrastructure_project_points WHERE project_id = $1 AND coord_source <> 'manual'`, id); err != nil {
			return false, err
		}
		for _, pt := range cp.Points {
			if _, err := tx.Exec(ctx, `
				INSERT INTO infrastructure_project_points (project_id, label, kind, latitude, longitude, coord_source)
				VALUES ($1, $2, $3, $4, $5, $6)
				ON CONFLICT (project_id, label) DO NOTHING
			`, id, pt.Label, string(pt.Kind), pt.Latitude, pt.Longitude, string(pt.CoordSource)); err != nil {
				return false, fmt.Errorf("inserting point %q: %w", pt.Label, err)
			}
		}
	}

	for _, ref := range cp.Sources {
		if ref.SourceID == uuid.Nil {
			continue // discovered during this run; linked on the next run once it has a registry id
		}
		ev, _ := json.Marshal(ref.FieldEvidence)
		var fetch *uuid.UUID
		if ref.FetchID != uuid.Nil {
			f := ref.FetchID
			fetch = &f
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO infrastructure_project_sources (project_id, source_id, fetch_id, verified_fields)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (project_id, source_id) DO UPDATE
			SET fetch_id = EXCLUDED.fetch_id, verified_fields = EXCLUDED.verified_fields, updated_at = now()
		`, id, ref.SourceID, fetch, ev); err != nil {
			return false, fmt.Errorf("linking source: %w", err)
		}
	}
	return true, tx.Commit(ctx)
}

// PendingProject is one project awaiting review, with what a reviewer needs to judge it.
type PendingProject struct {
	Key                string
	Name               string
	Status             string
	ExpectedCompletion string
	Description        string
	SourceURL          string
	OfficialPoints     int
	ApproxPoints       int
	Evidence           map[string]string // field -> verified quote, merged across sources
}

// ListByReview returns projects in the given review status (e.g. "pending"), oldest first.
func (s *InfraPipelineStore) ListByReview(ctx context.Context, status string) ([]PendingProject, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT p.canonical_key, p.name, p.status, COALESCE(p.expected_completion, ''), p.description, p.source_url,
		       (SELECT count(*) FROM infrastructure_project_points pt WHERE pt.project_id = p.id AND pt.coord_source = 'official_file'),
		       (SELECT count(*) FROM infrastructure_project_points pt WHERE pt.project_id = p.id AND pt.coord_source = 'approximate'),
		       COALESCE((SELECT jsonb_object_agg(k, v) FROM infrastructure_project_sources ps, jsonb_each_text(ps.verified_fields) AS e(k, v)
		                 WHERE ps.project_id = p.id), '{}')
		FROM infrastructure_projects p
		WHERE p.review_status = $1 AND p.canonical_key IS NOT NULL
		ORDER BY p.created_at
	`, status)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []PendingProject
	for rows.Next() {
		var p PendingProject
		var ev []byte
		if err := rows.Scan(&p.Key, &p.Name, &p.Status, &p.ExpectedCompletion, &p.Description, &p.SourceURL,
			&p.OfficialPoints, &p.ApproxPoints, &ev); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(ev, &p.Evidence)
		out = append(out, p)
	}
	return out, rows.Err()
}

// SetReview approves or rejects a project by key, recording who reviewed it and when (internal
// provenance — verified_by is never shown in the app).
func (s *InfraPipelineStore) SetReview(ctx context.Context, key, status, reviewer string) error {
	if status != "approved" && status != "rejected" && status != "pending" {
		return fmt.Errorf("review status must be approved, rejected or pending, got %q", status)
	}
	tag, err := s.pool.Exec(ctx, `
		UPDATE infrastructure_projects
		SET review_status = $2, verified_by = $3, verified_at = now(), updated_at = now()
		WHERE canonical_key = $1
	`, key, status, reviewer)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("no project with key %q", key)
	}
	return nil
}

func allOfficial(pts []infrapipeline.LocatedPoint) bool {
	for _, p := range pts {
		if p.CoordSource != infrapipeline.CoordOfficialFile {
			return false
		}
	}
	return true
}

// primarySource prefers the first page source (facts) over a geodata file for the "source" link.
func primarySource(refs []infrapipeline.ProjectSourceRef) string {
	for _, r := range refs {
		if _, isGeo := r.FieldEvidence["points"]; !isGeo && r.SourceURL != "" {
			return r.SourceURL
		}
	}
	if len(refs) > 0 {
		return refs[0].SourceURL
	}
	return ""
}

// composeDescription builds a neutral summary from verified fields only.
func composeDescription(p infrapipeline.ExtractedProject) string {
	var parts []string
	if p.LengthKm.Value != nil {
		parts = append(parts, strconv.FormatFloat(*p.LengthKm.Value, 'f', -1, 64)+" km")
	}
	if len(p.Stations) > 0 {
		parts = append(parts, "stations include "+joinPlaces(p.Stations, 8))
	}
	if len(p.Localities) > 0 {
		parts = append(parts, "via "+joinPlaces(p.Localities, 8))
	}
	if len(parts) == 0 {
		return ""
	}
	d := strings.Join(parts, "; ")
	return strings.ToUpper(d[:1]) + d[1:] + "."
}

func joinPlaces(ps []infrapipeline.NamedPlace, max int) string {
	names := make([]string, 0, len(ps))
	for i, p := range ps {
		if i == max {
			names = append(names, fmt.Sprintf("and %d more", len(ps)-max))
			break
		}
		names = append(names, p.Name)
	}
	return strings.Join(names, ", ")
}
