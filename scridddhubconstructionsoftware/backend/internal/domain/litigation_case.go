package domain

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

type LitigationCaseType string

const (
	LitigationCaseTypeRERATribunal  LitigationCaseType = "rera_tribunal"
	LitigationCaseTypeConsumerCourt LitigationCaseType = "consumer_court"
	LitigationCaseTypeArbitration   LitigationCaseType = "arbitration"
)

type LitigationCounterpartyType string

const (
	LitigationCounterpartyBuyer      LitigationCounterpartyType = "buyer"
	LitigationCounterpartyContractor LitigationCounterpartyType = "contractor"
)

type LitigationCaseStatus string

const (
	LitigationCaseStatusOpen       LitigationCaseStatus = "open"
	LitigationCaseStatusInProgress LitigationCaseStatus = "in_progress"
	LitigationCaseStatusClosed     LitigationCaseStatus = "closed"
)

// LitigationCase (Screen 8.17) — the developer's own complete internal record of every RERA
// tribunal complaint, consumer-court case, or contractor arbitration, open or closed. Distinct
// from Screen 37's curated, opt-in, buyer-facing case count: a bad outcome logged here does not
// automatically become buyer-visible there.
//
// Org-scoped, not project-scoped (see migration 000017's comment) — ProjectID is nullable
// because not every matter ties to a single project.
type LitigationCase struct {
	ID        uuid.UUID
	OrgID     uuid.UUID
	ProjectID *uuid.UUID

	CaseType         LitigationCaseType
	CounterpartyType LitigationCounterpartyType
	CounterpartyName *string
	Forum            string
	Subject          string

	Status              LitigationCaseStatus
	NextHearingAt       *time.Time
	ClaimedAmountRupees *int64
	ResolutionNote      *string

	CreatedAt time.Time
	UpdatedAt time.Time
}

func (c *LitigationCase) Validate() error {
	if c.OrgID == uuid.Nil {
		return fmt.Errorf("org_id is required")
	}
	switch c.CaseType {
	case LitigationCaseTypeRERATribunal, LitigationCaseTypeConsumerCourt, LitigationCaseTypeArbitration:
	default:
		return fmt.Errorf("invalid case_type: %s", c.CaseType)
	}
	switch c.CounterpartyType {
	case LitigationCounterpartyBuyer, LitigationCounterpartyContractor:
	default:
		return fmt.Errorf("invalid counterparty_type: %s", c.CounterpartyType)
	}
	if c.Forum == "" {
		return fmt.Errorf("forum is required")
	}
	if c.Subject == "" {
		return fmt.Errorf("subject is required")
	}
	return nil
}

// TotalExposureRupees sums claimed amounts across cases that are not yet closed — "not yet a
// confirmed liability" per the wireframe's own framing, computed here rather than stored so it
// can never drift from the underlying case list.
func TotalExposureRupees(cases []*LitigationCase) int64 {
	var total int64
	for _, c := range cases {
		if c.Status == LitigationCaseStatusClosed {
			continue
		}
		if c.ClaimedAmountRupees != nil {
			total += *c.ClaimedAmountRupees
		}
	}
	return total
}
