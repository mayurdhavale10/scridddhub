package domain

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

type RiskCategory string

const (
	RiskCategoryLegalTitle          RiskCategory = "legal_title"
	RiskCategoryRegulatory          RiskCategory = "regulatory"
	RiskCategoryFinancial           RiskCategory = "financial"
	RiskCategoryContractorExecution RiskCategory = "contractor_execution"
	RiskCategoryMarket              RiskCategory = "market"
)

type RiskStatus string

const (
	RiskStatusClear   RiskStatus = "clear"
	RiskStatusFlagged RiskStatus = "flagged"
	RiskStatusOnTrack RiskStatus = "on_track"
)

// RiskRegisterEntry (Screen 9) — "5 categories, not a single score," reviewed at each gate.
// One row per project per fixed category. Headline is the exact pill text a reviewer enters
// (e.g. "Clear · 4/4", "1 flagged"); several categories have no backing entity in this build to
// derive that text from, so it's entered directly rather than computed.
type RiskRegisterEntry struct {
	ID        uuid.UUID
	ProjectID uuid.UUID
	Category  RiskCategory
	Status    RiskStatus
	Headline  string
	Detail    string

	CreatedAt time.Time
	UpdatedAt time.Time
}

func (e *RiskRegisterEntry) Validate() error {
	if e.ProjectID == uuid.Nil {
		return fmt.Errorf("project_id is required")
	}
	switch e.Category {
	case RiskCategoryLegalTitle, RiskCategoryRegulatory, RiskCategoryFinancial,
		RiskCategoryContractorExecution, RiskCategoryMarket:
	default:
		return fmt.Errorf("invalid category: %s", e.Category)
	}
	switch e.Status {
	case RiskStatusClear, RiskStatusFlagged, RiskStatusOnTrack:
	default:
		return fmt.Errorf("invalid status: %s", e.Status)
	}
	if e.Headline == "" {
		return fmt.Errorf("headline is required")
	}
	if e.Detail == "" {
		return fmt.Errorf("detail is required")
	}
	return nil
}
