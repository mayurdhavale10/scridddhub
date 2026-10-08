package domain

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

type RiskLevel string

const (
	// RiskLevelNotChecked is where every risk starts on a new checklist: nobody has judged it yet.
	RiskLevelNotChecked RiskLevel = "not_checked"
	RiskLevelLow        RiskLevel = "low"
	RiskLevelMedium     RiskLevel = "medium"
	RiskLevelHigh       RiskLevel = "high"
)

// ErrLegalCheckNotReady is returned when a check is marked cleared while a risk is still
// not_checked or a public-record search isn't done. A person signs off a deal, item by item.
var ErrLegalCheckNotReady = errors.New("legal check not ready to clear")

func (r RiskLevel) Valid() bool {
	switch r {
	case RiskLevelNotChecked, RiskLevelLow, RiskLevelMedium, RiskLevelHigh:
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
	if c.Status == LegalCheckStatusCleared {
		if open := c.OpenItems(); len(open) > 0 {
			return fmt.Errorf("%w: %s", ErrLegalCheckNotReady, strings.Join(open, "; "))
		}
	}
	return nil
}

// OpenItems lists what still blocks clearing: risks nobody has judged and searches not done.
// Pending documents don't block. The Screen 6 design clears with a tax receipt still pending.
func (c *LegalCheck) OpenItems() []string {
	var open []string
	for _, r := range []struct {
		name string
		risk RiskLevel
	}{
		{"ownership risk", c.OwnershipRisk},
		{"litigation risk", c.LitigationRisk},
		{"encumbrance risk", c.EncumbranceRisk},
		{"regulatory risk", c.RegulatoryRisk},
	} {
		if r.risk == RiskLevelNotChecked {
			open = append(open, r.name+" not checked")
		}
	}
	for _, s := range c.EncumbranceSearches {
		if !s.Completed {
			open = append(open, s.SearchType+" not done")
		}
	}
	return open
}

// NewLegalCheckChecklist is the standard Level 1 checklist any parcel starts from: every risk
// not checked, the three public-record searches, and the documents a Maharashtra land deal needs.
// The team fills it in; nothing here is a finding.
func NewLegalCheckChecklist(landParcelID uuid.UUID) *LegalCheck {
	return &LegalCheck{
		LandParcelID:    landParcelID,
		OwnershipRisk:   RiskLevelNotChecked,
		LitigationRisk:  RiskLevelNotChecked,
		EncumbranceRisk: RiskLevelNotChecked,
		RegulatoryRisk:  RiskLevelNotChecked,
		OwnershipChain:  []OwnershipChainEntry{},
		EncumbranceSearches: []EncumbranceSearchItem{
			{SearchType: "Sub-registrar encumbrance search"},
			{SearchType: "District & High Court litigation"},
			{SearchType: "Govt. acquisition notification list"},
		},
		RERAHistory: []RERAHistoryEntry{},
		Documents: []LegalDocument{
			{DocumentType: "7/12 Extract", Status: DocumentStatusPending},
			{DocumentType: "Mutation entries (Ferfar)", Status: DocumentStatusPending},
			{DocumentType: "Title Deed", Status: DocumentStatusPending},
			{DocumentType: "Encumbrance Certificate", Status: DocumentStatusPending},
			{DocumentType: "Tax Clearance Receipt", Status: DocumentStatusPending},
		},
		Status: LegalCheckStatusInProgress,
	}
}
