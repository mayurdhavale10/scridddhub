package usecase

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
)

type TenderRepository interface {
	Create(ctx context.Context, actor string, t *domain.Tender) error
	ListByProject(ctx context.Context, projectID uuid.UUID) ([]*domain.Tender, error)
}

type TenderUsecase struct {
	repo TenderRepository
}

func NewTenderUsecase(repo TenderRepository) *TenderUsecase {
	return &TenderUsecase{repo: repo}
}

func (u *TenderUsecase) Create(ctx context.Context, actor string, t *domain.Tender) error {
	if err := t.Validate(); err != nil {
		return err
	}
	return u.repo.Create(ctx, actor, t)
}

func (u *TenderUsecase) ListByProject(ctx context.Context, projectID uuid.UUID) ([]*domain.Tender, error) {
	return u.repo.ListByProject(ctx, projectID)
}

type TenderBidRepository interface {
	Create(ctx context.Context, actor string, b *domain.TenderBid) error
	ListByTender(ctx context.Context, tenderID uuid.UUID) ([]*domain.TenderBid, error)
	Update(ctx context.Context, actor string, id uuid.UUID, status domain.TenderBidTechnicalStatus, financialBidRupees *int64, recommended bool) (*domain.TenderBid, error)
}

type TenderBidUsecase struct {
	repo TenderBidRepository
}

func NewTenderBidUsecase(repo TenderBidRepository) *TenderBidUsecase {
	return &TenderBidUsecase{repo: repo}
}

func (u *TenderBidUsecase) Create(ctx context.Context, actor string, b *domain.TenderBid) error {
	if b.TechnicalBidStatus == "" {
		b.TechnicalBidStatus = domain.TenderBidTechnicalStatusPending
	}
	if err := b.Validate(); err != nil {
		return err
	}
	return u.repo.Create(ctx, actor, b)
}

func (u *TenderBidUsecase) ListByTender(ctx context.Context, tenderID uuid.UUID) ([]*domain.TenderBid, error) {
	return u.repo.ListByTender(ctx, tenderID)
}

func (u *TenderBidUsecase) Update(ctx context.Context, actor string, id uuid.UUID, status domain.TenderBidTechnicalStatus, financialBidRupees *int64, recommended bool) (*domain.TenderBid, error) {
	switch status {
	case domain.TenderBidTechnicalStatusQualified, domain.TenderBidTechnicalStatusDisqualified, domain.TenderBidTechnicalStatusPending:
	default:
		return nil, fmt.Errorf("invalid technical_bid_status: %s", status)
	}
	return u.repo.Update(ctx, actor, id, status, financialBidRupees, recommended)
}
