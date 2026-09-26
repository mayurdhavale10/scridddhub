package usecase

import (
	"context"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
)

type FeasibilityAssessmentRepository interface {
	Upsert(ctx context.Context, actor string, assessment *domain.FeasibilityAssessment) error
	GetByLandParcel(ctx context.Context, landParcelID uuid.UUID) (*domain.FeasibilityAssessment, error)
}

type FeasibilityAssessmentUsecase struct {
	repo FeasibilityAssessmentRepository
}

func NewFeasibilityAssessmentUsecase(repo FeasibilityAssessmentRepository) *FeasibilityAssessmentUsecase {
	return &FeasibilityAssessmentUsecase{repo: repo}
}

func (u *FeasibilityAssessmentUsecase) Upsert(ctx context.Context, actor string, assessment *domain.FeasibilityAssessment) error {
	if err := assessment.Validate(); err != nil {
		return err
	}
	return u.repo.Upsert(ctx, actor, assessment)
}

func (u *FeasibilityAssessmentUsecase) GetByLandParcel(ctx context.Context, landParcelID uuid.UUID) (*domain.FeasibilityAssessment, error) {
	return u.repo.GetByLandParcel(ctx, landParcelID)
}
