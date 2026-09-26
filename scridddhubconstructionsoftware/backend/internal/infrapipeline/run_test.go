package infrapipeline_test

import (
	"context"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/infrapipeline"
	"github.com/scridddhub/backend/internal/infrapipeline/verify"
)

// --- fakes -----------------------------------------------------------------------------------

type fakeStore struct {
	sources   []infrapipeline.Source
	added     []infrapipeline.DiscoveredSource
	fetches   int
	unchanged int
	upserts   []infrapipeline.CanonicalProject
	runs      int
	finished  *infrapipeline.RunStats
}

func (s *fakeStore) ListEnabledSources(context.Context, string) ([]infrapipeline.Source, error) {
	return s.sources, nil
}
func (s *fakeStore) AddDiscoveredSources(_ context.Context, _ uuid.UUID, _ string, f []infrapipeline.DiscoveredSource) (int, error) {
	s.added = append(s.added, f...)
	return len(f), nil
}
func (s *fakeStore) StartRun(context.Context, infrapipeline.RunTrigger, map[string]any) (uuid.UUID, error) {
	s.runs++
	return uuid.New(), nil
}
func (s *fakeStore) FinishRun(_ context.Context, _ uuid.UUID, st infrapipeline.RunStats, _ error) error {
	s.finished = &st
	return nil
}
func (s *fakeStore) SaveFetch(context.Context, uuid.UUID, infrapipeline.Source, infrapipeline.FetchResult) (uuid.UUID, error) {
	s.fetches++
	return uuid.New(), nil
}
func (s *fakeStore) MarkUnchanged(context.Context, uuid.UUID) error { s.unchanged++; return nil }
func (s *fakeStore) UpsertProject(_ context.Context, p infrapipeline.CanonicalProject) (bool, error) {
	s.upserts = append(s.upserts, p)
	return true, nil
}

type fakeFetcher map[string]infrapipeline.FetchResult

func (f fakeFetcher) Fetch(_ context.Context, url string) (infrapipeline.FetchResult, error) {
	if r, ok := f[url]; ok {
		r.FinalURL = url
		return r, nil
	}
	return infrapipeline.FetchResult{FinalURL: url, Status: infrapipeline.FetchError, Detail: "no such page"}, nil
}

// fakeExtractor returns Metro Line 12 facts for the ML12 page and discovers it from the index.
type fakeExtractor struct{}

func ptr[T any](v T) *T { return &v }

func (fakeExtractor) Extract(_ context.Context, src infrapipeline.Source, page infrapipeline.FetchResult) (infrapipeline.ExtractResult, error) {
	var r infrapipeline.ExtractResult
	if src.Kind == infrapipeline.SourceProjectIndex {
		r.Discovered = []infrapipeline.DiscoveredSource{{URL: "https://mmrda.test/projects/ml12", Kind: infrapipeline.SourceProjectPage}}
		return r, nil
	}
	if strings.Contains(page.Text, "Metro Line 12") {
		r.Projects = []infrapipeline.ExtractedProject{{
			Name: "Metro Line 12 (Kalyan–Taloja)", NameEvidence: "Metro Line 12 connection through Kalyan", Kind: "metro",
			LengthKm: infrapipeline.Field[float64]{Value: ptr(23.57), Evidence: "Length: 23.57 Km (Fully Elevated)"},
			// Invented date citing a real sentence: must be rejected by the real verifier.
			ExpectedCompletion: infrapipeline.Field[string]{Value: ptr("Dec 2027"), Evidence: "Length: 23.57 Km (Fully Elevated)"},
		}}
	}
	return r, nil
}

type fakeGeodata struct{}

func (fakeGeodata) Parse([]byte, string, string) ([]infrapipeline.GeoPoint, error) {
	return []infrapipeline.GeoPoint{{Label: "Kalyan APMC", Kind: infrapipeline.PointStation, Latitude: 19.235, Longitude: 73.122}}, nil
}

type passLocator struct{}

func (passLocator) Locate(_ context.Context, _ infrapipeline.VerifiedProject, official []infrapipeline.GeoPoint) ([]infrapipeline.LocatedPoint, error) {
	var out []infrapipeline.LocatedPoint
	for _, p := range official {
		out = append(out, infrapipeline.LocatedPoint{GeoPoint: p, CoordSource: infrapipeline.CoordOfficialFile})
	}
	return out, nil
}

// --- test fixture ------------------------------------------------------------------------------

const ml12Text = "Metro Line 12 connection through Kalyan, Dombivali MIDC. Length: 23.57 Km (Fully Elevated)"

