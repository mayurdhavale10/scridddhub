package domain

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

// FinancialStructure is Screen 8's Sources & Uses summary. Totals and the balanced check are
// derived, never stored — see TotalSources/TotalUses/Balanced below and the migration comment
// on why.
type FinancialStructure struct {
	ID        uuid.UUID
	ProjectID uuid.UUID

	BuyerCollectionsRupees    int64
	PromoterEquityRupees      int64
	ConstructionFinanceRupees int64

	ConstructionUseRupees   int64
	LandUseRupees           int64
	ApprovalsUseRupees      int64
	MarketingUseRupees      int64
	WorkingCapitalUseRupees int64

	CreatedAt time.Time
	UpdatedAt time.Time
}

func (f *FinancialStructure) TotalSourcesRupees() int64 {
	return f.BuyerCollectionsRupees + f.PromoterEquityRupees + f.ConstructionFinanceRupees
}

func (f *FinancialStructure) TotalUsesRupees() int64 {
	return f.ConstructionUseRupees + f.LandUseRupees + f.ApprovalsUseRupees +
		f.MarketingUseRupees + f.WorkingCapitalUseRupees
}

func (f *FinancialStructure) Balanced() bool {
	return f.TotalSourcesRupees() == f.TotalUsesRupees()
}

func (f *FinancialStructure) Validate() error {
	if f.ProjectID == uuid.Nil {
		return fmt.Errorf("project_id is required")
	}
	return nil
}
