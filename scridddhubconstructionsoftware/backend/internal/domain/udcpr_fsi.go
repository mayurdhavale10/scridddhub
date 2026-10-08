package domain

import "fmt"

// Indicative FSI under Maharashtra's UDCPR 2020, Table 6-G (non-congested areas, Reg. 6.3),
// read from the sanctioned regulations notified 2 Dec 2020. Amendments after Jan 2023 aren't
// checked yet, so the result is always shown as a band an architect confirms, never as final.
// UDCPR doesn't apply in Mumbai (DCPR 2034), NAINA or CIDCO nodes (their own rules), so those
// return ErrFSIUnsupported rather than a guess.

// Planning authority types as Table 6-G groups them.
const (
	AuthorityMunicipalCorporation = "municipal_corporation" // "All Municipal Corporations"
	AuthorityOther                = "other"                 // councils, nagar panchayats, PMRDA/MMRDA areas, RP areas with a planning authority
	AuthorityRegionalPlanNoPA     = "regional_plan_no_pa"   // Regional Plan area with no planning authority: no TDR (note ii)
	AuthorityMumbai               = "mumbai"                // DCPR 2034
	AuthorityCIDCO                = "cidco_naina"           // NAINA and CIDCO nodes
)

var PlanningAuthorities = []string{AuthorityMunicipalCorporation, AuthorityOther, AuthorityRegionalPlanNoPA, AuthorityMumbai, AuthorityCIDCO}

var ErrFSIUnsupported = fmt.Errorf("UDCPR doesn't apply here; FSI follows the authority's own regulations")

type fsiBand struct {
	minRoad, maxRoad    float64 // metres; maxRoad 0 = no upper limit
	basic, premium, tdr float64
}

var udcprTable6G = map[string][]fsiBand{
	AuthorityMunicipalCorporation: {
		{0, 9, 1.10, 0, 0},
		{9, 12, 1.10, 0.50, 0.40},
		{12, 15, 1.10, 0.50, 0.65},
		{15, 24, 1.10, 0.50, 0.90},
		{24, 30, 1.10, 0.50, 1.15},
		{30, 0, 1.10, 0.50, 1.40},
	},
	AuthorityOther: {
		{0, 9, 1.10, 0, 0},
		{9, 12, 1.10, 0.30, 0.30},
		{12, 15, 1.10, 0.30, 0.60},
		{15, 24, 1.10, 0.30, 0.70},
		{24, 30, 1.10, 0.30, 0.90},
		{30, 0, 1.10, 0.30, 1.10},
	},
	// Same premium as "other", but the TDR column doesn't apply without a planning authority.
	AuthorityRegionalPlanNoPA: {
		{0, 9, 1.10, 0, 0},
		{9, 0, 1.10, 0.30, 0},
	},
}

// FSIBand is the indicative development potential for one plot.
type FSIBand struct {
	Basic, Premium, TDR float64
	// Max is basic + premium + TDR. MaxWithAncillary adds ancillary FSI (up to 60% for
	// residential use, Table 6-G note i), which is optional and charged at a premium.
	Max, MaxWithAncillary float64
	Source                string
}

// UDCPRFSIBand looks up Table 6-G for a residential plot. roadWidthM is the width of the road the
// plot takes access from (the major road, per note iv).
func UDCPRFSIBand(authority string, roadWidthM float64) (*FSIBand, error) {
	if authority == AuthorityMumbai || authority == AuthorityCIDCO {
		return nil, ErrFSIUnsupported
	}
	bands, ok := udcprTable6G[authority]
	if !ok {
		return nil, fmt.Errorf("unknown planning authority %q", authority)
	}
	if roadWidthM <= 0 {
		return nil, fmt.Errorf("road width must be positive")
	}
	for _, b := range bands {
		if roadWidthM >= b.minRoad && (b.maxRoad == 0 || roadWidthM < b.maxRoad) {
			max := round2(b.basic + b.premium + b.tdr)
			return &FSIBand{
				Basic: b.basic, Premium: b.premium, TDR: b.tdr,
				Max: max, MaxWithAncillary: round2(max * 1.6),
				Source: "UDCPR 2020, Table 6-G (non-congested, residential)",
			}, nil
		}
	}
	return nil, fmt.Errorf("no Table 6-G band for a %.1f m road", roadWidthM)
}

func round2(v float64) float64 {
	return float64(int64(v*100+0.5)) / 100
}
