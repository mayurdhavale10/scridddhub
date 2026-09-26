package usecase

import (
	"context"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
)

type GSTFilingRepository interface {
	Upsert(ctx context.Context, actor string, filing *domain.GSTFiling) error
	GetByPeriod(ctx context.Context, projectID uuid.UUID, year, quarter int16) (*domain.GSTFiling, error)
}

type GSTFilingUsecase struct {
	repo GSTFilingRepository
}

func NewGSTFilingUsecase(repo GSTFilingRepository) *GSTFilingUsecase {
	return &GSTFilingUsecase{repo: repo}
}

func (u *GSTFilingUsecase) Upsert(ctx context.Context, actor string, filing *domain.GSTFiling) error {
	if err := filing.Validate(); err != nil {
		return err
	}
	return u.repo.Upsert(ctx, actor, filing)
}

func (u *GSTFilingUsecase) GetByPeriod(ctx context.Context, projectID uuid.UUID, year, quarter int16) (*domain.GSTFiling, error) {
	return u.repo.GetByPeriod(ctx, projectID, year, quarter)
}

type TDSFilingRepository interface {
	Upsert(ctx context.Context, actor string, filing *domain.TDSFiling) error
	GetByPeriod(ctx context.Context, projectID uuid.UUID, year, quarter int16) (*domain.TDSFiling, error)
}

type TDSFilingUsecase struct {
	repo TDSFilingRepository
}

func NewTDSFilingUsecase(repo TDSFilingRepository) *TDSFilingUsecase {
	return &TDSFilingUsecase{repo: repo}
}

func (u *TDSFilingUsecase) Upsert(ctx context.Context, actor string, filing *domain.TDSFiling) error {
	if err := filing.Validate(); err != nil {
		return err
	}
	return u.repo.Upsert(ctx, actor, filing)
}

func (u *TDSFilingUsecase) GetByPeriod(ctx context.Context, projectID uuid.UUID, year, quarter int16) (*domain.TDSFiling, error) {
	return u.repo.GetByPeriod(ctx, projectID, year, quarter)
}
