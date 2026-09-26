package usecase

import (
	"context"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
)

type FinancialStructureRepository interface {
	Upsert(ctx context.Context, actor string, structure *domain.FinancialStructure) error
	GetByProject(ctx context.Context, projectID uuid.UUID) (*domain.FinancialStructure, error)
}

type FinancialStructureUsecase struct {
	repo FinancialStructureRepository
}

func NewFinancialStructureUsecase(repo FinancialStructureRepository) *FinancialStructureUsecase {
	return &FinancialStructureUsecase{repo: repo}
}

func (u *FinancialStructureUsecase) Upsert(ctx context.Context, actor string, structure *domain.FinancialStructure) error {
	if err := structure.Validate(); err != nil {
		return err
	}
	return u.repo.Upsert(ctx, actor, structure)
}

func (u *FinancialStructureUsecase) GetByProject(ctx context.Context, projectID uuid.UUID) (*domain.FinancialStructure, error) {
	return u.repo.GetByProject(ctx, projectID)
}
