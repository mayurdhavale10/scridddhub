package domain

import (
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
)

// Valuation Summary (services/valuationsummary/README.md): for any parcel, what it's worth today,
// what it may be worth in ValuationHorizonYears, and how that compares with the asking price.
// The AI proposes per-acre rate ranges; everything else — totals, the comparison with the asking
// price, the verdict, and which projects may be cited — is decided here, in code.

// ValuationHorizonYears is how far ahead the future value looks (owner decision 2026-10-01: most
// planned projects near current parcels finish within five years).
const ValuationHorizonYears = 5

// ErrValuationNeedsArea: a total value can't be given for a parcel whose area isn't recorded
// ("Just checking a location" lets area be skipped).
var ErrValuationNeedsArea = errors.New("add the parcel's area to assess its value")

// ValuationInfra is one nearby project or place the valuation was given.
type ValuationInfra struct {
	Name       string   `json:"name"`
	Kind       string   `json:"kind"`
	Category   string   `json:"category"`
	Status     string   `json:"status,omitempty"` // planned projects only
	Completion string   `json:"completion,omitempty"`
	DistanceKm *float64 `json:"distance_km,omitempty"`
	Planned    bool     `json:"planned"`
}

// ValuationBasis is everything an assessment rested on, stored with it and shown as "Based on".
// The asking price is recorded but deliberately NOT given to the model: it would anchor the
// estimate to the seller's number, defeating the comparison.
type ValuationBasis struct {
	AsOf                     time.Time        `json:"as_of"`
	Location                 string           `json:"location"`
	AreaAcres                float64          `json:"area_acres"`
	Pinned                   bool             `json:"pinned"`
	ReadyReckonerPerAcre     *int64           `json:"ready_reckoner_per_acre,omitempty"`
	ReadyReckonerYear        string           `json:"ready_reckoner_year,omitempty"`
	NearbySalesCount         int              `json:"nearby_sales_count"`
	NearbySalesMonths        int              `json:"nearby_sales_months,omitempty"`
	NearbySalesMedianPerAcre *float64         `json:"nearby_sales_median_per_acre,omitempty"`
	Infrastructure           []ValuationInfra `json:"infrastructure,omitempty"`
	AskingPriceRupees        *int64           `json:"asking_price_rupees,omitempty"`
	Model                    string           `json:"model"`
}

// ValuationDraft is what the AI proposes: per-acre rate ranges now and in ValuationHorizonYears,
// why, and which given projects drive any change.
type ValuationDraft struct {
	CurrentLowPerAcre    float64
	CurrentLikelyPerAcre float64
	CurrentHighPerAcre   float64
	FutureLowPerAcre     float64
	FutureLikelyPerAcre  float64
	FutureHighPerAcre    float64
	Reasoning            string
	UpliftDrivers        []string
}

// Price comparison thresholds: within ±10% of the likely value counts as "near".
const nearAskingPct = 10.0

