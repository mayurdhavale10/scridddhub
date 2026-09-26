package domain

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

// Tender (Screen 10) — "selective tendering: 3 shortlisted contractors, technical bid then
// financial bid, not an open public tender." A project can run more than one over its life
// (civil work, MEP, finishing, ...), each scoped by TradePackage.
type Tender struct {
	ID           uuid.UUID
	ProjectID    uuid.UUID
	TradePackage string

	CreatedAt time.Time
	UpdatedAt time.Time
}

func (t *Tender) Validate() error {
	if t.ProjectID == uuid.Nil {
		return fmt.Errorf("project_id is required")
	}
	if t.TradePackage == "" {
		return fmt.Errorf("trade_package is required")
	}
	return nil
}

type TenderBidTechnicalStatus string

const (
	TenderBidTechnicalStatusQualified    TenderBidTechnicalStatus = "qualified"
	TenderBidTechnicalStatusDisqualified TenderBidTechnicalStatus = "disqualified"
	TenderBidTechnicalStatusPending      TenderBidTechnicalStatus = "pending"
)

// TenderBid — one shortlisted contractor's bid. Recommended is the platform's own pick, not the
// same thing as a final award decision — the screen's own "Confirm & Set Master Schedule" CTA is
// the actual award action, which belongs to Screen 11 (MasterScheduleMilestone), not built yet.
type TenderBid struct {
	ID                    uuid.UUID
	TenderID              uuid.UUID
	ContractorName        string
	PastJobsWithDeveloper int32
	PastPerformanceNote   string
	TechnicalBidStatus    TenderBidTechnicalStatus
	FinancialBidRupees    *int64
	Recommended           bool

	CreatedAt time.Time
	UpdatedAt time.Time
}

func (b *TenderBid) Validate() error {
	if b.TenderID == uuid.Nil {
		return fmt.Errorf("tender_id is required")
	}
	if b.ContractorName == "" {
		return fmt.Errorf("contractor_name is required")
	}
	switch b.TechnicalBidStatus {
	case TenderBidTechnicalStatusQualified, TenderBidTechnicalStatusDisqualified, TenderBidTechnicalStatusPending:
	default:
		return fmt.Errorf("invalid technical_bid_status: %s", b.TechnicalBidStatus)
	}
	if b.PastJobsWithDeveloper < 0 {
		return fmt.Errorf("past_jobs_with_developer cannot be negative")
	}
	return nil
}
