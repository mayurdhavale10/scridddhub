package usecase

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
)

type fakeGeocoder struct {
	known map[string]domain.GeoPoint // candidate text -> point
	calls []string
	err   error
}

func (f *fakeGeocoder) Provider() string { return "fake" }
func (f *fakeGeocoder) Search(_ context.Context, q string) (GeocodeResult, error) {
	f.calls = append(f.calls, q)
	if f.err != nil {
		return GeocodeResult{}, f.err
	}
	if p, ok := f.known[q]; ok {
		return GeocodeResult{Found: true, Point: p, DisplayName: q + " (display)"}, nil
	}
	return GeocodeResult{Found: false}, nil
}

type memCache struct{ m map[string]GeocodeResult }

func (c *memCache) Get(_ context.Context, q string) (*GeocodeResult, error) {
	if r, ok := c.m[q]; ok {
		return &r, nil
	}
	return nil, nil
}
func (c *memCache) Put(_ context.Context, q string, r GeocodeResult, _ string) error {
	c.m[q] = r
	return nil
}

type oneParcel struct{ p *domain.LandParcel }

func (o oneParcel) Get(context.Context, uuid.UUID) (*domain.LandParcel, error) { return o.p, nil }

type noProjects struct{}

func (noProjects) ListApproved(context.Context) ([]domain.InfrastructureProject, error) {
	return nil, nil
}

func newUC(loc string, g *fakeGeocoder, c *memCache) *PlannedInfrastructureUsecase {
	return NewPlannedInfrastructureUsecase(oneParcel{&domain.LandParcel{Location: loc}}, noProjects{}, g, c)
}

func TestResolve_FallsBackToShorterPartAndCaches(t *testing.T) {
	g := &fakeGeocoder{known: map[string]domain.GeoPoint{"Khadakpada, Maharashtra": {Latitude: 19.25, Longitude: 73.13}}}
	c := &memCache{m: map[string]GeocodeResult{}}
	uc := newUC("Godrej Hill, Khadakpada", g, c)

	res, err := uc.ForParcel(context.Background(), uuid.New())
	if err != nil {
		t.Fatal(err)
	}
	if res.Location == nil || res.Location.MatchedQuery != "Khadakpada, Maharashtra" {
		t.Fatalf("expected fallback match on the broader part, got %+v", res.Location)
	}
	if len(g.calls) != 2 || g.calls[0] != "Godrej Hill, Khadakpada, Maharashtra" {
		t.Fatalf("unexpected geocoder calls: %v", g.calls)
	}

	// Second lookup of the same text (different spacing/case) must come from the cache.
	uc2 := newUC("  godrej hill,   KHADAKPADA ", g, c)
	if _, err := uc2.ForParcel(context.Background(), uuid.New()); err != nil {
		t.Fatal(err)
	}
	if len(g.calls) != 2 {
		t.Fatalf("expected cache hit, geocoder called again: %v", g.calls)
	}
}

func TestResolve_MissIsCachedAndReportedAsNoLocation(t *testing.T) {
	g := &fakeGeocoder{known: map[string]domain.GeoPoint{}}
	c := &memCache{m: map[string]GeocodeResult{}}
	res, err := newUC("Nowhere Plot", g, c).ForParcel(context.Background(), uuid.New())
	if err != nil {
		t.Fatal(err)
	}
	if res.Location != nil {
		t.Fatalf("unresolved location must be nil, got %+v", res.Location)
	}
	if _, ok := c.m["nowhere plot"]; !ok {
		t.Fatal("a miss should be cached so it isn't re-queried")
	}
}

type fixedProjects []domain.InfrastructureProject

func (f fixedProjects) ListApproved(context.Context) ([]domain.InfrastructureProject, error) {
	return f, nil
}

// Owner decision (2026-09-27): finished projects stay visible (the app labels them "Already
// open") — existing infrastructure still matters for a property.
func TestForLocation_ShowsEveryStatus(t *testing.T) {
	area := []domain.InfrastructureProjectArea{{District: "Thane", Taluka: "Kalyan"}}
	projects := fixedProjects{
		{Name: "Metro Line 1", Status: "operational", Areas: area},
		{Name: "Metro Line 12", Status: "under_construction", Areas: area},
		{Name: "Sahar Elevated Road", Status: "planned", Areas: area},
		{Name: "Metro Line 2A", Status: "partially_operational", Areas: area},
		{Name: "Metro Line 4A", Status: "unknown", Areas: area},
	}
	uc := NewPlannedInfrastructureUsecase(oneParcel{}, projects, &fakeGeocoder{known: map[string]domain.GeoPoint{}}, &memCache{m: map[string]GeocodeResult{}})
	res, err := uc.ForLocation(context.Background(), domain.PropertyLocation{Text: "Khadakpada kalyan west"})
	if err != nil {
		t.Fatal(err)
	}
	got := map[string]bool{}
	for _, m := range res.Matches {
		got[m.Project.Name] = true
	}
	for _, want := range []string{"Metro Line 1", "Metro Line 12", "Sahar Elevated Road", "Metro Line 2A", "Metro Line 4A"} {
		if !got[want] {
			t.Errorf("%s should be shown", want)
		}
	}
}

