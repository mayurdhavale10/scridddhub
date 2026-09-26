package domain

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

type LandParcelStage string

const (
	LandParcelStageSourced     LandParcelStage = "sourced"
	LandParcelStageScreened    LandParcelStage = "screened"
	LandParcelStageDD          LandParcelStage = "dd"
	LandParcelStageNegotiating LandParcelStage = "negotiating"
)

func (s LandParcelStage) Valid() bool {
	switch s {
	case LandParcelStageSourced, LandParcelStageScreened, LandParcelStageDD, LandParcelStageNegotiating:
		return true
	default:
		return false
	}
}

type LandParcel struct {
	ID         uuid.UUID
	ProjectID uuid.UUID
	Name      string
	Location  string
	// AreaAcres is nil when a "just checking a location" parcel (Screen 4.2) was saved before the
	// area was known/entered — that flow explicitly marks area as optional, unlike Screen 4.1's
	// "I have a price" flow where it's still required.
	AreaAcres *float64
	// CostRupees is nil for a parcel added through the "just checking a location" flow (Screen
	// 4.2) — someone scouting, not yet entering a real deal with an asking price. Never defaults
	// to 0; nil and "priced at zero" are different facts.
	CostRupees *int64
	FSI        *float64
	// Source records where the builder found out about this parcel (broker, online listing,
	// referral, a field survey, ...). Provenance metadata only — doesn't drive any business rule,
	// so it's a free-form string rather than a constrained enum.
	Source *string
	// SourceURL is the actual listing/portal link backing up Source (e.g. the 99acres/MagicBricks
	// URL, or a DP portal reservation reference) — makes the source a checkable fact instead of
	// just a label. Optional: not every source (a broker phone call, a field survey) has a link.
	SourceURL *string
	// SourceVerifiedAt is set only after a real reachability check against SourceURL succeeded
	// (see VerifySourceURL) — never set on creation, never guessed. A failed check leaves this
	// untouched rather than recording a possibly-transient failure as permanent history.
	SourceVerifiedAt *time.Time
	// District/Taluka/Village are structured location fields, set only when known (the "Just
	// checking a location" flow already collects these via the Ready Reckoner picker — Screen
	// 4.1's free-text Location flow leaves them nil). They exist so a future closed transaction on
	// this parcel can be matched to a Ready-Reckoner-granularity training bucket without first
	// solving free-text location matching (see docs/adr/0005). Never used for display in place of
	// Location — Location remains the one free-text field every parcel has.
	District *string
	Taluka   *string
	Village  *string
	// ClosedPriceRupees/ClosedAt record the real, final transacted price once a deal actually
	// closes — distinct from CostRupees (an asking price, captured once at creation, never
	// re-verified). Only these two fields are legitimate ground truth for a future pricing model;
	// see docs/adr/0005 for why asking price is not used for that purpose.
	ClosedPriceRupees *int64
	ClosedAt          *time.Time
	Stage             LandParcelStage
	Notes     string
	CreatedAt time.Time
	UpdatedAt time.Time
}

func (p *LandParcel) Validate() error {
	if p.Name == "" {
		return fmt.Errorf("name is required")
	}
	if p.ProjectID == uuid.Nil {
		return fmt.Errorf("project_id is required")
	}
	if p.AreaAcres != nil && *p.AreaAcres <= 0 {
		return fmt.Errorf("area_acres must be positive")
	}
	if p.CostRupees != nil {
		if *p.CostRupees <= 0 {
			return fmt.Errorf("cost_rupees must be positive")
		}
		// A priced deal (Flow A, Screen 4.1) needs an area to make sense of that price anywhere
		// else in the app (valuation math, comparables) — only a price-less "just checking a
		// location" parcel (Flow B) can skip area entirely.
		if p.AreaAcres == nil {
			return fmt.Errorf("area_acres is required when cost_rupees is set")
		}
	}
	if !p.Stage.Valid() {
		return fmt.Errorf("invalid stage: %q", p.Stage)
	}
	if p.ClosedPriceRupees != nil {
		if *p.ClosedPriceRupees <= 0 {
			return fmt.Errorf("closed_price_rupees must be positive")
		}
		if p.AreaAcres == nil {
			return fmt.Errorf("area_acres is required when closed_price_rupees is set")
		}
	}
	return nil
}

// The old comparable-based PriceEstimate/EstimatePrice (which compared a parcel against other
// parcels already in the same project) was removed 2026-09-19 per docs/adr/0004 — the estimate
// must never depend on what other parcels happen to exist in this app. See
// domain.EstimateLocationValue (ready_reckoner_rate.go) for its replacement.
