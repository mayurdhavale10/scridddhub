package usecase

import (
	"context"

	"github.com/scridddhub/backend/internal/domain"
)

const defaultAuditLogLimit = 50
const maxAuditLogLimit = 200

type AuditLogRepository interface {
	ListRecent(ctx context.Context, limit int) ([]*domain.AuditLogEntry, error)
}

type AuditLogUsecase struct {
	repo AuditLogRepository
}

func NewAuditLogUsecase(repo AuditLogRepository) *AuditLogUsecase {
	return &AuditLogUsecase{repo: repo}
}

func (u *AuditLogUsecase) ListRecent(ctx context.Context, limit int) ([]*domain.AuditLogEntry, error) {
	if limit <= 0 {
		limit = defaultAuditLogLimit
	}
	if limit > maxAuditLogLimit {
		limit = maxAuditLogLimit
	}
	return u.repo.ListRecent(ctx, limit)
}
