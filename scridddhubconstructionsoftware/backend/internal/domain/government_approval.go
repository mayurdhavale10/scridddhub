package domain

import (
	"time"

	"github.com/google/uuid"
)

// ApprovalPlaybookEntry is one step in a state's required approval sequence — reference data,
// not user-generated (see migration 000007's comment on its provenance).
type ApprovalPlaybookEntry struct {
	ID                     uuid.UUID
	State                  string
	SequenceOrder          int16
	ApprovalName           string
	Description            string
	ApplicabilityCondition string // "" means always required; see SiteCharacteristics field names
}

// Applies reports whether this playbook entry is required given the parcel's site
// characteristics — the same evaluation Screen 7 shows as "included/excluded — you said ...".
func (e *ApprovalPlaybookEntry) Applies(c SiteCharacteristics) bool {
	switch e.ApplicabilityCondition {
	case "":
		return true
	case "near_airport":
		return c.NearAirport
	case "coastal_site":
		return c.CoastalSite
	case "significant_tree_cover":
		return c.SignificantTreeCover
	case "uses_groundwater":
		return c.UsesGroundwater
	default:
		return true
	}
}

// SiteCharacteristics mirrors usecase.SiteCharacteristics. Domain can't import usecase (usecase
// imports domain, not the reverse), so this is a small, deliberate duplication rather than an
// import cycle — keep the two in sync if a field is ever added.
type SiteCharacteristics struct {
	NearAirport          bool
	CoastalSite          bool
	SignificantTreeCover bool
	UsesGroundwater      bool
	UnitCount            int
}

type LandParcelSiteSummary struct {
	ID              uuid.UUID
	LandParcelID    uuid.UUID
	State           string
	FreeText        string
	Characteristics SiteCharacteristics
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

type ApprovalStatus string

const (
	ApprovalStatusNotApplicable ApprovalStatus = "not_applicable"
	ApprovalStatusNotStarted    ApprovalStatus = "not_started"
	ApprovalStatusSubmitted     ApprovalStatus = "submitted"
	ApprovalStatusApproved      ApprovalStatus = "approved"
	ApprovalStatusNotYetDue     ApprovalStatus = "not_yet_due"
)

func (s ApprovalStatus) Valid() bool {
	switch s {
	case ApprovalStatusNotApplicable, ApprovalStatusNotStarted, ApprovalStatusSubmitted,
		ApprovalStatusApproved, ApprovalStatusNotYetDue:
		return true
	default:
		return false
	}
}

// LandParcelApproval is one playbook entry's tracked status for one parcel. Playbook fields
// (ApprovalName, Description, SequenceOrder, ApplicabilityCondition) are joined in for display —
// this struct is a read model as much as a write target.
type LandParcelApproval struct {
	ID                     uuid.UUID
	LandParcelID           uuid.UUID
	ApprovalPlaybookID     uuid.UUID
	Status                 ApprovalStatus
	SubmittedAt            *time.Time
	SequenceOrder          int16
	ApprovalName           string
	Description            string
	ApplicabilityCondition string
	CreatedAt              time.Time
	UpdatedAt              time.Time
}
