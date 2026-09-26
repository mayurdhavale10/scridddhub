package usecase

import (
	"context"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
)

type AccountingSyncRepository interface {
	Upsert(ctx context.Context, actor string, sync *domain.AccountingSync) error
	GetByProject(ctx context.Context, projectID uuid.UUID) (*domain.AccountingSync, error)
}

type AccountingSyncUsecase struct {
	repo AccountingSyncRepository
}

func NewAccountingSyncUsecase(repo AccountingSyncRepository) *AccountingSyncUsecase {
	return &AccountingSyncUsecase{repo: repo}
}

func (u *AccountingSyncUsecase) Upsert(ctx context.Context, actor string, sync *domain.AccountingSync) error {
	if err := sync.Validate(); err != nil {
		return err
	}
	return u.repo.Upsert(ctx, actor, sync)
}

func (u *AccountingSyncUsecase) GetByProject(ctx context.Context, projectID uuid.UUID) (*domain.AccountingSync, error) {
	return u.repo.GetByProject(ctx, projectID)
}
