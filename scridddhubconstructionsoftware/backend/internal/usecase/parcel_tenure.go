package usecase

import (
	"context"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
)

type ParcelTenureRepository interface {
	Upsert(ctx context.Context, actor string, t *domain.ParcelTenure) error
	GetByLandParcel(ctx context.Context, landParcelID uuid.UUID) (*domain.ParcelTenure, error)
}

// ParcelTenureUsecase records how a deal's land is acquired: outright or JDA (Screen 8.9).
type ParcelTenureUsecase struct {
	repo ParcelTenureRepository
}

func NewParcelTenureUsecase(repo ParcelTenureRepository) *ParcelTenureUsecase {
	return &ParcelTenureUsecase{repo: repo}
}

func (u *ParcelTenureUsecase) Upsert(ctx context.Context, actor string, t *domain.ParcelTenure) error {
	if err := t.Validate(); err != nil {
		return err
	}
	return u.repo.Upsert(ctx, actor, t)
}

func (u *ParcelTenureUsecase) Get(ctx context.Context, landParcelID uuid.UUID) (*domain.ParcelTenure, error) {
	return u.repo.GetByLandParcel(ctx, landParcelID)
}
