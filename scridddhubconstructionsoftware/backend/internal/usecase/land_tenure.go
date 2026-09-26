package usecase

import (
	"context"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
)

type LandTenureRepository interface {
	Upsert(ctx context.Context, actor string, tenure *domain.LandTenure) error
	GetByProject(ctx context.Context, projectID uuid.UUID) (*domain.LandTenure, error)
}

type LandTenureUsecase struct {
	repo LandTenureRepository
}

func NewLandTenureUsecase(repo LandTenureRepository) *LandTenureUsecase {
	return &LandTenureUsecase{repo: repo}
}

func (u *LandTenureUsecase) Upsert(ctx context.Context, actor string, tenure *domain.LandTenure) error {
	if err := tenure.Validate(); err != nil {
		return err
	}
	return u.repo.Upsert(ctx, actor, tenure)
}

func (u *LandTenureUsecase) GetByProject(ctx context.Context, projectID uuid.UUID) (*domain.LandTenure, error) {
	return u.repo.GetByProject(ctx, projectID)
}
