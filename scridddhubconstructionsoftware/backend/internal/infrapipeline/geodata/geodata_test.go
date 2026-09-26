package geodata

import (
	"archive/zip"
	"bytes"
	"math"
	"os"
	"testing"

	"github.com/scridddhub/backend/internal/infrapipeline"
)

// testdata/mmrda_metro_line_5.kml is MMRDA's own published file, downloaded 2026-09-26 from
// https://mmrda.maharashtra.gov.in/sites/default/files/2025-03/metro_line-5.kml
func loadML5(t *testing.T) []byte {
	t.Helper()
	b, err := os.ReadFile("testdata/mmrda_metro_line_5.kml")
	if err != nil {
		t.Fatal(err)
	}
	return b
}

func TestParse_MMRDAMetroLine5KML(t *testing.T) {
	pts, err := Parser{}.Parse(loadML5(t), "application/vnd.google-earth.kml+xml", "metro_line-5.kml")
	if err != nil {
		t.Fatal(err)
	}
	stations := 0
	byLabel := map[string]infrapipeline.GeoPoint{}
	for _, p := range pts {
		if p.Kind == infrapipeline.PointStation {
			stations++
			byLabel[p.Label] = p
		}
	}
	if stations != 17 {
		t.Fatalf("want 17 stations, got %d (%v)", stations, pts)
	}
	apmc, ok := byLabel["APMC Kalyan"]
	if !ok {
		t.Fatalf("APMC Kalyan missing; labels: %v", byLabel)
	}
	// Must be the Point, not the LookAt camera position, and lat/lng the right way round.
	if math.Abs(apmc.Latitude-19.235337) > 1e-6 || math.Abs(apmc.Longitude-73.122788) > 1e-6 {
		t.Errorf("APMC Kalyan at %.6f,%.6f; want 19.235337,73.122788", apmc.Latitude, apmc.Longitude)
	}
	if _, ok := byLabel["Bhiwandi"]; !ok {
		t.Errorf("'Bhiwandi(M) Statiion' should clean to 'Bhiwandi'; labels: %v", byLabel)
	}
}

func TestParse_KMZ(t *testing.T) {
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	w, _ := zw.Create("doc.kml")
	w.Write(loadML5(t))
	zw.Close()
	pts, err := Parser{}.Parse(buf.Bytes(), "application/vnd.google-earth.kmz", "x.kmz")
	if err != nil || len(pts) < 17 {
		t.Fatalf("KMZ should parse like KML: %d points, err %v", len(pts), err)
	}
}

func TestParse_KMLLineString(t *testing.T) {
	kml := `<kml><Document><Placemark><name>Route A</name><LineString><coordinates>
		73.10,19.20,0 73.11,19.21,0 73.12,19.22,0</coordinates></LineString></Placemark></Document></kml>`
	pts, err := Parser{}.Parse([]byte(kml), "", "")
	if err != nil || len(pts) != 3 || pts[0].Kind != infrapipeline.PointRoute || pts[2].Latitude != 19.22 {
		t.Fatalf("line vertices expected as route points: %+v %v", pts, err)
	}
}

func TestParse_GeoJSON(t *testing.T) {
	gj := `{"type":"FeatureCollection","features":[
		{"type":"Feature","properties":{"name":"Vashi (M) Station"},"geometry":{"type":"Point","coordinates":[72.998,19.077]}},
		{"type":"Feature","properties":{"name":"Corridor"},"geometry":{"type":"LineString","coordinates":[[72.9,19.0],[73.0,19.1]]}},
		{"type":"Feature","properties":{},"geometry":null}]}`
	pts, err := Parser{}.Parse([]byte(gj), "application/geo+json", "")
	if err != nil || len(pts) != 3 {
		t.Fatalf("got %+v, %v", pts, err)
	}
	if pts[0].Label != "Vashi" || pts[0].Latitude != 19.077 || pts[0].Longitude != 72.998 {
		t.Errorf("unexpected point %+v", pts[0])
	}
}

func TestParse_Unrecognized(t *testing.T) {
	if _, err := (Parser{}).Parse([]byte("hello"), "text/plain", ""); err == nil {
		t.Error("plain text must be rejected")
	}
}

func TestCleanLabel(t *testing.T) {
	cases := map[string]string{
		"Bhiwandi(M) Statiion":                "Bhiwandi",
		"Kalyan (M) Station":                  "Kalyan",
		"Dhamankar Naka (M) Station":          "Dhamankar Naka",
		"Line 5 (Thane -Bhiwandi-Kalyan).kml": "Line 5 (Thane -Bhiwandi-Kalyan)",
	}
	for in, want := range cases {
		if got := CleanLabel(in); got != want {
			t.Errorf("CleanLabel(%q) = %q, want %q", in, got, want)
		}
	}
}
