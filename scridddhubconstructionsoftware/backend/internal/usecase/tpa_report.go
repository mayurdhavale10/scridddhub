package usecase

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
)

type TPAReportRepository interface {
	Upsert(ctx context.Context, actor string, report *domain.TPAReport) error
	GetByLenderPeriod(ctx context.Context, projectID uuid.UUID, lenderName string, year, quarter int16) (*domain.TPAReport, error)
	MarkSubmitted(ctx context.Context, actor string, reportID uuid.UUID) (*domain.TPAReport, error)
}

type TPAReportUsecase struct {
	repo TPAReportRepository
}

func NewTPAReportUsecase(repo TPAReportRepository) *TPAReportUsecase {
	return &TPAReportUsecase{repo: repo}
}

func (u *TPAReportUsecase) Upsert(ctx context.Context, actor string, report *domain.TPAReport) error {
	if err := report.Validate(); err != nil {
		return err
	}
	return u.repo.Upsert(ctx, actor, report)
}

func (u *TPAReportUsecase) GetByLenderPeriod(ctx context.Context, projectID uuid.UUID, lenderName string, year, quarter int16) (*domain.TPAReport, error) {
	return u.repo.GetByLenderPeriod(ctx, projectID, lenderName, year, quarter)
}

// MarkSubmitted is "a finance team member reviews and submits it" (the wireframe's own framing,
// same "AI drafts, human sends" discipline as CertifyArchitect) — it is a distinct action from
// Upsert, never implied by saving a draft.
func (u *TPAReportUsecase) MarkSubmitted(ctx context.Context, actor string, reportID uuid.UUID) (*domain.TPAReport, error) {
	if reportID == uuid.Nil {
		return nil, fmt.Errorf("report id is required")
	}
	return u.repo.MarkSubmitted(ctx, actor, reportID)
}
