package domain

import (
	"strings"
	"testing"
)

// Varap's two pieces, as read from their signed 7/12s (2026-10-14/15).
func varapRecords() (r423, r4242 LandRecord) {
	r423 = LandRecord{Data: SevenTwelve{SurveyNumber: "42/3", Tenure: "class_1", AreaUnit: AreaUnitAre, TotalAreaHR: "11.60.00", IsNA: true, DigitallySigned: true,
		Owners: []SevenTwelveOwner{{Name: "कमलाकर परशराम कोंगरे", MutationNo: "१०९०"}, {Name: "दिलीप परशराम कोंगरे", MutationNo: "१०९०"}}}}
	r4242 = LandRecord{Data: SevenTwelve{SurveyNumber: "42/4/2", Tenure: "class_1", AreaUnit: AreaUnitAre, TotalAreaHR: "9.10.00", IsNA: true, DigitallySigned: true,
		Owners: []SevenTwelveOwner{{Name: "भरत गजानन गोंधळे", MutationNo: "१०९०"}}}}
	return
}

func TestSevenTwelveSetBothPieces(t *testing.T) {
	a, b := varapRecords()
	acres := 0.5115
	set := NewSevenTwelveSet([]LandRecord{b, a}, SplitSurveyNumbers("42/3, 42/4/2"), &acres)
	if set.Records[0].Data.SurveyNumber != "42/3" {
		t.Errorf("records not sorted: first is %s", set.Records[0].Data.SurveyNumber)
	}
	if set.TotalAreaSqm != 2070 {
		t.Errorf("total = %v sq m, want 2070", set.TotalAreaSqm)
	}
	if len(set.Missing) != 0 || len(set.Extra) != 0 {
		t.Errorf("missing %v extra %v", set.Missing, set.Extra)
	}
	if len(set.CurrentHolders) != 3 {
		t.Errorf("holders = %v", set.CurrentHolders)
	}
	var signAll bool
	for _, f := range set.Flags {
		if strings.Contains(f.Text, "parcel was entered as") {
			t.Errorf("area matches (2,070 sq m = 0.51 acres), got: %s", f.Text)
		}
		if strings.Contains(f.Text, "3 current holders across the 2 survey numbers") && strings.Contains(f.Text, "भरत गजानन गोंधळे (42/4/2)") {
			signAll = true
		}
	}
	if !signAll {
		t.Errorf("want the 3-holders flag naming each piece, got %v", set.Flags)
	}
}

func TestSevenTwelveSetMissingPiece(t *testing.T) {
	a, _ := varapRecords()
	acres := 0.5115
	set := NewSevenTwelveSet([]LandRecord{a}, SplitSurveyNumbers("42/3, 42/4/2"), &acres)
	if len(set.Missing) != 1 || set.Missing[0] != "42/4/2" {
		t.Fatalf("missing = %v", set.Missing)
	}
	if set.Flags[0].Level != "high" || !strings.Contains(set.Flags[0].Text, "No 7/12 yet for 42/4/2") {
		t.Errorf("first flag = %+v", set.Flags[0])
	}
	for _, f := range set.Flags {
		if strings.Contains(f.Text, "acres") {
			t.Errorf("one piece's area isn't the parcel's; no area flag until both are in, got: %s", f.Text)
		}
	}
}

func TestSevenTwelveSetHolderCountWording(t *testing.T) {
	a, _ := varapRecords()
	set := NewSevenTwelveSet([]LandRecord{a}, SplitSurveyNumbers("42/3, 42/4/2"), nil)
	var n int
	for _, f := range set.Flags {
		if strings.Contains(f.Text, "must sign") {
			n++
		}
	}
	if n != 1 {
		t.Errorf("want exactly one must-sign flag, got %d: %v", n, set.Flags)
	}
}

func TestSplitSurveyNumbers(t *testing.T) {
	got := SplitSurveyNumbers(" 42/3, ४२/३ ;42/4/2\n")
	if len(got) != 2 || got[0] != "42/3" || got[1] != "42/4/2" {
		t.Errorf("got %q", got)
	}
	if err := ValidateSurveyNumbers("42/3, abc"); err == nil {
		t.Error("want an error for a part without a number")
	}
}
