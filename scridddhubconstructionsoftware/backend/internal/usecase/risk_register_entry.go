package usecase

import (
	"context"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
)

type RiskRegisterEntryRepository interface {
	Upsert(ctx context.Context, actor string, entry *domain.RiskRegisterEntry) error
	ListByProject(ctx context.Context, projectID uuid.UUID) ([]*domain.RiskRegisterEntry, error)
}

type RiskRegisterEntryUsecase struct {
	repo RiskRegisterEntryRepository
}

func NewRiskRegisterEntryUsecase(repo RiskRegisterEntryRepository) *RiskRegisterEntryUsecase {
	return &RiskRegisterEntryUsecase{repo: repo}
}

func (u *RiskRegisterEntryUsecase) Upsert(ctx context.Context, actor string, entry *domain.RiskRegisterEntry) error {
	if err := entry.Validate(); err != nil {
		return err
	}
	return u.repo.Upsert(ctx, actor, entry)
}

func (u *RiskRegisterEntryUsecase) ListByProject(ctx context.Context, projectID uuid.UUID) ([]*domain.RiskRegisterEntry, error) {
	return u.repo.ListByProject(ctx, projectID)
}
