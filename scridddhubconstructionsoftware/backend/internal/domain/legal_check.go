package domain

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

type RiskLevel string

const (
	RiskLevelLow    RiskLevel = "low"
	RiskLevelMedium RiskLevel = "medium"
	RiskLevelHigh   RiskLevel = "high"
)

func (r RiskLevel) Valid() bool {
	switch r {
	case RiskLevelLow, RiskLevelMedium, RiskLevelHigh:
		return true
	default:
		return false
	}
}

type LegalCheckStatus string

const (
	LegalCheckStatusInProgress LegalCheckStatus = "in_progress"
	LegalCheckStatusCleared    LegalCheckStatus = "cleared"
)

// OwnershipChainEntry is one link in the parcel's chain of title (Screen 6 "Ownership Chain").
// IsFinal marks the entry that represents "traced back N years, uncontested" — the verified end
// of the chain, rendered with a distinct (filled) marker from the intermediate transfers.
type OwnershipChainEntry struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	IsFinal     bool   `json:"is_final"`
}

// EncumbranceSearchItem is one search performed against public records (sub-registrar,
// court, government acquisition lists) — Screen 6's checklist above "no mortgages, liens,
// pending suits, or acquisition notices found."
type EncumbranceSearchItem struct {
	SearchType string `json:"search_type"`
	Completed  bool   `json:"completed"`
}

// RERAHistoryEntry is one of the seller/co-developer's past registered projects, used to judge
// their track record before this deal — Screen 6 "Seller / Co-developer RERA History."
type RERAHistoryEntry struct {
	ProjectName            string `json:"project_name"`
	RERARegistrationNumber string `json:"rera_registration_number"`
	DeliveryStatus         string `json:"delivery_status"`
}

type DocumentStatus string

const (
	DocumentStatusPending  DocumentStatus = "pending"
	DocumentStatusReceived DocumentStatus = "received"
)

type LegalDocument struct {
	DocumentType string         `json:"document_type"`
	Status       DocumentStatus `json:"status"`
}

type LegalCheck struct {
	ID           uuid.UUID
	LandParcelID uuid.UUID

	OwnershipRisk       RiskLevel
	OwnershipRiskNote   string
	LitigationRisk      RiskLevel
	LitigationRiskNote  string
	EncumbranceRisk     RiskLevel
	EncumbranceRiskNote string
	RegulatoryRisk      RiskLevel
	RegulatoryRiskNote  string

	OwnershipChain         []OwnershipChainEntry
	EncumbranceSearches    []EncumbranceSearchItem
	SearchSummaryNote      string
	RERAHistory            []RERAHistoryEntry
	RERAHistorySummaryNote string
	Documents              []LegalDocument

	Status LegalCheckStatus

	CreatedAt time.Time
	UpdatedAt time.Time
}

func (c *LegalCheck) Validate() error {
	if c.LandParcelID == uuid.Nil {
		return fmt.Errorf("land_parcel_id is required")
	}
	for name, risk := range map[string]RiskLevel{
		"ownership_risk":   c.OwnershipRisk,
		"litigation_risk":  c.LitigationRisk,
		"encumbrance_risk": c.EncumbranceRisk,
		"regulatory_risk":  c.RegulatoryRisk,
	} {
		if !risk.Valid() {
			return fmt.Errorf("invalid %s: %q", name, risk)
		}
	}
	if c.Status == "" {
		c.Status = LegalCheckStatusInProgress
	}
	if c.Status != LegalCheckStatusInProgress && c.Status != LegalCheckStatusCleared {
		return fmt.Errorf("invalid status: %q", c.Status)
	}
	return nil
}