// BuildValuation turns an AI draft into the stored assessment: orders each range, multiplies by
// area, compares the likely value with the asking price, writes the verdict, and keeps only
// uplift drivers that name a project the model was actually given.
func BuildValuation(parcelID uuid.UUID, basis ValuationBasis, d ValuationDraft) (*FeasibilityAssessment, error) {
	if basis.AreaAcres <= 0 {
		return nil, ErrValuationNeedsArea
	}
	cur, err := orderedRange(d.CurrentLowPerAcre, d.CurrentLikelyPerAcre, d.CurrentHighPerAcre)
	if err != nil {
		return nil, fmt.Errorf("current value: %w", err)
	}
	fut, err := orderedRange(d.FutureLowPerAcre, d.FutureLikelyPerAcre, d.FutureHighPerAcre)
	if err != nil {
		return nil, fmt.Errorf("future value: %w", err)
	}
	total := func(perAcre float64) int64 { return int64(math.Round(perAcre * basis.AreaAcres)) }
	curLow, curHigh := total(cur[0]), total(cur[2])
	futLow, futHigh := total(fut[0]), total(fut[2])
	assessedAt := basis.AsOf

	a := &FeasibilityAssessment{
		LandParcelID:           parcelID,
		CurrentValuationRupees: total(cur[1]),
		FutureValuationRupees:  total(fut[1]),
		FutureValuationYear:    int16(basis.AsOf.Year() + ValuationHorizonYears),
		CurrentLowRupees:       &curLow,
		CurrentHighRupees:      &curHigh,
		FutureLowRupees:        &futLow,
		FutureHighRupees:       &futHigh,
		Method:                 "ai_assessed",
		Basis:                  basis,
		Reasoning:              strings.TrimSpace(d.Reasoning),
		Model:                  basis.Model,
		AssessedAt:             &assessedAt,
		InfrastructureNote:     strings.Join(citedDrivers(d.UpliftDrivers, basis.Infrastructure), "; "),
		ComparableSalesNote:    salesNote(basis),
	}
	a.MarginPct, a.Verdict = compareWithAsking(a.CurrentValuationRupees, basis.AskingPriceRupees)
	// With no registered sales and no government rate, the range rests only on the model's general
	// knowledge, which can be badly out of date (Dhamni, Karjat, 2026-10-08: it said ₹8 lakh/acre
	// where 2026 registered deals nearby were ₹33–50 lakh/acre). Such a guess must never judge the
	// seller's price.
	if !basis.HasMarketEvidence() && basis.AskingPriceRupees != nil {
		a.MarginPct, a.Verdict = nil, VerdictNoMarketEvidence
	}
	return a, nil
}

// VerdictNoMarketEvidence replaces the price comparison when there's nothing real to compare with.
const VerdictNoMarketEvidence = "Not enough market evidence to judge the asking price"

// HasMarketEvidence: registered sales nearby or a government Ready Reckoner rate.
func (b ValuationBasis) HasMarketEvidence() bool {
	return (b.NearbySalesCount > 0 && b.NearbySalesMedianPerAcre != nil) || b.ReadyReckonerPerAcre != nil
}

// orderedRange sorts low/likely/high and rejects non-positive or absurd values.
func orderedRange(low, likely, high float64) ([3]float64, error) {
	v := []float64{low, likely, high}
	for _, x := range v {
		if x <= 0 || math.IsNaN(x) || math.IsInf(x, 0) {
			return [3]float64{}, fmt.Errorf("rate must be positive, got %v", x)
		}
	}
	sort.Float64s(v)
	return [3]float64{v[0], v[1], v[2]}, nil
}

// compareWithAsking: margin is how far the likely value is above (+) or below (−) the asking
// price, in percent of the asking price — the "est. margin" the Compare screen already ranks by.
func compareWithAsking(likely int64, asking *int64) (*float64, string) {
	if asking == nil || *asking <= 0 {
		return nil, "No asking price to compare"
	}
	m := math.Round((float64(likely)-float64(*asking))/float64(*asking)*1000) / 10
	m = math.Max(-999.99, math.Min(999.99, m)) // column is NUMERIC(5,2)
	switch {
	case m >= nearAskingPct:
		return &m, "Asking price below estimated value"
	case m <= -nearAskingPct:
		return &m, "Asking price above estimated value"
	default:
		return &m, "Asking price near estimated value"
	}
}

// citedDrivers keeps only drivers that mention a project from the list the model was given — a
// driver naming anything else is an invented project and is dropped.
func citedDrivers(drivers []string, given []ValuationInfra) []string {
	var out []string
	for _, d := range drivers {
		d = strings.TrimSpace(d)
		low := strings.ToLower(d)
		for _, g := range given {
			if g.Name != "" && strings.Contains(low, strings.ToLower(g.Name)) {
				out = append(out, d)
				break
			}
		}
	}
	return out
}

func salesNote(b ValuationBasis) string {
	if b.NearbySalesCount == 0 || b.NearbySalesMedianPerAcre == nil {
		return "No registered sales on record nearby yet"
	}
	return fmt.Sprintf("%d registered sales nearby in %d months, median ₹%.0f per acre",
		b.NearbySalesCount, b.NearbySalesMonths, *b.NearbySalesMedianPerAcre)
}
