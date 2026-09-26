package usecase

import (
	"context"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
)

type LegalCheckRepository interface {
	Upsert(ctx context.Context, actor string, check *domain.LegalCheck) error
	GetByLandParcel(ctx context.Context, landParcelID uuid.UUID) (*domain.LegalCheck, error)
}

type LegalCheckUsecase struct {
	repo LegalCheckRepository
}

func NewLegalCheckUsecase(repo LegalCheckRepository) *LegalCheckUsecase {
	return &LegalCheckUsecase{repo: repo}
}

func (u *LegalCheckUsecase) Upsert(ctx context.Context, actor string, check *domain.LegalCheck) error {
	if err := check.Validate(); err != nil {
		return err
	}
	return u.repo.Upsert(ctx, actor, check)
}

func (u *LegalCheckUsecase) GetByLandParcel(ctx context.Context, landParcelID uuid.UUID) (*domain.LegalCheck, error) {
	return u.repo.GetByLandParcel(ctx, landParcelID)
}
