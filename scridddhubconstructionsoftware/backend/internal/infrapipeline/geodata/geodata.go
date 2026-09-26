// Package geodata parses official geodata files (KML, KMZ, GeoJSON) into located points for the
// planned-infrastructure pipeline (PIPELINE_PLAN.md, task T1.3).
package geodata

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"regexp"
	"strconv"
	"strings"

	"github.com/scridddhub/backend/internal/infrapipeline"
)

type Parser struct{}

var _ infrapipeline.GeodataParser = Parser{}

// maxRoutePoints caps vertices kept per line so a detailed route doesn't flood the points table;
// every Nth vertex is kept, always including both ends.
const maxRoutePoints = 200

// Parse detects the format from the bytes (zip → KMZ, '<' → KML, '{' → GeoJSON), falling back to
// contentType/url hints only when the bytes are ambiguous.
func (Parser) Parse(raw []byte, contentType, url string) ([]infrapipeline.GeoPoint, error) {
	trimmed := bytes.TrimPrefix(bytes.TrimLeft(raw, " \t\r\n"), []byte("\xef\xbb\xbf")) // strip BOM
	switch {
	case bytes.HasPrefix(raw, []byte("PK\x03\x04")):
		return parseKMZ(raw)
	case bytes.HasPrefix(trimmed, []byte("<")):
		return parseKML(trimmed)
	case bytes.HasPrefix(trimmed, []byte("{")):
		return parseGeoJSON(trimmed)
	}
	return nil, fmt.Errorf("geodata: unrecognized format (content-type %q, url %q)", contentType, url)
}

func parseKMZ(raw []byte) ([]infrapipeline.GeoPoint, error) {
	zr, err := zip.NewReader(bytes.NewReader(raw), int64(len(raw)))
	if err != nil {
		return nil, fmt.Errorf("geodata: reading KMZ: %w", err)
	}
	for _, f := range zr.File {
		if strings.HasSuffix(strings.ToLower(f.Name), ".kml") {
			rc, err := f.Open()
			if err != nil {
				return nil, err
			}
			data, err := io.ReadAll(io.LimitReader(rc, 50<<20))
			rc.Close()
			if err != nil {
				return nil, err
			}
			return parseKML(data)
		}
	}
	return nil, fmt.Errorf("geodata: KMZ contains no .kml file")
}

// parseKML streams the document and reads coordinates only from <Point> and <LineString> inside a
// <Placemark> — never from <LookAt> (a camera position that also carries lat/lng) and not from
// polygons (area outlines, not stations or routes).
func parseKML(data []byte) ([]infrapipeline.GeoPoint, error) {
	dec := xml.NewDecoder(bytes.NewReader(data))
	dec.Strict = false

	var (
		out           []infrapipeline.GeoPoint
		path          []string
		placemarkName string
		inPlacemark   bool
		geomKind      string // "point" | "line" | ""
		text          strings.Builder
	)
	for {
		tok, err := dec.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("geodata: parsing KML: %w", err)
		}
		switch t := tok.(type) {
		case xml.StartElement:
			name := t.Name.Local
			path = append(path, name)
			text.Reset()
			switch name {
			case "Placemark":
				inPlacemark, placemarkName = true, ""
			case "Point":
				geomKind = "point"
			case "LineString":
				geomKind = "line"
			case "Polygon":
				geomKind = "" // skip outlines
			}
		case xml.CharData:
			text.Write(t)
		case xml.EndElement:
			name := t.Name.Local
			parent := ""
			if len(path) >= 2 {
				parent = path[len(path)-2]
			}
			switch {
			case name == "name" && parent == "Placemark":
				placemarkName = strings.TrimSpace(text.String())
			case name == "coordinates" && inPlacemark && (parent == "Point" || parent == "LineString"):
				coords := parseKMLCoordinates(text.String())
				if geomKind == "point" && parent == "Point" && len(coords) > 0 {
					out = append(out, point(CleanLabel(placemarkName), infrapipeline.PointStation, coords[0]))
				}
				if geomKind == "line" && parent == "LineString" {
					for i, c := range thin(coords) {
						out = append(out, point(fmt.Sprintf("%s #%d", CleanLabel(placemarkName), i+1), infrapipeline.PointRoute, c))
					}
				}
			case name == "Point" || name == "LineString":
				geomKind = ""
			case name == "Placemark":
				inPlacemark = false
			}
			if len(path) > 0 {
				path = path[:len(path)-1]
			}
		}
	}
	return out, nil
}

type lonLat struct{ lon, lat float64 }

