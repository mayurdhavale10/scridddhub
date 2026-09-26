package postgres

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scridddhub/backend/internal/domain"
)

type InfrastructureProjectRepository struct {
	pool *pgxpool.Pool
}

func NewInfrastructureProjectRepository(pool *pgxpool.Pool) *InfrastructureProjectRepository {
	return &InfrastructureProjectRepository{pool: pool}
}

// ListApproved returns every approved project with its served areas and located points. Pending
// (AI-drafted, unreviewed) and rejected projects are never returned. The list is small reference
// data, so matching happens in the domain layer rather than in SQL.
func (r *InfrastructureProjectRepository) ListApproved(ctx context.Context) ([]domain.InfrastructureProject, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, name, kind, status, COALESCE(expected_completion, ''), description,
		       source_name, source_url, verified_at, verified_by
		FROM infrastructure_projects
		WHERE review_status = 'approved'
		ORDER BY name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	projects := make([]domain.InfrastructureProject, 0)
	index := map[uuid.UUID]int{}
	for rows.Next() {
		var p domain.InfrastructureProject
		if err := rows.Scan(&p.ID, &p.Name, &p.Kind, &p.Status, &p.ExpectedCompletion, &p.Description,
			&p.SourceName, &p.SourceURL, &p.VerifiedAt, &p.VerifiedBy); err != nil {
			return nil, err
		}
		index[p.ID] = len(projects)
		projects = append(projects, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	areaRows, err := r.pool.Query(ctx, `
		SELECT project_id, district, taluka, note FROM infrastructure_project_areas
		ORDER BY district, taluka
	`)
	if err != nil {
		return nil, err
	}
	defer areaRows.Close()
	for areaRows.Next() {
		var id uuid.UUID
		var a domain.InfrastructureProjectArea
		if err := areaRows.Scan(&id, &a.District, &a.Taluka, &a.Note); err != nil {
			return nil, err
		}
		if i, ok := index[id]; ok {
			projects[i].Areas = append(projects[i].Areas, a)
		}
	}
	if err := areaRows.Err(); err != nil {
		return nil, err
	}

	pointRows, err := r.pool.Query(ctx, `
		SELECT project_id, label, kind, latitude, longitude, coord_source
		FROM infrastructure_project_points
		ORDER BY label
	`)
	if err != nil {
		return nil, err
	}
	defer pointRows.Close()
	for pointRows.Next() {
		var id uuid.UUID
		var pt domain.InfrastructurePoint
		if err := pointRows.Scan(&id, &pt.Label, &pt.Kind, &pt.Latitude, &pt.Longitude, &pt.CoordSource); err != nil {
			return nil, err
		}
		if i, ok := index[id]; ok {
			projects[i].Points = append(projects[i].Points, pt)
		}
	}
	return projects, pointRows.Err()
}
