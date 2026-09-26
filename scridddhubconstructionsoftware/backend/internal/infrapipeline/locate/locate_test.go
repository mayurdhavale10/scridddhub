package locate

import (
	"context"
	"strings"
	"testing"

	"github.com/scridddhub/backend/internal/domain"
	"github.com/scridddhub/backend/internal/infrapipeline"
	"github.com/scridddhub/backend/internal/usecase"
)

type fakeGeo struct {
	points map[string]domain.GeoPoint // station name -> point
	calls  int
}

func (f *fakeGeo) Provider() string { return "fake" }
func (f *fakeGeo) Search(_ context.Context, q string) (usecase.GeocodeResult, error) {
	f.calls++
	for name, p := range f.points {
		if strings.HasPrefix(q, name+",") {
			return usecase.GeocodeResult{Found: true, Point: p}, nil
		}
	}
	return usecase.GeocodeResult{}, nil
}

func project(stations ...string) infrapipeline.VerifiedProject {
	var st []infrapipeline.NamedPlace
	for _, s := range stations {
		st = append(st, infrapipeline.NamedPlace{Name: s})
	}
	return infrapipeline.VerifiedProject{Project: infrapipeline.ExtractedProject{Name: "Metro Line 12 (Kalyan–Taloja)", Stations: st}}
}

func TestLocate_OfficialPointsWinWithoutGeocoding(t *testing.T) {
	g := &fakeGeo{}
	l := New(g, nil)
	pts, err := l.Locate(context.Background(), project("Kalyan APMC"), []infrapipeline.GeoPoint{{Label: "APMC Kalyan", Latitude: 19.235, Longitude: 73.122}})
	if err != nil || len(pts) != 1 || pts[0].CoordSource != infrapipeline.CoordOfficialFile || g.calls != 0 {
		t.Fatalf("official file must be used as-is, no geocoding: %+v calls=%d err=%v", pts, g.calls, err)
	}
}

func TestLocate_GeocodesAsApproximateAndDropsImplausible(t *testing.T) {
	g := &fakeGeo{points: map[string]domain.GeoPoint{
		"Kalyan APMC":   {Latitude: 19.235, Longitude: 73.122},
		"Dombivli MIDC": {Latitude: 19.212, Longitude: 73.098},
		"Taloja":        {Latitude: 19.063, Longitude: 73.118},
		"Pisarve":       {Latitude: 19.080, Longitude: 73.110},
		"Hedutane":      {Latitude: 28.61, Longitude: 77.21}, // geocoded to Delhi: outside MMR
		"Amandoot":      {Latitude: 19.95, Longitude: 72.70}, // inside the box but far from the others
	}}
	l := New(g, nil)
	pts, _ := l.Locate(context.Background(), project("Kalyan APMC", "Dombivli MIDC", "Taloja", "Pisarve", "Hedutane", "Amandoot", "Nowhere"), nil)
	got := map[string]bool{}
	for _, p := range pts {
		got[p.Label] = true
		if p.CoordSource != infrapipeline.CoordApproximate {
			t.Errorf("geocoded point %s must be approximate", p.Label)
		}
	}
	for _, want := range []string{"Kalyan APMC", "Dombivli MIDC", "Taloja", "Pisarve"} {
		if !got[want] {
			t.Errorf("%s should be located", want)
		}
	}
	for _, bad := range []string{"Hedutane", "Amandoot", "Nowhere"} {
		if got[bad] {
			t.Errorf("%s should have been rejected", bad)
		}
	}
}

func TestLocate_BudgetStopsGeocoding(t *testing.T) {
	g := &fakeGeo{points: map[string]domain.GeoPoint{"A": {Latitude: 19.2, Longitude: 73.1}, "B": {Latitude: 19.21, Longitude: 73.1}}}
	l := New(g, nil)
	l.Budget = 1
	_, err := l.Locate(context.Background(), project("A", "B"), nil)
	if g.calls != 1 || err == nil { // A found on the first query uses the whole budget
		t.Fatalf("budget of 1 must stop after one call and report it: calls=%d err=%v", g.calls, err)
	}
}

func TestLocate_RoadWithoutStationsUsesLocalitiesAsRoutePoints(t *testing.T) {
	g := &fakeGeo{points: map[string]domain.GeoPoint{"Sewri": {Latitude: 19.0, Longitude: 72.86}}}
	vp := infrapipeline.VerifiedProject{Project: infrapipeline.ExtractedProject{
		Name: "Atal Setu", Localities: []infrapipeline.NamedPlace{{Name: "Sewri"}},
	}}
	pts, _ := New(g, nil).Locate(context.Background(), vp, nil)
	if len(pts) != 1 || pts[0].Kind != infrapipeline.PointRoute || pts[0].CoordSource != infrapipeline.CoordApproximate {
		t.Fatalf("localities should become approximate route points: %+v", pts)
	}
}

func TestCleanStationName(t *testing.T) {
	cases := map[string]string{
		"Andheri (West)":     "Andheri West",
		"Dahisar(East)":      "Dahisar East",
		"Bhakti Park Metro":  "Bhakti Park",
		"Kalyan APMC":        "Kalyan APMC",
		"Orange Gate (MbPT)": "Orange Gate",
	}
	for in, want := range cases {
		if got := CleanStationName(in); got != want {
			t.Errorf("CleanStationName(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestLocate_StateWideFirstThenMumbai(t *testing.T) {
	g := &fallbackGeo{}
	l := New(g, nil)
	pts, _ := l.Locate(context.Background(), project("Asalpha"), nil)
	if len(pts) != 1 || len(g.queries) != 2 || g.queries[0] != "Asalpha, Maharashtra" || g.queries[1] != "Asalpha, Mumbai, Maharashtra" {
		t.Fatalf("should try state-wide first, then Mumbai: pts=%+v queries=%v", pts, g.queries)
	}
}

type fallbackGeo struct{ queries []string }

func (f *fallbackGeo) Provider() string { return "fake" }
func (f *fallbackGeo) Search(_ context.Context, q string) (usecase.GeocodeResult, error) {
	f.queries = append(f.queries, q)
	if q == "Asalpha, Mumbai, Maharashtra" {
		return usecase.GeocodeResult{Found: true, Point: domain.GeoPoint{Latitude: 19.06, Longitude: 73.12}}, nil
	}
	return usecase.GeocodeResult{}, nil
}
