package domain

import "testing"

// Varap 42/3 + 42/4/2 (2026-10-16): 2,091 sq m buildable per MahaRERA = 22,508 sq ft; flat prices
// from Varap listings; construction from estimator sites (Kalyan ₹2,530, Thane ₹2,970 per sq ft).
func varapCalc() BuilderCalcInputs {
	return BuilderCalcInputs{
		BuildableSqft: 22508, CarpetRatio: 0.72,
		SaleRateLow: 7000, SaleRateLikely: 8500, SaleRateHigh: 9500,
		BuildCostLow: 2500, BuildCostLikely: 2900, BuildCostHigh: 3300,
		SoftCostPct: 0.15, ProfitPct: 0.20,
	}
}

func TestBuilderCalcVarap(t *testing.T) {
	in := varapCalc()
	sc, area, err := in.Scenarios(0)
	if err != nil {
		t.Fatal(err)
	}
	if area != 22508 || len(sc) != 3 {
		t.Fatalf("area %v, %d scenarios", area, len(sc))
	}
	likely := sc[1]
	// carpet 16,205.76 sq ft × ₹8,500 = ₹13.77 cr; construction 22,508 × ₹2,900 = ₹6.53 cr;
	// soft 15% and profit 20% of sales; land ≈ ₹2.43 cr.
	if likely.Revenue != 137748960 || likely.Construction != 65273200 {
		t.Errorf("likely revenue %d construction %d", likely.Revenue, likely.Construction)
	}
	if likely.LandValue < 24_000_000 || likely.LandValue > 25_000_000 {
		t.Errorf("likely land value %d, want about ₹2.4 cr", likely.LandValue)
	}
	if sc[0].LandValue > 0 || sc[2].LandValue < 40_000_000 {
		t.Errorf("pessimistic %d (want ≤ 0), optimistic %d (want ≥ ₹4 cr)", sc[0].LandValue, sc[2].LandValue)
	}
	// At the break-even price the land is worth ₹0: 6,527 × … check it's between the scenarios' prices.
	if likely.BreakEvenRate < 6000 || likely.BreakEvenRate > 7000 {
		t.Errorf("break-even %d", likely.BreakEvenRate)
	}
}

func TestBuilderCalcUsesFSIAreaAndValidates(t *testing.T) {
	in := varapCalc()
	in.BuildableSqft = 0
	if _, area, err := in.Scenarios(10000); err != nil || area != 10000 {
		t.Errorf("area %v err %v, want the FSI band's 10,000", area, err)
	}
	if _, _, err := in.Scenarios(0); err != ErrBuilderCalcNoArea {
		t.Errorf("want ErrBuilderCalcNoArea, got %v", err)
	}
	bad := varapCalc()
	bad.SaleRateLow = 9000 // above likely
	if bad.Validate() == nil {
		t.Error("want an error when low > likely")
	}
}
