package usecase

import (
	"context"

	"github.com/scridddhub/backend/internal/domain"
)

type RERARecords interface {
	SearchPromoters(ctx context.Context, query string, limit int) ([]domain.RERAPromoterMatch, error)
	History(ctx context.Context, promoterName string) (*domain.RERASellerHistory, error)
}

// RERAUsecase answers "what has this seller built before?" from collected MahaRERA records.
type RERAUsecase struct {
	records RERARecords
}

func NewRERAUsecase(records RERARecords) *RERAUsecase {
	return &RERAUsecase{records: records}
}

func (u *RERAUsecase) SearchPromoters(ctx context.Context, query string) ([]domain.RERAPromoterMatch, error) {
	return u.records.SearchPromoters(ctx, query, 8)
}

func (u *RERAUsecase) History(ctx context.Context, promoterName string) (*domain.RERASellerHistory, error) {
	return u.records.History(ctx, promoterName)
}