func fixture() (*fakeStore, *infrapipeline.Pipeline) {
	store := &fakeStore{sources: []infrapipeline.Source{
		{ID: uuid.New(), Agency: "MMRDA", URL: "https://mmrda.test/projects", Kind: infrapipeline.SourceProjectIndex},
		{ID: uuid.New(), Agency: "MMRDA", URL: "https://mmrda.test/ml12.kml", Kind: infrapipeline.SourceGeodata, ProjectHint: "Metro Line 12"},
		{ID: uuid.New(), Agency: "MMRDA", URL: "https://mmrda.test/unchanged", Kind: infrapipeline.SourceProjectPage, LastContentHash: "same"},
		{ID: uuid.New(), Agency: "MMRDA", URL: "https://mmrda.test/blocked", Kind: infrapipeline.SourceProjectPage},
	}}
	fetcher := fakeFetcher{
		"https://mmrda.test/projects":      {Status: infrapipeline.FetchOK, ContentHash: "idx", Raw: []byte("<a>")},
		"https://mmrda.test/ml12.kml":      {Status: infrapipeline.FetchOK, ContentHash: "kml", Raw: []byte("<kml/>")},
		"https://mmrda.test/unchanged":     {Status: infrapipeline.FetchOK, ContentHash: "same"},
		"https://mmrda.test/blocked":       {Status: infrapipeline.FetchBlocked, Detail: "HTTP 403"},
		"https://mmrda.test/projects/ml12": {Status: infrapipeline.FetchOK, ContentHash: "p12", Text: ml12Text},
	}
	p := &infrapipeline.Pipeline{
		Store: store, Fetcher: fetcher, Extractor: fakeExtractor{}, Verifier: verify.Verifier{},
		Geodata: fakeGeodata{}, Locator: passLocator{}, Policy: infrapipeline.PolicyEvidence,
		Logf: func(string, ...any) {},
	}
	return store, p
}

func TestRun_EndToEndWithFakes(t *testing.T) {
	store, p := fixture()
	res, err := p.Run(context.Background(), infrapipeline.RunOptions{Trigger: infrapipeline.TriggerCLI})
	if err != nil {
		t.Fatal(err)
	}
	st := res.Stats
	if st.Sources != 5 || st.Unchanged != 1 || st.Blocked != 1 || st.Fetched != 3 {
		t.Errorf("unexpected stats %+v (want 5 sources incl. 1 discovered, 1 unchanged, 1 blocked, 3 fetched)", st)
	}
	if store.unchanged != 1 || len(store.added) != 1 {
		t.Errorf("unchanged page must be marked, discovered page saved: unchanged=%d added=%v", store.unchanged, store.added)
	}
	if len(store.upserts) != 1 {
		t.Fatalf("KML and page must merge into ONE project, got %d: %+v", len(store.upserts), store.upserts)
	}
	up := store.upserts[0]
	if up.Key != "mmrda:metro line 12" || len(up.Points) != 1 || up.Project.Project.LengthKm.Value == nil {
		t.Errorf("merged project missing points or verified length: %+v", up)
	}
	if up.Project.Project.ExpectedCompletion.Value != nil {
		t.Error("invented completion date must not reach the store")
	}
	// A rejected field means review under the default policy, even with official points.
	if up.Review != infrapipeline.ReviewPending || st.Pending != 1 {
		t.Errorf("rejected field must send the project to review: review=%s stats=%+v", up.Review, st)
	}
	if store.finished == nil {
		t.Error("run must be finished with stats")
	}
}

func TestRun_DryRunWritesNothing(t *testing.T) {
	store, p := fixture()
	res, err := p.Run(context.Background(), infrapipeline.RunOptions{Trigger: infrapipeline.TriggerCLI, DryRun: true})
	if err != nil {
		t.Fatal(err)
	}
	if store.runs != 0 || store.fetches != 0 || store.unchanged != 0 || len(store.upserts) != 0 || len(store.added) != 0 {
		t.Fatalf("dry run must not write: %+v", store)
	}
	if len(res.DryRun) != 1 || res.DryRun[0].Key != "mmrda:metro line 12" {
		t.Fatalf("dry run should report what it would store: %+v", res.DryRun)
	}
}

func TestRun_ForceReextractsUnchanged(t *testing.T) {
	_, p := fixture()
	res, _ := p.Run(context.Background(), infrapipeline.RunOptions{Trigger: infrapipeline.TriggerCLI, Force: true, DryRun: true})
	if res.Stats.Unchanged != 0 {
		t.Errorf("force must ignore unchanged hashes: %+v", res.Stats)
	}
}

func TestRun_SingleSourceMustBeInRegistry(t *testing.T) {
	_, p := fixture()
	if _, err := p.Run(context.Background(), infrapipeline.RunOptions{SourceURL: "https://evil.test/x", DryRun: true}); err == nil {
		t.Error("a URL outside the registry must be refused — the pipeline only reads registered official sources")
	}
}
