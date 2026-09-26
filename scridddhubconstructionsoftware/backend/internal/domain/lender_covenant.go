package domain

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

// LenderCovenant (Screen 8.13) — DSCR and security cover are compared against their covenant
// minimums at read time; a breach is meant to be found here, not discovered when the lender
// freezes the next drawdown without warning (the screen's own framing).
type LenderCovenant struct {
	ID                       uuid.UUID
	ProjectID                uuid.UUID
	DSCR                     float64
	DSCRCovenantMin          float64
	SecurityCoverRatio       float64
	SecurityCoverCovenantMin float64
	NextTPAReportDueAt       time.Time
	CreatedAt                time.Time
	UpdatedAt                time.Time
}

func (c *LenderCovenant) DSCRBreached() bool {
	return c.DSCR < c.DSCRCovenantMin
}

func (c *LenderCovenant) SecurityCoverBreached() bool {
	return c.SecurityCoverRatio < c.SecurityCoverCovenantMin
}

func (c *LenderCovenant) AnyBreach() bool {
	return c.DSCRBreached() || c.SecurityCoverBreached()
}

func (c *LenderCovenant) Validate() error {
	if c.ProjectID == uuid.Nil {
		return fmt.Errorf("project_id is required")
	}
	if c.NextTPAReportDueAt.IsZero() {
		return fmt.Errorf("next_tpa_report_due_at is required")
	}
	return nil
}
