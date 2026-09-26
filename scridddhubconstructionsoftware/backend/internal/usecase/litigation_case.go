package usecase

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
)

type LitigationCaseRepository interface {
	Create(ctx context.Context, actor string, c *domain.LitigationCase) error
	Get(ctx context.Context, id uuid.UUID) (*domain.LitigationCase, error)
	ListByOrg(ctx context.Context, orgID uuid.UUID) ([]*domain.LitigationCase, error)
	UpdateStatus(ctx context.Context, actor string, id uuid.UUID, status domain.LitigationCaseStatus, resolutionNote *string) (*domain.LitigationCase, error)
}

type LitigationCaseUsecase struct {
	repo LitigationCaseRepository
}

func NewLitigationCaseUsecase(repo LitigationCaseRepository) *LitigationCaseUsecase {
	return &LitigationCaseUsecase{repo: repo}
}

func (u *LitigationCaseUsecase) Create(ctx context.Context, actor string, c *domain.LitigationCase) error {
	if c.Status == "" {
		c.Status = domain.LitigationCaseStatusOpen
	}
	if err := c.Validate(); err != nil {
		return err
	}
	return u.repo.Create(ctx, actor, c)
}

func (u *LitigationCaseUsecase) Get(ctx context.Context, id uuid.UUID) (*domain.LitigationCase, error) {
	return u.repo.Get(ctx, id)
}

func (u *LitigationCaseUsecase) ListByOrg(ctx context.Context, orgID uuid.UUID) ([]*domain.LitigationCase, error) {
	return u.repo.ListByOrg(ctx, orgID)
}

func (u *LitigationCaseUsecase) UpdateStatus(ctx context.Context, actor string, id uuid.UUID, status domain.LitigationCaseStatus, resolutionNote *string) (*domain.LitigationCase, error) {
	switch status {
	case domain.LitigationCaseStatusOpen, domain.LitigationCaseStatusInProgress, domain.LitigationCaseStatusClosed:
	default:
		return nil, fmt.Errorf("invalid status: %s", status)
	}
	return u.repo.UpdateStatus(ctx, actor, id, status, resolutionNote)
}
