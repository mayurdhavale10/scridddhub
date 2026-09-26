package usecase

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
)

type ProjectRepository interface {
	Create(ctx context.Context, actor string, project *domain.Project) error
	Get(ctx context.Context, id uuid.UUID) (*domain.Project, error)
}

type ProjectUsecase struct {
	repo ProjectRepository
}

func NewProjectUsecase(repo ProjectRepository) *ProjectUsecase {
	return &ProjectUsecase{repo: repo}
}

func (u *ProjectUsecase) Create(ctx context.Context, actor string, project *domain.Project) error {
	if project.Name == "" {
		return fmt.Errorf("name is required")
	}
	if project.OrgID == uuid.Nil {
		return fmt.Errorf("org_id is required")
	}
	return u.repo.Create(ctx, actor, project)
}

func (u *ProjectUsecase) Get(ctx context.Context, id uuid.UUID) (*domain.Project, error) {
	return u.repo.Get(ctx, id)
}
