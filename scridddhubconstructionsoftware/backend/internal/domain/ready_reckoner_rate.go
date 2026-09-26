package domain

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

// ReadyReckonerRate is one government-published Maharashtra e-ASR rate for a specific
// village/zone, for one effective year — see services/estimatedparcelvalue/README.md for the full
// research behind this. Reference/master data, not something a user of the app edits.
type ReadyReckonerRate struct {
	ID                uuid.UUID
	District          string
	Taluka            string
	Village           string
	ZoneNo            string
	RatePerSqmRupees  int64
	EffectiveYear     string
	SourceURL         string
	VerifiedAt        time.Time
	VerifiedBy        string
	Note              string
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

func (r *ReadyReckonerRate) Validate() error {
	if r.District == "" || r.Taluka == "" || r.Village == "" {
		return fmt.Errorf("district, taluka, and village are all required")
	}
	if r.RatePerSqmRupees <= 0 {
		return fmt.Errorf("rate_per_sqm_rupees must be positive")
	}
	if r.EffectiveYear == "" {
		return fmt.Errorf("effective_year is required")
	}
	if r.SourceURL == "" {
		return fmt.Errorf("source_url is required — every rate must be checkable against the live portal")
	}
	if r.VerifiedBy == "" {
		return fmt.Errorf("verified_by is required — every rate must record who confirmed it")
	}
	return nil
}

// sqmPerAcre is the exact conversion factor (1 acre = 4046.8564224 m²).
const sqmPerAcre = 4046.8564224

// LocationValueEstimate is the result of the Estimate Value feature — a standalone valuation
// grounded in one location's own government-published rate, never a comparison against other
// parcels in this app (see docs/adr/0004). Deliberately does NOT apply an FSI multiplier: the
// Ready Reckoner Rate is itself the government's own assessed land value, and layering a
// buildable-area multiplier on top would be a separate, currently-unverified modeling assumption,
// not something to silently bake in.
//
// Confirmed live 2026-09-19 (Kakadapada, Kalyan, Thane): this rate is a legal FLOOR used to
// calculate minimum stamp duty, not a market estimate — the seeded rate came in at ~1/35th of a
// real registered asking price for a similarly-sized parcel in the same area. This is expected in
// fast-appreciating markets, not a bug. The caller (handler/mobile UI) must present this as a
// government floor value, never label it as "the market value."
type LocationValueEstimate struct {
	District             string
	Taluka               string
	Village              string
	ZoneNo               string
	RatePerSqmRupees     int64
	EffectiveYear        string
	SourceURL            string
	VerifiedAt           time.Time
	AreaSqm              float64
	EstimatedValueRupees int64
}

// EstimateLocationValue computes rate × area — nothing else. areaAcres must already be validated
// positive by the caller.
func EstimateLocationValue(rate *ReadyReckonerRate, areaAcres float64) *LocationValueEstimate {
	areaSqm := areaAcres * sqmPerAcre
	return &LocationValueEstimate{
		District:             rate.District,
		Taluka:               rate.Taluka,
		Village:              rate.Village,
		ZoneNo:               rate.ZoneNo,
		RatePerSqmRupees:     rate.RatePerSqmRupees,
		EffectiveYear:        rate.EffectiveYear,
		SourceURL:            rate.SourceURL,
		VerifiedAt:           rate.VerifiedAt,
		AreaSqm:              areaSqm,
		EstimatedValueRupees: int64(float64(rate.RatePerSqmRupees) * areaSqm),
	}
}
