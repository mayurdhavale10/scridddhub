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

func TestQuery_SplitsNodeAndWayStatements(t *testing.T) {
	q := query(GroupSocial, domain.GeoPoint{Latitude: 19.255, Longitude: 73.135}, 0.8)
	if strings.Contains(q, "nwr[") {
		t.Error("regex over nwr timed out on the public server; use node/way statements")
	}
	if !strings.Contains(q, "around:3800,19.25500,73.13500") {
		t.Errorf("want school radius 3 km + 0.8 km pad, got %s", q)
	}
}
