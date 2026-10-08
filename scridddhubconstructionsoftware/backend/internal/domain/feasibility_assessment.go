package domain

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

type FeasibilityAssessment struct {
	ID                     uuid.UUID
	LandParcelID           uuid.UUID
	CurrentValuationRupees int64
	FutureValuationRupees  int64
	FutureValuationYear    int16
	Verdict                string
	ComparedParcelID       *uuid.UUID
	MarginPct              *float64
	InfrastructureNote     string
	ComparableSalesNote    string
	CreatedAt              time.Time
	UpdatedAt              time.Time

	// Set by Assess (Valuation Summary); nil/empty for a manually entered assessment.
	// CurrentValuationRupees / FutureValuationRupees hold the "likely" value of each range.
	CurrentLowRupees  *int64
	CurrentHighRupees *int64
	FutureLowRupees   *int64
	FutureHighRupees  *int64
	Method            string // manual | ai_assessed
	Basis             ValuationBasis
	Reasoning         string
	Model             string
	AssessedAt        *time.Time
}

func (a *FeasibilityAssessment) Validate() error {
	if a.LandParcelID == uuid.Nil {
		return fmt.Errorf("land_parcel_id is required")
	}
	if a.CurrentValuationRupees <= 0 {
		return fmt.Errorf("current_valuation_rupees must be positive")
	}
	if a.FutureValuationRupees <= 0 {
		return fmt.Errorf("future_valuation_rupees must be positive")
	}
	if a.FutureValuationYear <= 0 {
		return fmt.Errorf("future_valuation_year is required")
	}
	if a.Verdict == "" {
		return fmt.Errorf("verdict is required")
	}
	return nil
}
