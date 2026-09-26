package domain

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

// MasterSchedule (Screen 11) — "land to possession." One per project; ConfirmedAt is the
// "Confirm Schedule" action, distinct from any individual milestone's own status, because RERA
// Section 18 stakes attach to the schedule as a whole being locked in.
type MasterSchedule struct {
	ID          uuid.UUID
	ProjectID   uuid.UUID
	ConfirmedAt *time.Time

	CreatedAt time.Time
	UpdatedAt time.Time
}

func (s *MasterSchedule) Validate() error {
	if s.ProjectID == uuid.Nil {
		return fmt.Errorf("project_id is required")
	}
	return nil
}

type MasterScheduleMilestoneType string

const (
	MilestoneTypeLandAcquisition         MasterScheduleMilestoneType = "land_acquisition"
	MilestoneTypeApprovals               MasterScheduleMilestoneType = "approvals"
	MilestoneTypeConstructionStart       MasterScheduleMilestoneType = "construction_start"
	MilestoneTypeStructureComplete       MasterScheduleMilestoneType = "structure_complete"
	MilestoneTypeCommittedPossessionDate MasterScheduleMilestoneType = "committed_possession_date"
)

// MilestoneTypeOrder is the fixed sequence — "land to possession" — used to validate a create
// request supplies exactly these 5, and to seed defaults if ever needed.
var MilestoneTypeOrder = []MasterScheduleMilestoneType{
	MilestoneTypeLandAcquisition,
	MilestoneTypeApprovals,
	MilestoneTypeConstructionStart,
	MilestoneTypeStructureComplete,
	MilestoneTypeCommittedPossessionDate,
}

type MasterScheduleMilestoneStatus string

const (
	MilestoneStatusComplete   MasterScheduleMilestoneStatus = "complete"
	MilestoneStatusInProgress MasterScheduleMilestoneStatus = "in_progress"
	MilestoneStatusPending    MasterScheduleMilestoneStatus = "pending"
)

// MasterScheduleMilestone — TargetDate is the actual completion date once Status is complete,
// otherwise the current estimate. Month-precision in the wireframe ("Mar 2026"); stored as a
// full date (first of month) and formatted client-side.
type MasterScheduleMilestone struct {
	ID               uuid.UUID
	MasterScheduleID uuid.UUID
	MilestoneType    MasterScheduleMilestoneType
	Status           MasterScheduleMilestoneStatus
	TargetDate       time.Time

	CreatedAt time.Time
	UpdatedAt time.Time
}

// Validate deliberately does not check MasterScheduleID: its only caller is
// MasterScheduleUsecase.Create, where milestones are validated before the schedule (and their
// own MasterScheduleID) exists yet — the repository assigns it during the same transaction.
func (m *MasterScheduleMilestone) Validate() error {
	switch m.MilestoneType {
	case MilestoneTypeLandAcquisition, MilestoneTypeApprovals, MilestoneTypeConstructionStart,
		MilestoneTypeStructureComplete, MilestoneTypeCommittedPossessionDate:
	default:
		return fmt.Errorf("invalid milestone_type: %s", m.MilestoneType)
	}
	switch m.Status {
	case MilestoneStatusComplete, MilestoneStatusInProgress, MilestoneStatusPending:
	default:
		return fmt.Errorf("invalid status: %s", m.Status)
	}
	if m.TargetDate.IsZero() {
		return fmt.Errorf("target_date is required")
	}
	return nil
}
