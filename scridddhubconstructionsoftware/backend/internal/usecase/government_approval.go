package usecase

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
)

type GovernmentApprovalRepository interface {
	GetPlaybook(ctx context.Context, state string) ([]domain.ApprovalPlaybookEntry, error)
	UpsertSiteSummary(ctx context.Context, actor string, summary *domain.LandParcelSiteSummary) error
	GetSiteSummary(ctx context.Context, landParcelID uuid.UUID) (*domain.LandParcelSiteSummary, error)
	ListApprovals(ctx context.Context, landParcelID uuid.UUID) ([]*domain.LandParcelApproval, error)
	GetApprovalByPlaybookEntry(ctx context.Context, landParcelID, playbookID uuid.UUID) (*domain.LandParcelApproval, error)
	UpsertApproval(ctx context.Context, actor string, approval *domain.LandParcelApproval) error
	UpdateApprovalStatus(ctx context.Context, actor string, approvalID uuid.UUID, status domain.ApprovalStatus, submittedAt *time.Time) (*domain.LandParcelApproval, error)
}

type GovernmentApprovalUsecase struct {
	repo      GovernmentApprovalRepository
	extractor SiteTextExtractor
}

func NewGovernmentApprovalUsecase(repo GovernmentApprovalRepository, extractor SiteTextExtractor) *GovernmentApprovalUsecase {
	return &GovernmentApprovalUsecase{repo: repo, extractor: extractor}
}

// defaultState is used until the extractor (or an explicit field) can determine a project's
// state — only Maharashtra's playbook exists to seed against right now anyway (migration
// 000007). Revisit the moment a second state's playbook is added.
const defaultState = "Maharashtra"

// AnalyzeProject reads free text, saves the resulting site summary, and reconciles the parcel's
// approval list against the state playbook. Reconciliation deliberately never resets an approval
// that already has real progress (submitted/approved) — only a newly-excluded entry gets forced
// back to not_applicable, and a newly-included entry with no existing row gets created fresh.
// This is what lets "Re-analyze" on Screen 7 be safe to tap repeatedly.
func (u *GovernmentApprovalUsecase) AnalyzeProject(ctx context.Context, actor string, landParcelID uuid.UUID, freeText string) ([]*domain.LandParcelApproval, error) {
	extracted, err := u.extractor.Extract(ctx, freeText)
	if err != nil {
		return nil, fmt.Errorf("extracting site characteristics: %w", err)
	}
	characteristics := domain.SiteCharacteristics{
		NearAirport:          extracted.NearAirport,
		CoastalSite:          extracted.CoastalSite,
		SignificantTreeCover: extracted.SignificantTreeCover,
		UsesGroundwater:      extracted.UsesGroundwater,
		UnitCount:            extracted.UnitCount,
	}

	summary := &domain.LandParcelSiteSummary{
		LandParcelID:    landParcelID,
		State:           defaultState,
		FreeText:        freeText,
		Characteristics: characteristics,
	}
	if err := u.repo.UpsertSiteSummary(ctx, actor, summary); err != nil {
		return nil, err
	}

	playbook, err := u.repo.GetPlaybook(ctx, defaultState)
	if err != nil {
		return nil, err
	}

	for _, entry := range playbook {
		applies := entry.Applies(characteristics)

		existing, err := u.repo.GetApprovalByPlaybookEntry(ctx, landParcelID, entry.ID)
		if err != nil && err != domain.ErrNotFound {
			return nil, err
		}

		switch {
		case existing == nil:
			status := domain.ApprovalStatusNotStarted
			if !applies {
				status = domain.ApprovalStatusNotApplicable
			}
			if err := u.repo.UpsertApproval(ctx, actor, &domain.LandParcelApproval{
				LandParcelID:       landParcelID,
				ApprovalPlaybookID: entry.ID,
				Status:             status,
			}); err != nil {
				return nil, err
			}
		case existing.Status == domain.ApprovalStatusNotApplicable && applies:
			existing.Status = domain.ApprovalStatusNotStarted
			if err := u.repo.UpsertApproval(ctx, actor, existing); err != nil {
				return nil, err
			}
		case existing.Status != domain.ApprovalStatusNotApplicable && !applies:
			existing.Status = domain.ApprovalStatusNotApplicable
			if err := u.repo.UpsertApproval(ctx, actor, existing); err != nil {
				return nil, err
			}
		}
		// Otherwise: leave existing status untouched — real progress is never reset by re-analysis.
	}

	return u.repo.ListApprovals(ctx, landParcelID)
}

func (u *GovernmentApprovalUsecase) ListApprovals(ctx context.Context, landParcelID uuid.UUID) ([]*domain.LandParcelApproval, error) {
	return u.repo.ListApprovals(ctx, landParcelID)
}

func (u *GovernmentApprovalUsecase) GetSiteSummary(ctx context.Context, landParcelID uuid.UUID) (*domain.LandParcelSiteSummary, error) {
	return u.repo.GetSiteSummary(ctx, landParcelID)
}

func (u *GovernmentApprovalUsecase) UpdateApprovalStatus(ctx context.Context, actor string, approvalID uuid.UUID, status domain.ApprovalStatus, submittedAt *time.Time) (*domain.LandParcelApproval, error) {
	if !status.Valid() {
		return nil, fmt.Errorf("invalid status: %q", status)
	}
	return u.repo.UpdateApprovalStatus(ctx, actor, approvalID, status, submittedAt)
}
