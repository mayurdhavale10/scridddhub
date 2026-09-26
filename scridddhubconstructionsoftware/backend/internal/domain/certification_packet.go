package domain

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

type CertificationPacket struct {
	ID                    uuid.UUID
	ProjectID             uuid.UUID
	PeriodYear            int16
	PeriodQuarter         int16
	SentToProfessionalsAt *time.Time
	CreatedAt             time.Time
	UpdatedAt             time.Time
}

func (p *CertificationPacket) Validate() error {
	if p.ProjectID == uuid.Nil {
		return fmt.Errorf("project_id is required")
	}
	if p.PeriodQuarter < 1 || p.PeriodQuarter > 4 {
		return fmt.Errorf("period_quarter must be 1-4")
	}
	return nil
}

type DraftStatus string

const (
	DraftStatusDraft  DraftStatus = "draft"
	DraftStatusSigned DraftStatus = "signed"
)

// TowerCost is one line in EngineerDraft.CostByTower.
type TowerCost struct {
	TowerName    string `json:"tower_name"`
	AmountRupees int64  `json:"amount_rupees"`
}

// EngineerDraft — cost incurred by tower, cross-checked against Committed spend (Screen 16's
// cost-code rollup, not built yet — CommittedNotReflectedRupees is entered directly for now,
// see migration 000012's comment).
type EngineerDraft struct {
	ID                          uuid.UUID
	CertificationPacketID       uuid.UUID
	CostByTower                 []TowerCost
	CommittedNotReflectedRupees *int64
	SourceNote                  string
	Status                      DraftStatus
	SignedBy                    string
	SignedAt                    *time.Time
	CreatedAt                   time.Time
	UpdatedAt                   time.Time
}

// TotalIncurredRupees is derived, never stored — same reasoning as every other summed total in
// this codebase (LandTenure's landowner share, FinancialStructure's totals).
func (d *EngineerDraft) TotalIncurredRupees() int64 {
	var total int64
	for _, t := range d.CostByTower {
		total += t.AmountRupees
	}
	return total
}

type ArchitectCertificateStatus string

const (
	ArchitectCertificateStatusAwaitingSiteVisit ArchitectCertificateStatus = "awaiting_site_visit"
	ArchitectCertificateStatusCertified         ArchitectCertificateStatus = "certified"
)

// ArchitectCertificate has NO AI-draft path, ever (non-negotiable constraint,
// docs/domain-model.md) — CompletionPct can only be set once SiteVisitCompletedAt is non-nil.
// Enforced in usecase.CertificationPacketUsecase.SignArchitectCertificate, not just by this
// struct's shape.
type ArchitectCertificate struct {
	ID                    uuid.UUID
	CertificationPacketID uuid.UUID
	CompletionPct         *float64
	SiteVisitScheduledAt  *time.Time
	SiteVisitCompletedAt  *time.Time
	Status                ArchitectCertificateStatus
	SignedBy              string
	SignedAt              *time.Time
	CreatedAt             time.Time
	UpdatedAt             time.Time
}

// CADraft — escrow routing compliance (Buyer Collections + escrow bank statement, entered
// directly for now — see migration 000012's comment).
type CADraft struct {
	ID                           uuid.UUID
	CertificationPacketID        uuid.UUID
	CollectedFromBuyersRupees    int64
	RequiredEscrowPct            float64
	ActuallyRoutedToEscrowRupees int64
	SourceNote                   string
	Status                       DraftStatus
	SignedBy                     string
	SignedAt                     *time.Time
	CreatedAt                    time.Time
	UpdatedAt                    time.Time
}

func (d *CADraft) RequiredToEscrowRupees() int64 {
	return int64(float64(d.CollectedFromBuyersRupees) * d.RequiredEscrowPct / 100)
}

// escrowRoutingTolerancePct: a 2% relative tolerance band on the required-to-escrow figure.
// ASSUMPTION, not verified against real RERA guidance on acceptable escrow-routing variance.
// Calibrated (not guessed blind) against the wireframe's own worked example — ₹1.82 Cr required
// vs ₹1.8 Cr actual reads as "✓ within tolerance," a ~1.10% gap, so 1% would have called their
// own example non-compliant (caught live: an initial 1% guess did exactly that). 2% is the
// smallest round number that fits the one example we have, not a verified policy figure — get
// the real number from a CA/RERA source before this ships.
func (d *CADraft) RoutingCompliant() bool {
	required := d.RequiredToEscrowRupees()
	tolerance := int64(float64(required) * 0.02)
	return d.ActuallyRoutedToEscrowRupees >= required-tolerance
}
