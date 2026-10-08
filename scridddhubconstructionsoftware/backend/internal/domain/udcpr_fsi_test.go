package domain

import (
	"errors"
	"testing"
)

func TestUDCPRFSIBand(t *testing.T) {
	cases := []struct {
		authority string
		road      float64
		max       float64
		withAnc   float64
	}{
		{AuthorityMunicipalCorporation, 6, 1.10, 1.76},
		{AuthorityMunicipalCorporation, 9, 2.00, 3.20}, // band minimum is inclusive
		{AuthorityMunicipalCorporation, 30, 3.00, 4.80},
		{AuthorityOther, 12, 2.00, 3.20},
		{AuthorityOther, 40, 2.50, 4.00},
		{AuthorityRegionalPlanNoPA, 15, 1.40, 2.24},
	}
	for _, c := range cases {
		b, err := UDCPRFSIBand(c.authority, c.road)
		if err != nil {
			t.Fatalf("%s %.0fm: %v", c.authority, c.road, err)
		}
		if b.Max != c.max || b.MaxWithAncillary != c.withAnc {
			t.Errorf("%s %.0fm: got %.2f / %.2f, want %.2f / %.2f", c.authority, c.road, b.Max, b.MaxWithAncillary, c.max, c.withAnc)
		}
	}
}

func TestUDCPRFSIBand_NotUDCPR(t *testing.T) {
	for _, a := range []string{AuthorityMumbai, AuthorityCIDCO} {
		if _, err := UDCPRFSIBand(a, 12); !errors.Is(err, ErrFSIUnsupported) {
			t.Errorf("%s: want ErrFSIUnsupported, got %v", a, err)
		}
	}
	if _, err := UDCPRFSIBand(AuthorityOther, 0); err == nil {
		t.Error("zero road width should fail")
	}
}
