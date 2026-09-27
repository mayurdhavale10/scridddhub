package llm

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/scridddhub/backend/internal/infrapipeline"
	"github.com/scridddhub/backend/internal/infrapipeline/verify"
)

func TestParseInfraExtraction(t *testing.T) {
	content := `{"projects":[{
		"name":"Metro Line 12","name_evidence":"Metro Line 12 connection through Kalyan","kind":"Metro",
		"status":{"value":"under_construction","evidence":"Pile Works 37.12% completed"},
		"expected_completion":{"value":"2027","evidence":null},
		"length_km":{"value":23.57,"evidence":"Length: 23.57 Km"},
		"stations":[],
		"localities":[{"name":"Taloja","evidence":"Pisarve, Taloja and Amandoot"},{"name":"  ","evidence":"x"}]
	},{"name":"X","name_evidence":"X","kind":"spaceport","status":{"value":"half-done","evidence":"half done here"},
	   "expected_completion":{"value":null,"evidence":null},"length_km":{"value":null,"evidence":null},"stations":[],"localities":[]}]}`

	got, err := ParseInfraExtraction(content)
	if err != nil {
		t.Fatal(err)
	}
	p := got[0]
	if p.Kind != "metro" || *p.Status.Value != "under_construction" || *p.LengthKm.Value != 23.57 {
		t.Fatalf("unexpected mapping: %+v", p)
	}
	if p.ExpectedCompletion.Value != nil {
		t.Error("a value with no evidence must be treated as not stated")
	}
	if len(p.Localities) != 1 {
		t.Errorf("blank place names must be dropped, got %+v", p.Localities)
	}
	if got[1].Kind != "other" || got[1].Status.Value != nil {
		t.Errorf("unknown kind/status labels must be normalized away: %+v", got[1])
	}
}

func TestParseInfraExtraction_PlacesAsBareStrings(t *testing.T) {
	content := `{"projects":[{"name":"Atal Setu","name_evidence":"Atal Setu (MTHL)","kind":"road",
		"status":{"value":null,"evidence":null},"expected_completion":{"value":null,"evidence":null},
		"length_km":{"value":null,"evidence":null},"stations":[],"localities":["Sewri","Nhava Sheva"]}]}`
	got, err := ParseInfraExtraction(content)
	if err != nil {
		t.Fatalf("bare-string places must parse: %v", err)
	}
	if len(got[0].Localities) != 2 || got[0].Localities[0].Name != "Sewri" || got[0].Localities[0].Evidence != "" {
		t.Fatalf("unexpected localities %+v", got[0].Localities)
	}
}

func TestExtractDiscoveredURLs(t *testing.T) {
	raw := []byte(`{"choices":[{"message":{
		"content":"Official pages:\nhttps://mmrda.maharashtra.gov.in/en/projects/transport/metro-line-9/overview.\n【1†https://www.magicbricks.com/x】",
		"executed_tools":[{"type":"browser_search","search_results":{"results":[
			{"title":"VVCMC ring road","url":"https://vvcmc.gov.in/projects/ring-road"},
			{"title":"dup","url":"https://mmrda.maharashtra.gov.in/en/projects/transport/metro-line-9/overview"}]}}]}}]}`)
	got := ExtractDiscoveredURLs(raw)
	want := map[string]bool{
		"https://mmrda.maharashtra.gov.in/en/projects/transport/metro-line-9/overview": true,
		"https://www.magicbricks.com/x":           true, // collected here; FilterOfficial drops it later
		"https://vvcmc.gov.in/projects/ring-road": true,
	}
	if len(got) != len(want) {
		t.Fatalf("want %d unique URLs, got %v", len(want), got)
	}
	for _, u := range got {
		if !want[u] {
			t.Errorf("unexpected URL %q (trailing punctuation or citation marks not stripped?)", u)
		}
	}
}

func TestRateLimitWait(t *testing.T) {
	// Real message from the 2026-09-27 dry run.
	err := errors.New("groq API error: Rate limit reached for model `openai/gpt-oss-120b` ... Please try again in 4.14s. Need more tokens?")
	wait, ok := rateLimitWait(err)
	if !ok || wait < 4*time.Second || wait > 5*time.Second {
		t.Fatalf("want ~4.6s wait, got %s ok=%v", wait, ok)
	}
	if _, ok := rateLimitWait(errors.New("groq API error: invalid model")); ok {
		t.Error("other errors must not be retried")
	}
	if _, ok := rateLimitWait(nil); ok {
		t.Error("nil is not a rate limit")
	}
	// Real message from 2026-09-27: the daily cap is not retryable by waiting minutes.
	daily := errors.New("groq API error: Rate limit reached for model `openai/gpt-oss-120b` ... on tokens per day (TPD): Limit 200000, Used 199583, Requested 950. Please try again in 3m50.25s.")
	if _, ok := rateLimitWait(daily); ok {
		t.Error("daily quota must not be treated as a short retry")
	}
	if !isDailyQuota(daily) {
		t.Error("daily quota must be recognised")
	}
}

