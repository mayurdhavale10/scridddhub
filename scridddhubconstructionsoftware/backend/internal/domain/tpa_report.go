package domain

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

type TPAReportStatus string

const (
	TPAReportStatusDraft     TPAReportStatus = "draft"
	TPAReportStatusSubmitted TPAReportStatus = "submitted"
)

// TPAReport (Screen 8.16) — the actual per-lender TPA/QPR submission document, assembled from
// figures already certified elsewhere on the platform (physical progress from the architect
// certificate, cost incurred from the engineer draft, DSCR/security cover from LenderCovenant).
// "Drafted, not filed automatically": a finance team member reviews and marks it submitted —
// same "AI drafts, human sends" discipline as everywhere else in this build.
type TPAReport struct {
	ID              uuid.UUID
	ProjectID       uuid.UUID
	LenderName      string
	TemplateVersion string
	PeriodYear      int16
	PeriodQuarter   int16

	PhysicalProgressPct float64
	CostIncurredRupees  int64
	DSCR                float64
	SecurityCoverRatio  float64
	UnitsSold           int32
	UnitsTotal          int32

	Status      TPAReportStatus
	SubmittedAt *time.Time

	CreatedAt time.Time
	UpdatedAt time.Time
}

// SalesVelocityPct is derived at read time, never stored — same reasoning as every other
// ratio in this build (LandTenure's landowner share, FinancialStructure's balanced flag).
func (r *TPAReport) SalesVelocityPct() float64 {
	if r.UnitsTotal == 0 {
		return 0
	}
	return float64(r.UnitsSold) / float64(r.UnitsTotal) * 100
}

func (r *TPAReport) Validate() error {
	if r.ProjectID == uuid.Nil {
		return fmt.Errorf("project_id is required")
	}
	if r.LenderName == "" {
		return fmt.Errorf("lender_name is required")
	}
	if r.TemplateVersion == "" {
		return fmt.Errorf("template_version is required")
	}
	if r.PeriodQuarter < 1 || r.PeriodQuarter > 4 {
		return fmt.Errorf("period_quarter must be between 1 and 4")
	}
	if r.UnitsTotal <= 0 {
		return fmt.Errorf("units_total must be positive")
	}
	if r.UnitsSold < 0 || r.UnitsSold > r.UnitsTotal {
		return fmt.Errorf("units_sold must be between 0 and units_total")
	}
	return nil
}
