package postgres

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scridddhub/backend/internal/domain"
)

type ProjectRepository struct {
	pool *pgxpool.Pool
}

func NewProjectRepository(pool *pgxpool.Pool) *ProjectRepository {
	return &ProjectRepository{pool: pool}
}

func (r *ProjectRepository) Create(ctx context.Context, actor string, project *domain.Project) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	row := tx.QueryRow(ctx, `
		INSERT INTO projects (org_id, name, city)
		VALUES ($1, $2, $3)
		RETURNING id, created_at, updated_at
	`, project.OrgID, project.Name, project.City)
	if err := row.Scan(&project.ID, &project.CreatedAt, &project.UpdatedAt); err != nil {
		return err
	}

	if err := writeAudit(ctx, tx, "projects", project.ID, "insert", actor, nil, project); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *ProjectRepository) Get(ctx context.Context, id uuid.UUID) (*domain.Project, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT id, org_id, name, COALESCE(city, ''), created_at, updated_at
		FROM projects
		WHERE id = $1
	`, id)

	var p domain.Project
	if err := row.Scan(&p.ID, &p.OrgID, &p.Name, &p.City, &p.CreatedAt, &p.UpdatedAt); err != nil {
		if err == pgx.ErrNoRows {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &p, nil
}
