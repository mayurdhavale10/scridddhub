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
			return usecase.GeocodeResult{Found: true, Point: p, DisplayName: name + ", Maharashtra, India", PlaceType: "suburb"}, nil
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
		return usecase.GeocodeResult{Found: true, Point: domain.GeoPoint{Latitude: 19.06, Longitude: 73.12},
			DisplayName: "Asalpha, Ghatkopar West, Mumbai", PlaceType: "suburb"}, nil
	}
	return usecase.GeocodeResult{}, nil
}

// scriptedGeo answers each query with a fixed result — the real Nominatim answers seen
// 2026-09-29 for names that ended up as wrong points.
type scriptedGeo struct {
	answers map[string]usecase.GeocodeResult
	queries []string
}

func (s *scriptedGeo) Provider() string { return "fake" }
func (s *scriptedGeo) Search(_ context.Context, q string) (usecase.GeocodeResult, error) {
	s.queries = append(s.queries, q)
	return s.answers[q], nil
}

func found(lat, lng float64, display, placeType string) usecase.GeocodeResult {
	return usecase.GeocodeResult{Found: true, Point: domain.GeoPoint{Latitude: lat, Longitude: lng}, DisplayName: display, PlaceType: placeType}
}

func TestLocate_RejectsNamesakesAndRegions(t *testing.T) {
	g := &scriptedGeo{answers: map[string]usecase.GeocodeResult{
		// Gujarat station: a building of the same name in Anushakti Nagar.
		"Sabarmati, Maharashtra": found(19.0398, 72.9169, "Sabarmati, Dr. A P J Abdul Kalam Road, Anushakti Nagar, Mumbai", "building"),
		// Gujarat city: the rail line that contains its name.
		"Ahmedabad, Maharashtra": found(19.0991, 72.9557, "Mumbai–Ahmedabad high-speed rail (under construction), N Ward, Mumbai", "railway"),
		// Found state-wide far away — must not then be retried in Mumbai.
		"Amravati, Maharashtra":         found(21.1545, 77.6443, "Amravati, Maharashtra, India", "city"),
		"Amravati, Mumbai, Maharashtra": found(19.0464, 72.8626, "Ashirwad Nursing Home, Amravati, Sant Rohidas Marg, Mumbai", "amenity"),
		// A flyover whose name contains the village's.
		"Kune, Maharashtra": found(18.7659, 73.3883, "Kune Flyover, Summer Hill, Lonavala, Pune", "road"),
		// A whole district: its centre is ~25 km from Thane city.
		"Thane, Maharashtra": found(19.3654, 73.3685, "Thane, Maharashtra, India", "state_district"),
		// A facility mapped as a building is still the place when its name says so.
		"Khalapur Toll Plaza, Maharashtra": found(18.8010, 73.2852, "Khalapur Toll Plaza, Mumbai - Pune Expressway, Savroli", "building"),
		// Real places, accepted.
		"Bandra Kurla Complex, Maharashtra": found(19.0607, 72.8547, "Bandra Kurla Complex, Bandra East, Mumbai", "suburb"),
		"Virar, Maharashtra":                found(19.4498, 72.8121, "Virar, Vasai-Virar, Palghar, Maharashtra", "town"),
		"Kanjurmarg, Maharashtra":           found(19.1290, 72.9280, "Kanjur Marg, S Ward, Mumbai", "suburb"),
	}}
	vp := project("Sabarmati", "Ahmedabad", "Amravati", "Kune", "Thane", "Khalapur Toll Plaza",
		"Bandra Kurla Complex", "Virar", "Kanjurmarg", "Eastern Express Highway", "Mumbai")
	l := New(g, nil)
	l.MaxGapKm = 100 // this test is about matching, not the isolation check
	pts, _ := l.Locate(context.Background(), vp, nil)
	got := map[string]bool{}
	for _, p := range pts {
		got[p.Label] = true
	}
	if len(pts) != 4 || !got["Bandra Kurla Complex"] || !got["Virar"] || !got["Khalapur Toll Plaza"] || !got["Kanjurmarg"] {
		t.Errorf("want only BKC, Virar, Khalapur Toll Plaza and Kanjurmarg, got %+v", pts)
	}
	for _, q := range g.queries {
		switch q {
		case "Amravati, Mumbai, Maharashtra":
			t.Error("a name found outside the region must not be retried in Mumbai")
		case "Eastern Express Highway, Maharashtra", "Mumbai, Maharashtra":
			t.Errorf("road and region names must not be geocoded (%q)", q)
		}
	}
}
