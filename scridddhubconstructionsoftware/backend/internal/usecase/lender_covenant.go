package usecase

import (
	"context"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
)

type LenderCovenantRepository interface {
	Upsert(ctx context.Context, actor string, covenant *domain.LenderCovenant) error
	GetByProject(ctx context.Context, projectID uuid.UUID) (*domain.LenderCovenant, error)
}

type LenderCovenantUsecase struct {
	repo LenderCovenantRepository
}

func NewLenderCovenantUsecase(repo LenderCovenantRepository) *LenderCovenantUsecase {
	return &LenderCovenantUsecase{repo: repo}
}

func (u *LenderCovenantUsecase) Upsert(ctx context.Context, actor string, covenant *domain.LenderCovenant) error {
	if err := covenant.Validate(); err != nil {
		return err
	}
	return u.repo.Upsert(ctx, actor, covenant)
}

func (u *LenderCovenantUsecase) GetByProject(ctx context.Context, projectID uuid.UUID) (*domain.LenderCovenant, error) {
	return u.repo.GetByProject(ctx, projectID)
}
