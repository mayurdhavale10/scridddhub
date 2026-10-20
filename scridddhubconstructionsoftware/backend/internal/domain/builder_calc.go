package domain

import (
	"errors"
	"fmt"
	"math"
)

// The builder's view of the land (residual land value): what a developer could sell on it, minus
// what it costs to build and sell, minus their profit, leaves what the land is worth to them.
// Every input is typed by our team with its source, and the result is shown as three scenarios,
// never one number: the inputs (flat prices, construction cost) are estimates, and the answer
// swings a lot with them (Varap 42/3+42/4/2: about ₹0 to ₹4.4 crore).

// BuilderCalcInputs are what the team enters. Rates are ₹ per sq ft; percentages are of sales.
type BuilderCalcInputs struct {
	// BuildableSqft is the built-up area allowed; 0 means use the FSI band's figure.
	BuildableSqft float64 `json:"buildable_sqft"`
	// CarpetRatio is the share of built-up area sold as carpet area (typically 0.65–0.80).
	CarpetRatio float64 `json:"carpet_ratio"`
	// Flat prices per sq ft of carpet area: low, likely, high.
	SaleRateLow    int64 `json:"sale_rate_low"`
	SaleRateLikely int64 `json:"sale_rate_likely"`
	SaleRateHigh   int64 `json:"sale_rate_high"`
	// Construction cost per sq ft of built-up area: low, likely, high.
	BuildCostLow    int64 `json:"build_cost_low"`
	BuildCostLikely int64 `json:"build_cost_likely"`
	BuildCostHigh   int64 `json:"build_cost_high"`
	// SoftCostPct covers approvals, premiums, marketing, finance and taxes, as a share of sales.
	SoftCostPct float64 `json:"soft_cost_pct"`
	// ProfitPct is the developer's required margin, as a share of sales.
	ProfitPct float64 `json:"profit_pct"`
	// Sources says where each input came from (listings, contractor quotes, RERA filings).
	Sources string `json:"sources"`
}

// BuilderScenario is one line of the result, in ₹.
type BuilderScenario struct {
	Name          string `json:"name"` // pessimistic | likely | optimistic
	SaleRate      int64  `json:"sale_rate"`
	BuildCost     int64  `json:"build_cost"`
	Revenue       int64  `json:"revenue"`
	Construction  int64  `json:"construction"`
	SoftCosts     int64  `json:"soft_costs"`
	Profit        int64  `json:"profit"`
	LandValue     int64  `json:"land_value"`      // can be negative: the project doesn't pay for the land
	BreakEvenRate int64  `json:"break_even_rate"` // flat price per sq ft carpet at which the land is worth ₹0
}

var ErrBuilderCalcNoArea = errors.New("buildable area unknown: enter it, or set the planning authority and road width so the FSI band gives it")

func (in *BuilderCalcInputs) Validate() error {
	if in.BuildableSqft < 0 {
		return fmt.Errorf("buildable area can't be negative")
	}
	if in.CarpetRatio <= 0 || in.CarpetRatio > 1 {
		return fmt.Errorf("carpet ratio must be between 0 and 1 (e.g. 0.72)")
	}
	if in.SaleRateLow <= 0 || in.SaleRateLow > in.SaleRateLikely || in.SaleRateLikely > in.SaleRateHigh {
		return fmt.Errorf("flat prices must be positive and low ≤ likely ≤ high")
	}
	if in.BuildCostLow <= 0 || in.BuildCostLow > in.BuildCostLikely || in.BuildCostLikely > in.BuildCostHigh {
		return fmt.Errorf("construction costs must be positive and low ≤ likely ≤ high")
	}
	if in.SoftCostPct < 0 || in.ProfitPct < 0 || in.SoftCostPct+in.ProfitPct >= 1 {
		return fmt.Errorf("soft costs and profit must be shares of sales (e.g. 0.15 and 0.20) adding up to less than 1")
	}
	return nil
}

// Scenarios works out pessimistic (low prices, high costs), likely, and optimistic (high prices,
// low costs). buildableSqft is the area to use when the inputs don't give one.
func (in *BuilderCalcInputs) Scenarios(buildableSqft float64) ([]BuilderScenario, float64, error) {
	if err := in.Validate(); err != nil {
		return nil, 0, err
	}
	area := in.BuildableSqft
	if area == 0 {
		area = buildableSqft
	}
	if area <= 0 {
		return nil, 0, ErrBuilderCalcNoArea
	}
	carpet := area * in.CarpetRatio
	one := func(name string, sale, cost int64) BuilderScenario {
		revenue := carpet * float64(sale)
		construction := area * float64(cost)
		soft := revenue * in.SoftCostPct
		profit := revenue * in.ProfitPct
		// Land = carpet×rate×(1 − soft − profit) − construction, so it's ₹0 at this rate.
		breakEven := construction / (carpet * (1 - in.SoftCostPct - in.ProfitPct))
		return BuilderScenario{
			Name: name, SaleRate: sale, BuildCost: cost,
			Revenue: round(revenue), Construction: round(construction), SoftCosts: round(soft), Profit: round(profit),
			LandValue: round(revenue - construction - soft - profit), BreakEvenRate: round(breakEven),
		}
	}
	return []BuilderScenario{
		one("pessimistic", in.SaleRateLow, in.BuildCostHigh),
		one("likely", in.SaleRateLikely, in.BuildCostLikely),
		one("optimistic", in.SaleRateHigh, in.BuildCostLow),
	}, area, nil
}

func round(v float64) int64 { return int64(math.Round(v)) }
