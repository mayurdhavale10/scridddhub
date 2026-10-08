package postgres

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scridddhub/backend/internal/domain"
)

// RERARepository stores public MahaRERA records (migration 043).
type RERARepository struct {
	pool *pgxpool.Pool
}

func NewRERARepository(pool *pgxpool.Pool) *RERARepository {
	return &RERARepository{pool: pool}
}

func (r *RERARepository) UpsertProjects(ctx context.Context, projects []domain.RERAProject) error {
	batch := &pgx.Batch{}
	for _, p := range projects {
		batch.Queue(`
			INSERT INTO rera_projects (
				registration_number, project_name, promoter_name, promoter_name_norm,
				location, pincode, district, last_modified, has_extension, details_url, fetched_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
			ON CONFLICT (registration_number) DO UPDATE SET
				project_name = EXCLUDED.project_name,
				promoter_name = EXCLUDED.promoter_name,
				promoter_name_norm = EXCLUDED.promoter_name_norm,
				location = EXCLUDED.location,
				pincode = EXCLUDED.pincode,
				district = EXCLUDED.district,
				last_modified = EXCLUDED.last_modified,
				has_extension = EXCLUDED.has_extension,
				details_url = EXCLUDED.details_url,
				fetched_at = EXCLUDED.fetched_at
		`, p.RegistrationNumber, p.ProjectName, p.PromoterName, domain.NormalizePromoterName(p.PromoterName),
			p.Location, p.Pincode, p.District, p.LastModified, p.HasExtension, p.DetailsURL, p.FetchedAt)
	}
	return r.pool.SendBatch(ctx, batch).Close()
}

func (r *RERARepository) UpsertComplaints(ctx context.Context, rows []domain.RERAPromoterComplaints) error {
	batch := &pgx.Batch{}
	for _, c := range rows {
		batch.Queue(`
			INSERT INTO rera_promoter_complaints (promoter_name, promoter_name_norm, complaints, view_url, fetched_at)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (view_url) DO UPDATE SET
				promoter_name = EXCLUDED.promoter_name,
				promoter_name_norm = EXCLUDED.promoter_name_norm,
				complaints = EXCLUDED.complaints,
				fetched_at = EXCLUDED.fetched_at
		`, c.PromoterName, domain.NormalizePromoterName(c.PromoterName), c.Complaints, c.ViewURL, c.FetchedAt)
	}
	return r.pool.SendBatch(ctx, batch).Close()
}

// SearchPromoters finds promoter names matching typed text: exact normalized prefix first,
// then contains, then trigram-similar, most projects first.
func (r *RERARepository) SearchPromoters(ctx context.Context, query string, limit int) ([]domain.RERAPromoterMatch, error) {
	norm := domain.NormalizePromoterName(query)
	if norm == "" {
		return nil, nil
	}
	rows, err := r.pool.Query(ctx, `
		SELECT promoter_name_norm, MIN(promoter_name) AS name, COUNT(*) AS projects,
		       CASE WHEN promoter_name_norm LIKE $1 || '%' THEN 0
		            WHEN promoter_name_norm LIKE '%' || $1 || '%' THEN 1
		            ELSE 2 END AS rank
		FROM rera_projects
		WHERE promoter_name_norm LIKE '%' || $1 || '%' OR promoter_name_norm % $1
		GROUP BY promoter_name_norm
		ORDER BY rank, projects DESC, promoter_name_norm
		LIMIT $2
	`, norm, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.RERAPromoterMatch
	for rows.Next() {
		var m domain.RERAPromoterMatch
		var normName string
		var rank int
		if err := rows.Scan(&normName, &m.PromoterName, &m.Projects, &rank); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

// History returns every collected project and the complaint count for one promoter, matched
// on the normalized name.
func (r *RERARepository) History(ctx context.Context, promoterName string) (*domain.RERASellerHistory, error) {
	norm := domain.NormalizePromoterName(promoterName)
	h := &domain.RERASellerHistory{PromoterName: promoterName}

	rows, err := r.pool.Query(ctx, `
		SELECT registration_number, project_name, promoter_name, COALESCE(location, ''),
		       COALESCE(pincode, ''), COALESCE(district, ''), last_modified, has_extension,
		       COALESCE(details_url, ''), fetched_at
		FROM rera_projects
		WHERE promoter_name_norm = $1
		ORDER BY registration_number
	`, norm)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var p domain.RERAProject
		if err := rows.Scan(&p.RegistrationNumber, &p.ProjectName, &p.PromoterName, &p.Location,
			&p.Pincode, &p.District, &p.LastModified, &p.HasExtension, &p.DetailsURL, &p.FetchedAt); err != nil {
			return nil, err
		}
		if p.HasExtension {
			h.WithExtension++
		}
		if h.ProjectsAsOf == nil || p.FetchedAt.Before(*h.ProjectsAsOf) {
			t := p.FetchedAt
			h.ProjectsAsOf = &t
		}
		h.Projects = append(h.Projects, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(h.Projects) > 0 {
		h.PromoterName = h.Projects[0].PromoterName
	}

	stateDone, err := r.completedAt(ctx, "projects_state")
	if err != nil {
		return nil, err
	}
	h.ProjectsComplete = stateDone != nil

	// Complaints are only claimed after a complete run of the complaint list.
	collectedAt, err := r.completedAt(ctx, "complaints")
	if err != nil {
		return nil, err
	}
	if collectedAt != nil {
		var total int
		if err := r.pool.QueryRow(ctx, `
			SELECT COALESCE(SUM(complaints), 0) FROM rera_promoter_complaints WHERE promoter_name_norm = $1
		`, norm).Scan(&total); err != nil {
			return nil, err
		}
		h.Complaints = &total
		h.ComplaintsAsOf = collectedAt
	}
	return h, nil
}

func (r *RERARepository) completedAt(ctx context.Context, kind string) (*time.Time, error) {
	var t *time.Time
	err := r.pool.QueryRow(ctx, `SELECT completed_at FROM rera_collection_runs WHERE kind = $1`, kind).Scan(&t)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return t, err
}

// KnownPincodes lists pincodes already seen in collected projects.
func (r *RERARepository) KnownPincodes(ctx context.Context) ([]string, error) {
	rows, err := r.pool.Query(ctx, `SELECT DISTINCT pincode FROM rera_projects WHERE pincode ~ '^[0-9]{6}$' ORDER BY 1`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var p string
		if err := rows.Scan(&p); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *RERARepository) CountByPincode(ctx context.Context, pincode string) (int, error) {
	var n int
	err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM rera_projects WHERE pincode = $1`, pincode).Scan(&n)
	return n, err
}

func (r *RERARepository) ProjectCount(ctx context.Context) (int, error) {
	var n int
	err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM rera_projects`).Scan(&n)
	return n, err
}

// MarkComplete records that a collection ran over every page without gaps.
func (r *RERARepository) MarkComplete(ctx context.Context, kind string, at time.Time) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO rera_collection_runs (kind, completed_at) VALUES ($1, $2)
		ON CONFLICT (kind) DO UPDATE SET completed_at = EXCLUDED.completed_at
	`, kind, at)
	return err
}
