package verify

import (
	"slices"
	"testing"

	"github.com/scridddhub/backend/internal/infrapipeline"
)

// Real text from MMRDA's Metro Line 12 page (fetched 2026-09-26).
const ml12Page = `Metro Line - 12 Overview Project Features Present Status Photos Metro Line 12 connection
through Kalyan, Dombivali MIDC, Kalyan Growth Centre, Wadavli, Turbhe, Pisarve, Taloja and Amandoot.
Length: 23.57 Km (Fully Elevated) Line Color: Orange Line Stations: 19 Nos. (Fully Elevated)
Depot: Nilje (31 Ha.) Updated as on 31st August 2026 Sr. No. Activity Progress 1 Pile Works
37.12% completed 2 Pile Cap Works 31.54% completed`

func ptr[T any](v T) *T { return &v }

func base() infrapipeline.ExtractedProject {
	return infrapipeline.ExtractedProject{
		Name:         "Metro Line 12 (Kalyan–Taloja)",
		NameEvidence: "Metro Line 12 connection through Kalyan",
		Kind:         "metro",
		Status:       infrapipeline.Field[string]{Value: ptr("under_construction"), Evidence: "Pile Works 37.12% completed"},
		LengthKm:     infrapipeline.Field[float64]{Value: ptr(23.57), Evidence: "Length: 23.57 Km (Fully Elevated)"},
		Localities: []infrapipeline.NamedPlace{
			{Name: "Taloja", Evidence: "Wadavli, Turbhe, Pisarve, Taloja and Amandoot"},
		},
	}
}

func TestVerify_AllRealEvidencePasses(t *testing.T) {
	got := Verifier{}.Verify(base(), ml12Page)
	if len(got.Rejected) != 0 {
		t.Fatalf("nothing should be rejected, got %v", got.Rejected)
	}
	for _, f := range []string{"name", "status", "length_km", "locality:Taloja"} {
		if _, ok := got.FieldEvidence[f]; !ok {
			t.Errorf("missing evidence for %s", f)
		}
	}
}

func TestVerify_InventedDateIsDropped(t *testing.T) {
	p := base()
	// The model "helpfully" adds a press date the page never states, citing a real sentence.
	p.ExpectedCompletion = infrapipeline.Field[string]{Value: ptr("Dec 2027"), Evidence: "Updated as on 31st August 2026"}
	got := Verifier{}.Verify(p, ml12Page)
	if got.Project.ExpectedCompletion.Value != nil || !slices.Contains(got.Rejected, "expected_completion") {
		t.Fatalf("invented date must be rejected: %+v", got)
	}
}

func TestVerify_FabricatedQuoteIsDropped(t *testing.T) {
	p := base()
	p.ExpectedCompletion = infrapipeline.Field[string]{Value: ptr("2027"), Evidence: "The line will open by December 2027"}
	got := Verifier{}.Verify(p, ml12Page)
	if got.Project.ExpectedCompletion.Value != nil {
		t.Fatal("a quote that isn't on the page must not verify")
	}
}

func TestVerify_WrongNumberWithRealSentenceIsDropped(t *testing.T) {
	p := base()
	p.LengthKm = infrapipeline.Field[float64]{Value: ptr(25.0), Evidence: "Length: 23.57 Km (Fully Elevated)"}
	got := Verifier{}.Verify(p, ml12Page)
	if got.Project.LengthKm.Value != nil {
		t.Fatal("length must appear inside its own evidence")
	}
}

func TestVerify_StationNotOnPageIsDropped(t *testing.T) {
	p := base()
	p.Stations = []infrapipeline.NamedPlace{{Name: "Ulhasnagar", Evidence: "Wadavli, Turbhe, Pisarve, Taloja and Amandoot"}}
	got := Verifier{}.Verify(p, ml12Page)
	if len(got.Project.Stations) != 0 || !slices.Contains(got.Rejected, "station:Ulhasnagar") {
		t.Fatalf("a station the page never names must be rejected: %+v", got)
	}
}

