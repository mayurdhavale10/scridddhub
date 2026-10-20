package reportpdf

import (
	"strings"
	"testing"
	"time"

	"github.com/scridddhub/backend/internal/domain"
	"github.com/scridddhub/backend/internal/usecase"
)

func TestHTML_DraftAndSigned(t *testing.T) {
	area, lat, lng, road := 3.5, 19.1536, 73.0805, 12.0
	asking, sqft := int64(42000000), int64(304920)
	now := time.Date(2026, 10, 10, 0, 0, 0, 0, time.UTC)
	s := &usecase.ReportSections{
		AsOf: now, Tier: "full", ParcelName: "Test <plot>", Village: "Nilaje", Taluka: "Kalyan", District: "Thane",
		SurveyNumber: "45/2A", AreaAcres: &area, AskingRupees: &asking, Latitude: &lat, Longitude: &lng,
		LegalCheckStarted: true,
		Risks:             []usecase.ReportRisk{{Area: "Ownership", Level: "low"}},
		Searches:          []domain.EncumbranceSearchItem{{SearchType: "eCourts", Completed: false}},
		OccupancyClass:    "class_1", NAStatus: "unknown",
		PlanningAuthority: "other", RoadWidthM: &road, BuildableSqft: &sqft,
		FSIBand: &usecase.ReportFSI{Basic: 1.1, Premium: 0.3, TDR: 0.6, Max: 2, MaxWithAncillary: 3.2, Source: "UDCPR 2020, Table 6-G"},
		Valued:  true, ValueIndicative: true,
		FixList: []string{"B: record the heirship mutation"},
		Verdict: "fix_first", VerdictSummary: "Two papers missing.",
		SevenTwelves: []usecase.ReportSevenTwelve{{
			Data:  domain.SevenTwelve{SurveyNumber: "45/2/अ", Tenure: "class_1", TotalAreaHR: "1.41.64", Owners: []domain.SevenTwelveOwner{{Name: "रामचंद्र पाटील", MutationNo: "1234"}}},
			Flags: []domain.SevenTwelveFlag{{Level: "high", Text: "Charge on the land (बोजा)"}},
		}, {
			Data: domain.SevenTwelve{SurveyNumber: "45/3", Tenure: "class_1", AreaUnit: domain.AreaUnitAre, TotalAreaHR: "9.10.00", IsNA: true,
				VerificationNo: "2112100001134298", SignedOn: "20/06/2022", Owners: []domain.SevenTwelveOwner{{Name: "भरत गजानन गोंधळे"}}},
		}},
		SevenTwelveSummary: &usecase.ReportSevenTwelveSummary{
			Flags:          []domain.SevenTwelveFlag{{Level: "medium", Text: "2 current holders across the 2 survey numbers"}},
			CurrentHolders: []string{"रामचंद्र पाटील", "भरत गजानन गोंधळे"}, Missing: []string{"45/4"},
		},
		Requirements: []usecase.ReportRequirement{{Section: "B", Item: "Owners over 30 years", Source: "Ferfar", Who: "advocate"}},
		BuilderCalc: &usecase.ReportBuilderCalc{
			Inputs:        domain.BuilderCalcInputs{CarpetRatio: 0.72, SoftCostPct: 0.15, ProfitPct: 0.2, Sources: "Varap listings"},
			BuildableSqft: 22508, AreaSource: "entered",
			Scenarios: []domain.BuilderScenario{
				{Name: "pessimistic", SaleRate: 7000, BuildCost: 3300, LandValue: -600000, BreakEvenRate: 7037},
				{Name: "likely", SaleRate: 8500, BuildCost: 2900, Revenue: 137748960, LandValue: 24264000, BreakEvenRate: 6184},
			},
		},
		Mutations: &usecase.ReportMutations{YearsCovered: 25, ConfirmedBy: "team",
			Entries: []domain.MutationEntry{{Number: "856", Date: "05/06/2001", Type: domain.MutationInheritance, To: "रामचंद्र पाटील", Status: "certified"}},
			Flags:   []domain.SevenTwelveFlag{{Level: "medium", Text: "The entries go back 25 years"}}},
		ESZ: []usecase.ReportESZ{{Name: "Matheran Eco-sensitive Zone", SONumber: "S.O. 133(E)", NotifiedOn: "4 Feb 2003", Status: "final", Listed: false}},
	}

	draft, err := HTML(Document{ReportID: "c23791d4", Tier: "full", Status: "draft", OpenItems: []string{"NA status"}, Sections: s, GeneratedAt: now})
	if err != nil {
		t.Fatal(err)
	}
	page := string(draft)
	for _, want := range []string{"DRAFT", "Still open: NA status", "Fix first, then buy", "45/2A", "रामचंद्र पाटील",
		"Charge on the land", "Still to collect", "The 7/12 extracts together", "Everyone who must sign", "45/4 <span class=\"src\">(no 7/12 yet)</span>",
		"survey 45/3", "9.10.00 are.sq m", "Non-agricultural (NA)", "verify no. 2112100001134298",
		"What the land is worth to a builder", "below ₹0 (₹0.06 Cr short)", "₹2.43 Cr", "₹8,500", "Buildable 22508 sq ft (entered), 72% sold", "going back 25 years", "Inheritance", "not in this notification’s list", "1.1 base · up to 2", "3,04,920 sq ft", "no value is given", "Test &lt;plot&gt;"} {
		if !strings.Contains(page, want) {
			t.Errorf("draft page missing %q", want)
		}
	}
	if strings.Contains(page, "Test <plot>") {
		t.Error("parcel name must be escaped")
	}

	signedAt := now
	if !strings.Contains(page, "Draft: the sign-off and fingerprint are added when the report is signed") {
		t.Error("a draft must say the sign-off comes later")
	}

	s.AdvocateName, s.AdvocateEnrolment, s.IssuedBy = "Adv. A", "MAH/1/2010", "Team member"
	signed, err := HTML(Document{ReportID: "c23791d4", FullID: "c23791d4-full", Fingerprint: "3F9A 21C0 7B44 E812",
		Tier: "full", Status: "signed", FinalisedAt: &signedAt, Sections: s, GeneratedAt: now})
	if err != nil {
		t.Fatal(err)
	}
	p := string(signed)
	if strings.Contains(p, ">DRAFT<") || strings.Contains(p, "Still to collect") {
		t.Error("a signed report must have no draft markings")
	}
	for _, want := range []string{"Title opinion: advocate", ">Adv. A<", "Bar Council enrolment MAH/1/2010", "Prepared by: ScridddHub", ">Team member<",
		"fingerprint <b>3F9A 21C0 7B44 E812</b>", "Report c23791d4-full"} {
		if !strings.Contains(p, want) {
			t.Errorf("signed page missing %q", want)
		}
	}

	quick, err := HTML(Document{ReportID: "q1", FullID: "q1-full", Fingerprint: "AAAA BBBB CCCC DDDD",
		Tier: "quick", Status: "issued", FinalisedAt: &signedAt, Sections: s, GeneratedAt: now})
	if err != nil {
		t.Fatal(err)
	}
	if q := string(quick); !strings.Contains(q, "Issued by: ScridddHub") || strings.Contains(q, "Title opinion: advocate") {
		t.Error("a Quick Screen is issued by ScridddHub, with no advocate box")
	}
}

func TestFingerprintChangesWithContents(t *testing.T) {
	a := domain.DueDiligenceReport{Status: domain.ReportStatusIssued, FrozenReport: []byte(`{"verdict":"go"}`)}
	b := domain.DueDiligenceReport{Status: domain.ReportStatusIssued, FrozenReport: []byte(`{"verdict":"no_go"}`)}
	if a.Fingerprint() == "" || a.Fingerprint() == b.Fingerprint() || len(a.Fingerprint()) != 19 {
		t.Errorf("fingerprints %q %q", a.Fingerprint(), b.Fingerprint())
	}
	draft := domain.DueDiligenceReport{Status: domain.ReportStatusDraft, FrozenReport: []byte(`{}`)}
	if draft.Fingerprint() != "" {
		t.Error("a draft has no fingerprint")
	}
}

func TestIndian(t *testing.T) {
	for in, want := range map[int64]string{999: "999", 1000: "1,000", 304920: "3,04,920", 12510000: "1,25,10,000"} {
		if got := indian(in); got != want {
			t.Errorf("indian(%d) = %s, want %s", in, got, want)
		}
	}
}
