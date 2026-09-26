package usecase

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
)

type MasterScheduleRepository interface {
	Create(ctx context.Context, actor string, schedule *domain.MasterSchedule, milestones []*domain.MasterScheduleMilestone) error
	GetByProject(ctx context.Context, projectID uuid.UUID) (*domain.MasterSchedule, error)
	ListMilestones(ctx context.Context, scheduleID uuid.UUID) ([]*domain.MasterScheduleMilestone, error)
	UpdateMilestone(ctx context.Context, actor string, milestoneID uuid.UUID, status domain.MasterScheduleMilestoneStatus, targetDate time.Time) (*domain.MasterScheduleMilestone, error)
	ConfirmSchedule(ctx context.Context, actor string, scheduleID uuid.UUID) (*domain.MasterSchedule, error)
}

type MasterScheduleUsecase struct {
	repo MasterScheduleRepository
}

func NewMasterScheduleUsecase(repo MasterScheduleRepository) *MasterScheduleUsecase {
	return &MasterScheduleUsecase{repo: repo}
}

// Create seeds all 5 fixed milestones in one call — the request must supply exactly the fixed
// set (see domain.MilestoneTypeOrder), each exactly once, so the schedule is never left with a
// missing or duplicated milestone type.
func (u *MasterScheduleUsecase) Create(ctx context.Context, actor string, schedule *domain.MasterSchedule, milestones []*domain.MasterScheduleMilestone) error {
	if err := schedule.Validate(); err != nil {
		return err
	}
	if len(milestones) != len(domain.MilestoneTypeOrder) {
		return fmt.Errorf("expected exactly %d milestones, got %d", len(domain.MilestoneTypeOrder), len(milestones))
	}
	seen := make(map[domain.MasterScheduleMilestoneType]bool, len(milestones))
	for _, m := range milestones {
		if err := m.Validate(); err != nil {
			return err
		}
		if seen[m.MilestoneType] {
			return fmt.Errorf("duplicate milestone_type: %s", m.MilestoneType)
		}
		seen[m.MilestoneType] = true
	}
	for _, t := range domain.MilestoneTypeOrder {
		if !seen[t] {
			return fmt.Errorf("missing milestone_type: %s", t)
		}
	}
	return u.repo.Create(ctx, actor, schedule, milestones)
}

func (u *MasterScheduleUsecase) GetByProject(ctx context.Context, projectID uuid.UUID) (*domain.MasterSchedule, error) {
	return u.repo.GetByProject(ctx, projectID)
}

func (u *MasterScheduleUsecase) ListMilestones(ctx context.Context, scheduleID uuid.UUID) ([]*domain.MasterScheduleMilestone, error) {
	return u.repo.ListMilestones(ctx, scheduleID)
}

func (u *MasterScheduleUsecase) UpdateMilestone(ctx context.Context, actor string, milestoneID uuid.UUID, status domain.MasterScheduleMilestoneStatus, targetDate time.Time) (*domain.MasterScheduleMilestone, error) {
	switch status {
	case domain.MilestoneStatusComplete, domain.MilestoneStatusInProgress, domain.MilestoneStatusPending:
	default:
		return nil, fmt.Errorf("invalid status: %s", status)
	}
	if targetDate.IsZero() {
		return nil, fmt.Errorf("target_date is required")
	}
	return u.repo.UpdateMilestone(ctx, actor, milestoneID, status, targetDate)
}

func (u *MasterScheduleUsecase) ConfirmSchedule(ctx context.Context, actor string, scheduleID uuid.UUID) (*domain.MasterSchedule, error) {
	return u.repo.ConfirmSchedule(ctx, actor, scheduleID)
}
