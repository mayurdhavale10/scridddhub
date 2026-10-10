package domain

import (
	"fmt"
	"strings"
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
	ID        uuid.UUID
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
	// SurveyNumber is the survey/gat number with hissa as written on the 7/12 (e.g. "45/2A").
	// With District/Taluka/Village it identifies the land in the government's land records.
	SurveyNumber *string
	// Latitude/Longitude are where the parcel actually is, captured from the person who knows
	// (docs/design/parcel-location-first-principles.md): nil until someone pins it. Nearby and
	// planned infrastructure use these first and fall back to geocoding Location.
	Latitude       *float64
	Longitude      *float64
	LocationSource *string // pin | gps | maps_link | village | text
	LocationSetAt  *time.Time
	// ClosedPriceRupees/ClosedAt record the real, final transacted price once a deal actually
	// closes — distinct from CostRupees (an asking price, captured once at creation, never
	// re-verified). Only these two fields are legitimate ground truth for a future pricing model;
	// see docs/adr/0005 for why asking price is not used for that purpose.
	ClosedPriceRupees *int64
	ClosedAt          *time.Time
	Stage             LandParcelStage
	Notes             string
	CreatedAt         time.Time
	UpdatedAt         time.Time
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
	if (p.Latitude == nil) != (p.Longitude == nil) {
		return fmt.Errorf("latitude and longitude go together")
	}
	if p.Latitude != nil {
		source := ""
		if p.LocationSource != nil {
			source = *p.LocationSource
		}
		if err := ValidateParcelLocation(*p.Latitude, *p.Longitude, source); err != nil {
			return err
		}
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

// MissingLandRecordIDs lists what's still needed to look the parcel up in the land records
// (7/12, Ferfar, Index-II): survey number, village, taluka and district.
func (p *LandParcel) MissingLandRecordIDs() []string {
	var missing []string
	for _, f := range []struct {
		name string
		v    *string
	}{{"survey number", p.SurveyNumber}, {"village", p.Village}, {"taluka", p.Taluka}, {"district", p.District}} {
		if f.v == nil || strings.TrimSpace(*f.v) == "" {
			missing = append(missing, f.name)
		}
	}
	return missing
}

// ValidateSurveyNumber accepts survey/gat numbers as written on a 7/12: digits with an optional
// hissa ("45", "45/2", "45/2A", "112/1/B", "45 पैकी").
func ValidateSurveyNumber(s string) error {
	s = strings.TrimSpace(s)
	if s == "" {
		return fmt.Errorf("survey number is required")
	}
	if len(s) > 40 {
		return fmt.Errorf("survey number is too long")
	}
	if !strings.ContainsAny(s, "0123456789०१२३४५६७८९") {
		return fmt.Errorf("survey number must contain a number, e.g. 45/2A")
	}
	return nil
}

// ParcelLocationSources are how a parcel's coordinates were obtained, most to least precise.
var ParcelLocationSources = []string{"pin", "gps", "maps_link", "village", "text"}

// India's extent, generously padded: a point outside it is a typo or swapped lat/lng, not land
// anyone here is buying.
const (
	indiaMinLat, indiaMaxLat = 6.0, 37.5
	indiaMinLng, indiaMaxLng = 68.0, 97.5
)

// ValidateParcelLocation checks a pinned location before it's stored.
func ValidateParcelLocation(lat, lng float64, source string) error {
	if lat < indiaMinLat || lat > indiaMaxLat || lng < indiaMinLng || lng > indiaMaxLng {
		return fmt.Errorf("location %.5f,%.5f is outside India (latitude and longitude swapped?)", lat, lng)
	}
	for _, s := range ParcelLocationSources {
		if s == source {
			return nil
		}
	}
	return fmt.Errorf("location_source must be one of %v, got %q", ParcelLocationSources, source)
}

// The old comparable-based PriceEstimate/EstimatePrice (which compared a parcel against other
// parcels already in the same project) was removed 2026-09-19 per docs/adr/0004 — the estimate
// must never depend on what other parcels happen to exist in this app. See
// domain.EstimateLocationValue (ready_reckoner_rate.go) for its replacement.
