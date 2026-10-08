package usecase

import (
	"context"
	"errors"

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

// Start returns the parcel's legal check, creating the standard checklist if none exists yet,
// so the check works for any parcel. Calling it again never resets a check in progress.
func (u *LegalCheckUsecase) Start(ctx context.Context, actor string, landParcelID uuid.UUID) (*domain.LegalCheck, error) {
	existing, err := u.repo.GetByLandParcel(ctx, landParcelID)
	if err == nil {
		return existing, nil
	}
	if !errors.Is(err, domain.ErrNotFound) {
		return nil, err
	}
	check := domain.NewLegalCheckChecklist(landParcelID)
	if err := u.Upsert(ctx, actor, check); err != nil {
		return nil, err
	}
	return check, nil
}

func (u *LegalCheckUsecase) GetByLandParcel(ctx context.Context, landParcelID uuid.UUID) (*domain.LegalCheck, error) {
	return u.repo.GetByLandParcel(ctx, landParcelID)
}
