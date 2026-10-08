package domain

import (
	"strings"
	"testing"
)

func TestParseHectareAre(t *testing.T) {
	cases := map[string]float64{
		"1.23.45": 12345,
		"0.40":    4000,
		"2":       20000,
		"१.०५":    10500, // Devanagari digits
		"0.00.50": 50,
	}
	for in, want := range cases {
		got, err := ParseHectareAre(in)
		if err != nil || got != want {
			t.Errorf("%q: got %v, %v; want %v", in, got, err, want)
		}
	}
	for _, bad := range []string{"1.234", "abc", "1.2.3.4", ""} {
		if _, err := ParseHectareAre(bad); err == nil {
			t.Errorf("%q should fail", bad)
		}
	}
}

func TestSevenTwelveFlags(t *testing.T) {
	acres := 3.5
	s := &SevenTwelve{
		SurveyNumber: "45/2A", Tenure: "class_2", TotalAreaHR: "1.00.00",
		Owners:           []SevenTwelveOwner{{Name: "A"}, {Name: "B"}, {Name: "C", Former: true}},
		OtherRights:      []string{"बोजा: State Bank ₹5,00,000"},
		PendingMutations: []string{"1234"},
	}
	if err := s.Validate(); err != nil {
		t.Fatal(err)
	}
	flags := s.Flags(&acres)
	want := []string{"Class II", "बोजा", "Pending mutation", "digitally signed", "2 current holders", "Area on the 7/12"}
	for _, w := range want {
		found := false
		for _, f := range flags {
			found = found || strings.Contains(f.Text, w)
		}
		if !found {
			t.Errorf("missing flag containing %q in %+v", w, flags)
		}
	}
}

func TestSameSurveyNumber(t *testing.T) {
	same := [][2]string{{"45/2A", "45/2/अ"}, {"४५/२ अ", "45/2A"}, {"112/1/B", "112/1 ब"}}
	for _, p := range same {
		if !SameSurveyNumber(p[0], p[1]) {
			t.Errorf("%q and %q should match", p[0], p[1])
		}
	}
	if SameSurveyNumber("45/2A", "45/2B") || SameSurveyNumber("45", "54") {
		t.Error("different survey numbers matched")
	}
}

func TestSevenTwelveValidate_NeedsCurrentHolder(t *testing.T) {
	s := &SevenTwelve{SurveyNumber: "1", Owners: []SevenTwelveOwner{{Name: "X", Former: true}}}
	if s.Validate() == nil {
		t.Error("only former holders should fail")
	}
}