// parseKMLCoordinates reads "lon,lat[,alt] lon,lat[,alt] ..." — KML puts longitude first.
func parseKMLCoordinates(s string) []lonLat {
	var out []lonLat
	for _, tuple := range strings.Fields(s) {
		parts := strings.Split(tuple, ",")
		if len(parts) < 2 {
			continue
		}
		lon, err1 := strconv.ParseFloat(parts[0], 64)
		lat, err2 := strconv.ParseFloat(parts[1], 64)
		if err1 == nil && err2 == nil && validLatLng(lat, lon) {
			out = append(out, lonLat{lon, lat})
		}
	}
	return out
}

func point(label string, kind infrapipeline.PointKind, c lonLat) infrapipeline.GeoPoint {
	return infrapipeline.GeoPoint{Label: label, Kind: kind, Latitude: c.lat, Longitude: c.lon}
}

func validLatLng(lat, lon float64) bool {
	return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
}

func thin(coords []lonLat) []lonLat {
	if len(coords) <= maxRoutePoints {
		return coords
	}
	step := (len(coords) + maxRoutePoints - 1) / maxRoutePoints
	var out []lonLat
	for i := 0; i < len(coords); i += step {
		out = append(out, coords[i])
	}
	if last := coords[len(coords)-1]; out[len(out)-1] != last {
		out = append(out, last)
	}
	return out
}

// --- GeoJSON ------------------------------------------------------------------------------

type gjFeatureCollection struct {
	Type     string      `json:"type"`
	Features []gjFeature `json:"features"`
}

type gjFeature struct {
	Properties map[string]any `json:"properties"`
	Geometry   *gjGeometry    `json:"geometry"`
}

type gjGeometry struct {
	Type        string          `json:"type"`
	Coordinates json.RawMessage `json:"coordinates"`
}

func parseGeoJSON(data []byte) ([]infrapipeline.GeoPoint, error) {
	var fc gjFeatureCollection
	if err := json.Unmarshal(data, &fc); err != nil {
		return nil, fmt.Errorf("geodata: parsing GeoJSON: %w", err)
	}
	if fc.Type == "Feature" { // a single feature at the top level
		var f gjFeature
		if err := json.Unmarshal(data, &f); err != nil {
			return nil, err
		}
		fc.Features = []gjFeature{f}
	}
	var out []infrapipeline.GeoPoint
	for _, f := range fc.Features {
		if f.Geometry == nil {
			continue
		}
		label := CleanLabel(featureName(f.Properties))
		switch f.Geometry.Type {
		case "Point":
			var c []float64
			if json.Unmarshal(f.Geometry.Coordinates, &c) == nil && len(c) >= 2 && validLatLng(c[1], c[0]) {
				out = append(out, point(label, infrapipeline.PointStation, lonLat{c[0], c[1]}))
			}
		case "LineString":
			var cs [][]float64
			if json.Unmarshal(f.Geometry.Coordinates, &cs) == nil {
				out = appendLine(out, label, cs)
			}
		case "MultiLineString":
			var mls [][][]float64
			if json.Unmarshal(f.Geometry.Coordinates, &mls) == nil {
				for _, cs := range mls {
					out = appendLine(out, label, cs)
				}
			}
		}
	}
	return out, nil
}

func appendLine(out []infrapipeline.GeoPoint, label string, cs [][]float64) []infrapipeline.GeoPoint {
	var coords []lonLat
	for _, c := range cs {
		if len(c) >= 2 && validLatLng(c[1], c[0]) {
			coords = append(coords, lonLat{c[0], c[1]})
		}
	}
	for i, c := range thin(coords) {
		out = append(out, point(fmt.Sprintf("%s #%d", label, i+1), infrapipeline.PointRoute, c))
	}
	return out
}

func featureName(props map[string]any) string {
	for _, k := range []string{"name", "Name", "NAME", "station", "Station", "title"} {
		if v, ok := props[k].(string); ok && strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

var (
	metroMarker  = regexp.MustCompile(`\(\s*M\s*\)`)
	stationWord  = regexp.MustCompile(`(?i)\bstat+i+on\b`) // "Station", "Statiion", "Staion"-style typos
	multiSpace   = regexp.MustCompile(`\s+`)
	kmlExtension = regexp.MustCompile(`(?i)\.km[lz]$`)
)

// CleanLabel turns a raw placemark name like "Bhiwandi(M) Statiion" into "Bhiwandi".
func CleanLabel(s string) string {
	s = metroMarker.ReplaceAllString(s, " ")
	s = stationWord.ReplaceAllString(s, " ")
	s = kmlExtension.ReplaceAllString(s, "")
	return strings.TrimSpace(multiSpace.ReplaceAllString(s, " "))
}
