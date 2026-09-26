package usecase

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
)

type EscrowAccountRepository interface {
	UpdateDeveloperLedger(ctx context.Context, actor string, projectID uuid.UUID, balanceRupees int64) (*domain.EscrowAccount, error)
	UpdateBankFeed(ctx context.Context, actor string, projectID uuid.UUID, balanceRupees int64, sourceName string, syncedAt time.Time) (*domain.EscrowAccount, error)
	GetByProject(ctx context.Context, projectID uuid.UUID) (*domain.EscrowAccount, error)
}

type EscrowAccountUsecase struct {
	repo EscrowAccountRepository
}

func NewEscrowAccountUsecase(repo EscrowAccountRepository) *EscrowAccountUsecase {
	return &EscrowAccountUsecase{repo: repo}
}

// UpdateDeveloperLedger is the only escrow write path exposed to the developer-facing app —
// their own self-reported figure, shown side by side with (never blended into) the bank figure.
func (u *EscrowAccountUsecase) UpdateDeveloperLedger(ctx context.Context, actor string, projectID uuid.UUID, balanceRupees int64) (*domain.EscrowAccount, error) {
	return u.repo.UpdateDeveloperLedger(ctx, actor, projectID, balanceRupees)
}

// UpdateBankFeed is meant to be called only by a real bank statement-fetch integration (a
// scheduled job or webhook) — NOT by any mobile-app UI action. No such integration exists yet;
// this exists so the write path (and its distinct audit actor) is real before that integration
// is, rather than retrofitted later as an afterthought.
func (u *EscrowAccountUsecase) UpdateBankFeed(ctx context.Context, projectID uuid.UUID, balanceRupees int64, sourceName string, syncedAt time.Time) (*domain.EscrowAccount, error) {
	return u.repo.UpdateBankFeed(ctx, "bank-integration", projectID, balanceRupees, sourceName, syncedAt)
}

func (u *EscrowAccountUsecase) GetByProject(ctx context.Context, projectID uuid.UUID) (*domain.EscrowAccount, error) {
	return u.repo.GetByProject(ctx, projectID)
}