type fakeCoverage struct {
	requests []string
	status   string
}

func (f *fakeCoverage) RequestCoverage(_ context.Context, cell, _ string, _, _ float64) (CoverageStatus, error) {
	f.requests = append(f.requests, cell)
	return CoverageStatus{Status: f.status}, nil
}

func TestForLocation_UncoveredAreaIsQueuedAndSearcherWoken(t *testing.T) {
	g := &fakeGeocoder{known: map[string]domain.GeoPoint{"Vasai, Maharashtra": {Latitude: 19.39, Longitude: 72.83}}}
	cov := &fakeCoverage{status: "queued"}
	var woken []string
	uc := NewPlannedInfrastructureUsecase(oneParcel{}, noProjects{}, g, &memCache{m: map[string]GeocodeResult{}}).
		WithCoverage(cov, func(cell string) { woken = append(woken, cell) })

	res, err := uc.ForLocation(context.Background(), domain.PropertyLocation{Text: "Vasai"})
	if err != nil {
		t.Fatal(err)
	}
	if res.Coverage == nil || res.Coverage.Status != "queued" || len(cov.requests) != 1 || len(woken) != 1 {
		t.Fatalf("uncovered area must be recorded and the searcher woken: cov=%+v requests=%v woken=%v", res.Coverage, cov.requests, woken)
	}
}

func TestForLocation_AlreadySearchedAreaDoesNotWakeSearcher(t *testing.T) {
	g := &fakeGeocoder{known: map[string]domain.GeoPoint{"Vasai, Maharashtra": {Latitude: 19.39, Longitude: 72.83}}}
	cov := &fakeCoverage{status: "searched"}
	woken := 0
	uc := NewPlannedInfrastructureUsecase(oneParcel{}, noProjects{}, g, &memCache{m: map[string]GeocodeResult{}}).
		WithCoverage(cov, func(string) { woken++ })
	res, _ := uc.ForLocation(context.Background(), domain.PropertyLocation{Text: "Vasai"})
	if res.Coverage == nil || res.Coverage.Status != "searched" || woken != 0 {
		t.Fatalf("a searched area must report it and not search again: %+v woken=%d", res.Coverage, woken)
	}
}

func TestForLocation_CoveredAreaIsNotRecorded(t *testing.T) {
	g := &fakeGeocoder{known: map[string]domain.GeoPoint{"Khadakpada, Maharashtra": {Latitude: 19.2525, Longitude: 73.1374}}}
	cov := &fakeCoverage{status: "queued"}
	projects := fixedProjects{{Name: "Metro Line 5", Status: "under_construction",
		Points: []domain.InfrastructurePoint{{Label: "Sahajanand Chowk", Latitude: 19.2446, Longitude: 73.1284}}}}
	uc := NewPlannedInfrastructureUsecase(oneParcel{}, projects, g, &memCache{m: map[string]GeocodeResult{}}).WithCoverage(cov, nil)
	res, _ := uc.ForLocation(context.Background(), domain.PropertyLocation{Text: "Khadakpada"})
	if res.Coverage != nil || len(cov.requests) != 0 {
		t.Fatalf("an area with a measured project nearby needs no search: %+v", res.Coverage)
	}
}

func TestResolve_GeocoderErrorDegradesAndIsNotCached(t *testing.T) {
	g := &fakeGeocoder{err: errors.New("HTTP 503")}
	c := &memCache{m: map[string]GeocodeResult{}}
	res, err := newUC("Khadakpada", g, c).ForParcel(context.Background(), uuid.New())
	if err != nil {
		t.Fatalf("a geocoder outage must not fail the request: %v", err)
	}
	if res.Location != nil || len(c.m) != 0 {
		t.Fatalf("outage must not produce a location or a cache entry: %+v %v", res.Location, c.m)
	}
}
