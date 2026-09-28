package osm

import (
	"encoding/json"
	"os"
	"strings"
	"testing"

	"github.com/scridddhub/backend/internal/domain"
)

func loadFixture(t *testing.T, name string) []element {
	t.Helper()
	b, err := os.ReadFile("testdata/" + name)
	if err != nil {
		t.Fatal(err)
	}
	var out struct {
		Elements []element `json:"elements"`
	}
	if err := json.Unmarshal(b, &out); err != nil {
		t.Fatal(err)
	}
	return out.Elements
}

// Real Overpass answer for schools/colleges/hospitals within 3.8 km of Khadakpada, Kalyan
// (2026-09-27): 73 elements — 68 with a name, 2 with only name:en (Don Bosco School, Narayana
// Junior College), 3 unnamed hospitals.
func TestToPlaces_SocialFixture(t *testing.T) {
	places := toPlaces(loadFixture(t, "social_khadakpada.json"))
	if len(places) != 70 {
		t.Fatalf("got %d places, want the 70 with a name or name:en", len(places))
	}
	kinds := map[string]int{}
	for _, p := range places {
		kinds[p.Kind]++
		if p.Category != domain.InfraSocial {
			t.Errorf("%s: category %q, want social", p.Name, p.Category)
		}
		if len(p.Points) != 1 {
			t.Errorf("%s: %d points, want its centre", p.Name, len(p.Points))
		}
	}
	for _, k := range []string{"school", "college", "hospital"} {
		if kinds[k] == 0 {
			t.Errorf("no %s parsed", k)
		}
	}
}

// Real answer for landfills/sewage plants/power lines near Khadakpada: unnamed plants are kept
// with a plain label, and an existing sewage plant counts as a negative.
func TestToPlaces_NegativeFixture(t *testing.T) {
	places := toPlaces(loadFixture(t, "negative_khadakpada.json"))
	var landfill, stp bool
	for _, p := range places {
		if p.Category != domain.InfraNegative {
			t.Errorf("%s (%s): category %q, want negative", p.Name, p.Kind, p.Category)
		}
		switch p.Kind {
		case "landfill":
			landfill = p.Name == "Aadharwadi Dumping Ground"
		case "sewage_treatment":
			stp = true
		}
	}
	if !landfill || !stp {
		t.Errorf("want the Aadharwadi landfill and a sewage plant, got %+v", places)
	}
}

func TestToPlaces_PowerLineUsesGeometryAndVoltage(t *testing.T) {
	places := toPlaces([]element{{
		Type: "way", ID: 1, Tags: map[string]string{"power": "line", "voltage": "220000;110000"},
		Geom: []latLon{{19.25, 73.13}, {19.26, 73.14}},
	}})
	if len(places) != 1 || places[0].Name != "High-tension power line (220 kV)" || len(places[0].Points) != 2 {
		t.Fatalf("got %+v", places)
	}
}

func TestClassify_NewLayers(t *testing.T) {
	cases := []struct {
		tags     map[string]string
		kind     string
		category string
	}{
		{map[string]string{"railway": "station", "name": "Kalyan Junction"}, "rail_station", domain.InfraConnectivity},
		{map[string]string{"railway": "station", "station": "subway"}, "metro_station", domain.InfraConnectivity},
		{map[string]string{"highway": "motorway_junction"}, "expressway_exit", domain.InfraConnectivity},
		{map[string]string{"aeroway": "aerodrome", "iata": "BOM"}, "airport", domain.InfraConnectivity},
		{map[string]string{"leisure": "park"}, "park", domain.InfraSocial},
		{map[string]string{"amenity": "crematorium"}, "cemetery", domain.InfraNegative},
		{map[string]string{"landuse": "quarry"}, "quarry", domain.InfraNegative},
		{map[string]string{"natural": "wetland", "wetland": "mangrove"}, "mangrove", domain.InfraPlanning},
		{map[string]string{"boundary": "protected_area"}, "protected_area", domain.InfraPlanning},
	}
	for _, c := range cases {
		kind, _ := classify(c.tags)
		if kind != c.kind || domain.CategoryForKind(kind) != c.category {
			t.Errorf("%v: got %s/%s, want %s/%s", c.tags, kind, domain.CategoryForKind(kind), c.kind, c.category)
		}
	}
}

// Every kind OpenStreetMap can produce must be a known kind: CategoryForKind silently files an
// unknown one under connectivity.
func TestClassify_KindsAreKnown(t *testing.T) {
	for _, tags := range []map[string]string{
		{"railway": "station"}, {"railway": "station", "station": "subway"}, {"highway": "motorway_junction"},
		{"aeroway": "aerodrome"}, {"leisure": "park"}, {"shop": "mall"}, {"amenity": "crematorium"},
		{"landuse": "cemetery"}, {"landuse": "quarry"}, {"wetland": "mangrove"}, {"landuse": "forest"},
		{"boundary": "protected_area"}, {"amenity": "school"}, {"amenity": "college"}, {"amenity": "hospital"},
		{"landuse": "industrial"}, {"power": "substation"}, {"man_made": "water_works"}, {"landuse": "landfill"},
		{"man_made": "wastewater_plant"}, {"power": "line"},
	} {
		kind, _ := classify(tags)
		if _, ok := domain.InfraKindCategory[kind]; !ok {
			t.Errorf("%v -> %q is not in domain.InfraKindCategory", tags, kind)
		}
	}
}

// A protected area fetched as a relation: its outline arrives in its members, and the nearest
// edge (not a centre) is what distance is measured to.
func TestToPlaces_RelationOutlineFromMembers(t *testing.T) {
	var e element
	if err := json.Unmarshal([]byte(`{"type":"relation","id":7,"tags":{"boundary":"protected_area","name":"Thane Creek Flamingo Sanctuary"},
		"members":[{"geometry":[{"lat":19.10,"lon":72.98},{"lat":19.11,"lon":72.99}]},{"geometry":[{"lat":19.12,"lon":73.00}]}]}`), &e); err != nil {
		t.Fatal(err)
	}
	places := toPlaces([]element{e})
	if len(places) != 1 || len(places[0].Points) != 3 || places[0].Category != domain.InfraPlanning {
		t.Fatalf("got %+v", places)
	}
}

func TestQuery_ProtectedClipsOutlineToSearchBox(t *testing.T) {
	q := query(GroupProtected, domain.GeoPoint{Latitude: 19.155, Longitude: 72.995}, 0.8)
	if !strings.Contains(q, "out tags geom(") {
		t.Errorf("protected areas need clipped outlines, got %s", q)
	}
}

func TestQuery_SplitsNodeAndWayStatements(t *testing.T) {
	q := query(GroupSocial, domain.GeoPoint{Latitude: 19.255, Longitude: 73.135}, 0.8)
	if strings.Contains(q, "nwr[") {
		t.Error("regex over nwr timed out on the public server; use node/way statements")
	}
	if !strings.Contains(q, "around:3800,19.25500,73.13500") {
		t.Errorf("want school radius 3 km + 0.8 km pad, got %s", q)
	}
}