func TestVerify_StitchedPlaceQuoteIsReanchoredToRealSentence(t *testing.T) {
	// Observed from the live model: it joined two separate parts of the page into one "quote".
	page := "Interchanging Stations: Kalyan (Metro Line 5) Hedutane (Metro Line 14: Vikroli-Badlapur)"
	p := infrapipeline.ExtractedProject{
		Name: "Metro Line 12", NameEvidence: "Interchanging Stations: Kalyan (Metro Line 5)",
		Stations: []infrapipeline.NamedPlace{{Name: "Hedutane", Evidence: "Interchanging Stations: Hedutane (Metro Line 14"}},
	}
	got := Verifier{}.Verify(p, page)
	if len(got.Project.Stations) != 1 {
		t.Fatalf("Hedutane is named on the page and should be kept: %+v", got)
	}
	if ev := got.FieldEvidence["station:Hedutane"]; ev != page {
		t.Errorf("evidence must be the real page sentence, got %q", ev)
	}
}

func TestVerify_PlaceReanchorNeedsWholeWord(t *testing.T) {
	page := "The corridor serves Kalyani Nagar and nearby areas."
	p := infrapipeline.ExtractedProject{Name: "x", Localities: []infrapipeline.NamedPlace{{Name: "Kalyan", Evidence: "bogus quote here"}}}
	if got := (Verifier{}).Verify(p, page); len(got.Project.Localities) != 0 {
		t.Fatal("'Kalyan' must not be anchored to 'Kalyani'")
	}
}

func TestVerify_NameWithWrongNumberRejected(t *testing.T) {
	p := base()
	p.Name = "Metro Line 14" // evidence is about Line 12
	got := Verifier{}.Verify(p, ml12Page)
	if !slices.Contains(got.Rejected, "name") {
		t.Fatal("name must be supported by its evidence")
	}
}

func TestVerify_IgnoresDashAndWhitespaceDifferences(t *testing.T) {
	page := "Metro   Line – 12\nKalyan–Taloja corridor is 23.57 km long"
	p := infrapipeline.ExtractedProject{
		Name: "Metro Line 12", NameEvidence: "Metro Line - 12 Kalyan-Taloja corridor",
		LengthKm: infrapipeline.Field[float64]{Value: ptr(23.57), Evidence: "Kalyan-Taloja corridor is 23.57 km long"},
	}
	if got := (Verifier{}).Verify(p, page); len(got.Rejected) != 0 {
		t.Fatalf("formatting differences should not fail verification: %v", got.Rejected)
	}
}

func TestVerify_SpacedDashDroppedByModelStillMatches(t *testing.T) {
	// Real case: MMRDA's page says "Metro Line - 5 (Thane Bhiwandi Kalyan)"; the model copied it
	// without the dash.
	page := "Metro Line - 5 (Thane Bhiwandi Kalyan) Metro Line 5 from Thane to Bhiwandi to Kalyan is 24.90 km."
	p := infrapipeline.ExtractedProject{Name: "Metro Line 5 (Thane Bhiwandi Kalyan)", NameEvidence: "Metro Line 5 (Thane Bhiwandi Kalyan)"}
	if got := (Verifier{}).Verify(p, page); slices.Contains(got.Rejected, "name") {
		t.Fatal("a dropped punctuation dash must not fail the name")
	}
	// A dash joining words is content, not punctuation: "Kalyan-Taloja" must not match "Kalyan Taloja".
	p2 := infrapipeline.ExtractedProject{Name: "Metro Line 12", NameEvidence: "Metro Line 12 Kalyan Taloja corridor"}
	if got := (Verifier{}).Verify(p2, "Metro Line 12 Kalyan-Taloja corridor"); !slices.Contains(got.Rejected, "name") {
		t.Fatal("joined-word dashes must still be matched exactly")
	}
}

func TestVerify_TooShortEvidenceRejected(t *testing.T) {
	p := base()
	p.Status = infrapipeline.Field[string]{Value: ptr("under_construction"), Evidence: "completed"}
	if got := (Verifier{}).Verify(p, ml12Page); got.Project.Status.Value != nil {
		t.Fatal("a one-word quote proves nothing")
	}
}
