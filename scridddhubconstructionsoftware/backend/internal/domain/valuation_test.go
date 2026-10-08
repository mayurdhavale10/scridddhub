package domain

import (
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
)

func basis(area float64, asking *int64) ValuationBasis {
	return ValuationBasis{
		AsOf:      time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC),
		AreaAcres: area,
		Infrastructure: []ValuationInfra{
			{Name: "Metro Line 12", Kind: "metro", Planned: true},
		},
		AskingPriceRupees: asking,
		Model:             "test-model",
	}
}

func i64(v int64) *int64 { return &v }

func TestBuildValuation_TotalsRangeAndHorizon(t *testing.T) {
	// Range given out of order: it must be sorted, then multiplied by area.
	a, err := BuildValuation(uuid.UUID{1}, basis(2, nil), ValuationDraft{
		CurrentLowPerAcre: 1.2e7, CurrentLikelyPerAcre: 1.0e7, CurrentHighPerAcre: 0.8e7,
		FutureLowPerAcre: 1.3e7, FutureLikelyPerAcre: 1.6e7, FutureHighPerAcre: 2.0e7,
	})
	if err != nil {
		t.Fatal(err)
	}
	if *a.CurrentLowRupees != 1.6e7 || a.CurrentValuationRupees != 2.0e7 || *a.CurrentHighRupees != 2.4e7 {
		t.Errorf("current range = %d/%d/%d", *a.CurrentLowRupees, a.CurrentValuationRupees, *a.CurrentHighRupees)
	}
	if a.FutureValuationRupees != 3.2e7 || a.FutureValuationYear != 2031 {
		t.Errorf("future = %d in %d", a.FutureValuationRupees, a.FutureValuationYear)
	}
	if a.Verdict != "No asking price to compare" || a.MarginPct != nil {
		t.Errorf("without an asking price: verdict %q margin %v", a.Verdict, a.MarginPct)
	}
	if a.Method != "ai_assessed" || a.AssessedAt == nil {
		t.Error("an assessment must record how and when it was made")
	}
}

func TestBuildValuation_ComparesLikelyValueWithAsking(t *testing.T) {
	draft := ValuationDraft{CurrentLowPerAcre: 1e7, CurrentLikelyPerAcre: 1e7, CurrentHighPerAcre: 1e7,
		FutureLowPerAcre: 1e7, FutureLikelyPerAcre: 1e7, FutureHighPerAcre: 1e7}
	cases := []struct {
		asking  int64
		verdict string
		margin  float64
	}{
		{1.5e7, "Asking price below estimated value", 33.3}, // worth 2 Cr, asked 1.5 Cr
		{2.0e7, "Asking price near estimated value", 0},
		{2.5e7, "Asking price above estimated value", -20},
	}
	median := 1e7
	for _, c := range cases {
		b := basis(2, i64(c.asking))
		b.NearbySalesCount, b.NearbySalesMonths, b.NearbySalesMedianPerAcre = 4, 24, &median
		a, err := BuildValuation(uuid.UUID{1}, b, draft)
		if err != nil {
			t.Fatal(err)
		}
		if a.Verdict != c.verdict || a.MarginPct == nil || *a.MarginPct != c.margin {
			t.Errorf("asking %d: got %q %v, want %q %v", c.asking, a.Verdict, a.MarginPct, c.verdict, c.margin)
		}
	}
}

func TestBuildValuation_NoMarketEvidenceNeverJudgesThePrice(t *testing.T) {
	// No registered sales, no Ready Reckoner rate: the range is only the model's general knowledge.
	draft := ValuationDraft{CurrentLowPerAcre: 5e5, CurrentLikelyPerAcre: 8e5, CurrentHighPerAcre: 12e5,
		FutureLowPerAcre: 6e5, FutureLikelyPerAcre: 1e6, FutureHighPerAcre: 1.5e6}
	a, err := BuildValuation(uuid.UUID{1}, basis(12.51, i64(12.51e7)), draft)
	if err != nil {
		t.Fatal(err)
	}
	if a.Verdict != VerdictNoMarketEvidence || a.MarginPct != nil {
		t.Errorf("got %q margin %v; a guess must not judge the asking price", a.Verdict, a.MarginPct)
	}
	rr := int64(2e6)
	b := basis(12.51, i64(12.51e7))
	b.ReadyReckonerPerAcre = &rr
	if a, _ := BuildValuation(uuid.UUID{1}, b, draft); a.MarginPct == nil {
		t.Error("a government rate is evidence: the price should be compared")
	}
}

func TestBuildValuation_DropsInventedProjectsAndNeedsArea(t *testing.T) {
	a, _ := BuildValuation(uuid.UUID{1}, basis(1, nil), ValuationDraft{
		CurrentLowPerAcre: 1, CurrentLikelyPerAcre: 1, CurrentHighPerAcre: 1,
		FutureLowPerAcre: 1, FutureLikelyPerAcre: 1, FutureHighPerAcre: 1,
		UpliftDrivers: []string{"Metro Line 12 opening nearby", "A new airport next door"},
	})
	if a.InfrastructureNote != "Metro Line 12 opening nearby" {
		t.Errorf("only drivers naming a given project may stay, got %q", a.InfrastructureNote)
	}
	if _, err := BuildValuation(uuid.UUID{1}, basis(0, nil), ValuationDraft{}); !errors.Is(err, ErrValuationNeedsArea) {
		t.Errorf("no area must be refused, got %v", err)
	}
	if _, err := BuildValuation(uuid.UUID{1}, basis(1, nil), ValuationDraft{CurrentLowPerAcre: -1}); err == nil {
		t.Error("non-positive rates must be refused")
	}
}
