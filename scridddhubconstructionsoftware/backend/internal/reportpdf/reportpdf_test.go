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
		"survey 45/3", "9.10.00 are.sq m", "Non-agricultural (NA)", "verify no. 2112100001134298", "going back 25 years", "Inheritance", "not in this notification’s list", "1.1 base · up to 2", "3,04,920 sq ft", "no value is given", "Test &lt;plot&gt;"} {
		if !strings.Contains(page, want) {
			t.Errorf("draft page missing %q", want)
		}
	}
	if strings.Contains(page, "Test <plot>") {
		t.Error("parcel name must be escaped")
	}

	signedAt := now
	s.AdvocateName, s.AdvocateEnrolment = "Adv. A", "MAH/1/2010"
	signed, err := HTML(Document{ReportID: "c23791d4", Tier: "full", Status: "signed", FinalisedAt: &signedAt, Sections: s, GeneratedAt: now})
	if err != nil {
		t.Fatal(err)
	}
	if p := string(signed); strings.Contains(p, ">DRAFT<") || strings.Contains(p, "Still to collect") || !strings.Contains(p, "Signed by <b>Adv. A</b>") {
		t.Error("a signed report must show the sign-off and no draft markings")
	}
}

func TestIndian(t *testing.T) {
	for in, want := range map[int64]string{999: "999", 1000: "1,000", 304920: "3,04,920", 12510000: "1,25,10,000"} {
		if got := indian(in); got != want {
			t.Errorf("indian(%d) = %s, want %s", in, got, want)
		}
	}
}
