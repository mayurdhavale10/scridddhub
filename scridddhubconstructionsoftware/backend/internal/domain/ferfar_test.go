package domain

import (
	"strings"
	"testing"
	"time"
)

func TestMutationRegister_FlagsAndCoverage(t *testing.T) {
	now := time.Date(2026, 10, 10, 0, 0, 0, 0, time.UTC)
	m := &MutationRegister{Entries: []MutationEntry{
		{Number: "856", Date: "०५/०६/२००१", Type: MutationInheritance, From: "गणपत पाटील", To: "रामचंद्र पाटील", Status: "certified"},
		{Number: "1288", Date: "10/01/2015", Type: MutationCharge, From: "रामचंद्र पाटील", To: "Bank of Maharashtra", Status: "certified"},
		{Number: "1302", Date: "12/03/2019", Type: MutationSale, From: "सुरेश जाधव", To: "सीता पाटील", Status: "pending"},
	}}
	if err := m.Validate(); err != nil {
		t.Fatal(err)
	}
	if y := m.YearsCovered(now); y != 25 {
		t.Errorf("years covered = %d, want 25", y)
	}
	flags := m.Flags(now)
	want := []string{"go back 25 years", "bank charge", "inheritance", "pending", "doesn't appear as receiving"}
	for _, w := range want {
		found := false
		for _, f := range flags {
			found = found || strings.Contains(f.Text, w)
		}
		if !found {
			t.Errorf("missing flag %q in %+v", w, flags)
		}
	}

	// A release after the charge clears the charge flag.
	m.Entries = append(m.Entries, MutationEntry{Number: "1400", Date: "01/02/2021", Type: MutationChargeRelease, Status: "certified"})
	for _, f := range m.Flags(now) {
		if strings.Contains(f.Text, "bank charge") {
			t.Error("released charge still flagged")
		}
	}
}

func TestClassifyMutationText(t *testing.T) {
	cases := map[string]string{
		"खरेदी : रामचंद्र पाटील कडून सुनील शिंदे": MutationSale,
		"बक्षीस : सीता पाटील यांना अर्धा हिस्सा":  MutationGift,
		"वारस : गणपत पाटील मयत":                   MutationInheritance,
		"बोजा : बँक ऑफ महाराष्ट्र कडून कर्ज":      MutationCharge,
		"बोजा कमी : बँकेचे कर्ज फेडले":            MutationChargeRelease,
		"भूसंपादन : राष्ट्रीय महामार्गासाठी":      MutationAcquisition,
	}
	for raw, want := range cases {
		if got, ok := ClassifyMutationText(raw); !ok || got != want {
			t.Errorf("%q: got %q, want %q", raw, got, want)
		}
	}
	if _, ok := ClassifyMutationText("नोंद"); ok {
		t.Error("no keyword should leave the type to a person")
	}
}

func TestMutationRegister_Sorted(t *testing.T) {
	m := &MutationRegister{Entries: []MutationEntry{
		{Number: "3", Date: "01/01/2020", Type: MutationSale},
		{Number: "9", Type: MutationOther},
		{Number: "1", Date: "01/01/1995", Type: MutationSale},
	}}
	got := m.SortedEntries()
	if got[0].Number != "1" || got[1].Number != "3" || got[2].Number != "9" {
		t.Errorf("order = %v %v %v", got[0].Number, got[1].Number, got[2].Number)
	}
	bad := &MutationRegister{Entries: []MutationEntry{{Number: "1", Type: "loan"}}}
	if bad.Validate() == nil {
		t.Error("unknown type should fail")
	}
}
