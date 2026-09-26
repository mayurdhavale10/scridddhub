package usecase

import (
	"context"

	"github.com/scridddhub/backend/internal/domain"
)

// PricingPoolRepository is defined by this usecase, implemented by internal/repository/postgres.
// Deliberately read-only and cross-org from the start — there is no per-project scoping anywhere
// in this path, matching docs/adr/0005's requirement that future training data is pooled, never a
// per-org comparison.
type PricingPoolRepository interface {
	ListClosedTransactions(ctx context.Context, district, taluka, village string) ([]domain.ClosedTransaction, error)
}

type PricingPoolUsecase struct {
	repo PricingPoolRepository
}

func NewPricingPoolUsecase(repo PricingPoolRepository) *PricingPoolUsecase {
	return &PricingPoolUsecase{repo: repo}
}

func (u *PricingPoolUsecase) ListClosedTransactions(ctx context.Context, district, taluka, village string) ([]domain.ClosedTransaction, error) {
	return u.repo.ListClosedTransactions(ctx, district, taluka, village)
}