func TestDiscoverProjectLinks(t *testing.T) {
	html := []byte(`<a href="/en/projects/transport/metro-line-12/overview">ML12</a>
		<a href='https://mmrda.maharashtra.gov.in/en/projects/transport/metro-line-5/overview#x'>ML5</a>
		<a href="/en/projects/transport/metro-line-12/overview?lang=en">dup</a>
		<a href="/en/about-us">About</a>
		<a href="https://other.example.com/projects/1">external</a>`)
	got := DiscoverProjectLinks("https://mmrda.maharashtra.gov.in/en/projects", html)
	if len(got) != 2 {
		t.Fatalf("want 2 same-host project links, got %+v", got)
	}
	if got[0].URL != "https://mmrda.maharashtra.gov.in/en/projects/transport/metro-line-12/overview" ||
		got[0].Kind != infrapipeline.SourceProjectPage {
		t.Errorf("unexpected first link: %+v", got[0])
	}
}

// Live test against Groq with the real MMRDA Metro Line 12 page text (fetched 2026-09-26).
// Skipped without GROQ_API_KEY. It checks the part that matters: after verification, nothing the
// page doesn't state survives — in particular no completion date (the page gives none).
func TestGroqInfraExtractor_LiveMetroLine12(t *testing.T) {
	apiKey := os.Getenv("GROQ_API_KEY")
	if apiKey == "" {
		t.Skip("GROQ_API_KEY not set — skipping real API call")
	}
	const page = `Metro Line - 12 Overview Project Features Present Status Photos Metro Line 12 connection
through Kalyan, Dombivali MIDC, Kalyan Growth Centre, Wadavli, Turbhe, Pisarve, Taloja and Amandoot.
Dedicated Depot is planned at Nilje in up to an extent of 31 Ha. It shall reduce the current travel time
by anything between 50% and 75% depending on road conditions. Length: 23.57 Km (Fully Elevated)
Line Color: Orange Line Stations: 19 Nos. (Fully Elevated) Depot: Nilje (31 Ha.) Interchanging
Stations: Kalyan (Metro Line 5: Thane-Bhiwandi-Kalyan) Hedutane (Metro Line 14: Vikroli-Badlapur)
Amandoot (Navi Mumbai Metro Line 1) Project Completion Cost: ₹ 5,865 Cr. Daily Ridership (2031):
2.62 Lakhs Updated as on 31st August 2026 Sr. No. Activity Progress 1 Pile Works 37.12% completed
2 Pile Cap Works 31.54% completed 3 Pier Works 25.88% completed`

	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	src := infrapipeline.Source{Agency: "MMRDA", Kind: infrapipeline.SourceProjectPage}
	res, err := NewGroqInfraExtractor(apiKey).Extract(ctx, src, infrapipeline.FetchResult{
		FinalURL: "https://mmrda.maharashtra.gov.in/en/projects/transport/metro-line-12/overview", Text: page,
	})
	if err != nil {
		t.Fatalf("extract: %v", err)
	}
	if len(res.Projects) == 0 {
		t.Fatal("expected at least one project")
	}

	var found bool
	for _, p := range res.Projects {
		v := verify.Verifier{}.Verify(p, page)
		t.Logf("extracted %q kind=%s | kept=%d fields | rejected=%v", p.Name, p.Kind, len(v.FieldEvidence), v.Rejected)
		if infrapipeline.CanonicalKey("MMRDA", p.Name) != "mmrda:metro line 12" {
			continue
		}
		found = true
		if _, ok := v.FieldEvidence["name"]; !ok {
			t.Errorf("name should verify")
		}
		if v.Project.ExpectedCompletion.Value != nil {
			t.Errorf("page states no completion date, but %q survived verification", *v.Project.ExpectedCompletion.Value)
		}
		if v.Project.LengthKm.Value == nil || *v.Project.LengthKm.Value != 23.57 {
			t.Errorf("length 23.57 km should be extracted and verified, got %+v", v.Project.LengthKm)
		}
		if _, ok := v.FieldEvidence["locality:Taloja"]; !ok {
			if _, ok := v.FieldEvidence["station:Taloja"]; !ok {
				t.Errorf("Taloja is named on the page and should survive verification")
			}
		}
	}
	if !found {
		t.Error("Metro Line 12 not among extracted projects")
	}
}
