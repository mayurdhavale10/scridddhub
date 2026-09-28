// Package osm finds existing places near a property (schools, hospitals, substations, landfills,
// sewage plants, power lines) in OpenStreetMap through the Overpass API, cached per ~1 km cell.
// It implements usecase.NearbyPlaceFinder. Data © OpenStreetMap contributors (ODbL) — shown with
// attribution in the app.
package osm

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/scridddhub/backend/internal/domain"
)

// Query groups. Each is one small Overpass query: one big query covering everything timed out
// (HTTP 504) on the public server, and so did a single regex-over-nwr query for schools
// (2026-09-27), while separate node/way statements answered in ~6 s.
const (
	GroupSocial    = "social"    // schools, colleges, hospitals
	GroupUtilities = "utilities" // transmission substations, water works
	GroupNegative  = "negative"  // landfills, sewage plants, high-tension lines
	GroupJobs      = "jobs"      // named industrial areas (MIDC estates, large plants)
	// Added 2026-09-28:
	GroupConnectivity = "connectivity" // existing rail/metro stations, expressway exits, airports
	GroupAmenities    = "amenities"    // named parks and grounds, malls
	GroupProtected    = "protected"    // mangroves, forest land, protected areas
)

var Groups = []string{GroupConnectivity, GroupSocial, GroupAmenities, GroupJobs, GroupUtilities, GroupNegative, GroupProtected}

// DefaultEndpoints: the main public Overpass server first. Override with OVERPASS_URLS.
var DefaultEndpoints = []string{"https://overpass-api.de/api/interpreter"}

// Overpass queries the public Overpass API politely: an identifying User-Agent, one query in
// flight at a time, and on overload (HTTP 504/429) retries with pauses before moving to the next
// endpoint.
type Overpass struct {
	endpoints []string
	userAgent string
	client    *http.Client
	slots     chan struct{}
	retryWait time.Duration
}

func NewOverpass(endpoints []string) *Overpass {
	if len(endpoints) == 0 {
		endpoints = DefaultEndpoints
	}
	return &Overpass{
		endpoints: endpoints,
		userAgent: "ScridddHub/0.1 (land-parcel planning ERP; development)",
		client:    &http.Client{Timeout: 40 * time.Second},
		slots:     make(chan struct{}, 1),
		retryWait: 5 * time.Second,
	}
}

// query builds the Overpass QL for a group around centre, reaching radiusKm plus padKm.
func query(group string, centre domain.GeoPoint, padKm float64) string {
	around := func(kind string) string {
		m := int((domain.NearbyPlaceRadiusKm(kind) + padKm) * 1000)
		return fmt.Sprintf("(around:%d,%.5f,%.5f)", m, centre.Latitude, centre.Longitude)
	}
	var b strings.Builder
	b.WriteString("[out:json][timeout:25];")
	switch group {
	case GroupSocial:
		a := around("school")
		fmt.Fprintf(&b, `(node["amenity"="school"]%[1]s;way["amenity"="school"]%[1]s;`+
			`node["amenity"~"^(college|university|hospital)$"]%[1]s;way["amenity"~"^(college|university|hospital)$"]%[1]s;);`+
			`out center tags;`, a)
	case GroupUtilities:
		// Only transmission-level substations: the city is full of tiny distribution ones.
		fmt.Fprintf(&b, `(node["power"="substation"]["substation"!~"distribution"]%[1]s;way["power"="substation"]["substation"!~"distribution"]%[1]s;`+
			`node["man_made"="water_works"]%[1]s;way["man_made"="water_works"]%[1]s;);out center tags;`, around("power_substation"))
	case GroupJobs:
		// Named industrial landuse only: adding office=it (single company offices) or a regex on
		// commercial names made the query time out (2026-09-27).
		fmt.Fprintf(&b, `(way["landuse"="industrial"]["name"]%[1]s;relation["landuse"="industrial"]["name"]%[1]s;);out center tags;`,
			around("industrial_estate"))
	case GroupNegative:
		fmt.Fprintf(&b, `(way["landuse"="landfill"]%s;way["man_made"="wastewater_plant"]%s;node["man_made"="wastewater_plant"]%[2]s;`+
			`way["landuse"="cemetery"]%[3]s;way["amenity"~"^(grave_yard|crematorium)$"]%[3]s;node["amenity"="crematorium"]%[3]s;`+
			`way["landuse"="quarry"]%[4]s;)->.a;`+
			`way["power"="line"]%[5]s->.b;.a out center tags;.b out geom tags;`,
			around("landfill"), around("sewage_treatment"), around("cemetery"), around("quarry"), around("high_tension_line"))
	case GroupConnectivity:
		// Stations are mapped as points in some places (Kalyan) and as station buildings in others
		// (Airoli, Rabale — checked 2026-09-28), so both; the same name appears once after matching.
		fmt.Fprintf(&b, `(node["railway"="station"]%[1]s;way["railway"="station"]%[1]s;node["highway"="motorway_junction"]%s;way["aeroway"="aerodrome"]["iata"]%s;);out center tags;`,
			around("rail_station"), around("expressway_exit"), around("airport"))
	case GroupAmenities:
		fmt.Fprintf(&b, `(way["leisure"="park"]["name"]%s;node["shop"="mall"]%[2]s;way["shop"="mall"]%[2]s;);out center tags;`,
			around("park"), around("mall"))
	case GroupProtected:
		// Large polygons: distance to the centre of a forest says nothing about its edge, so the
		// outline is fetched — clipped to the search box, which keeps the answer small.
		km := domain.NearbyPlaceRadiusKm("forest") + padKm
		dLat := km / 111.0
		dLng := km / (111.0 * math.Cos(centre.Latitude*math.Pi/180))
		fmt.Fprintf(&b, `(way["wetland"="mangrove"]%s;way["landuse"="forest"]%s;relation["boundary"="protected_area"]%[2]s;way["leisure"="nature_reserve"]%[2]s;);`+
			`out tags geom(%.5f,%.5f,%.5f,%.5f);`,
			around("mangrove"), around("forest"),
			centre.Latitude-dLat, centre.Longitude-dLng, centre.Latitude+dLat, centre.Longitude+dLng)
	}
	return b.String()
}

type element struct {
	Type   string            `json:"type"`
	ID     int64             `json:"id"`
	Lat    float64           `json:"lat"`
	Lon    float64           `json:"lon"`
	Center *latLon           `json:"center"`
	Geom   []latLon          `json:"geometry"`
	Tags   map[string]string `json:"tags"`
	// Relations fetched with "out geom" carry their outline in their members.
	Members []struct {
		Geom []latLon `json:"geometry"`
	} `json:"members"`
}

type latLon struct {
	Lat float64 `json:"lat"`
	Lon float64 `json:"lon"`
}

var errOverloaded = errors.New("overpass: server busy")

// Fetch returns every place in a group around centre, within each kind's radius plus padKm.
func (o *Overpass) Fetch(ctx context.Context, group string, centre domain.GeoPoint, padKm float64) ([]domain.NearbyPlace, error) {
	select {
	case o.slots <- struct{}{}:
		defer func() { <-o.slots }()
	case <-ctx.Done():
		return nil, ctx.Err()
	}
	q := query(group, centre, padKm)
	var lastErr error
	for _, ep := range o.endpoints {
		// The public server alternates 200/504 on the identical query under load (2026-09-27),
		// so overload is retried twice more, pausing 5 s then 10 s.
		for attempt := 1; attempt <= 3; attempt++ {
			els, err := o.post(ctx, ep, q)
			if err == nil {
				return toPlaces(els), nil
			}
			lastErr = err
			if !errors.Is(err, errOverloaded) || attempt == 3 {
				break
			}
			select {
			case <-time.After(time.Duration(attempt) * o.retryWait):
			case <-ctx.Done():
				return nil, lastErr
			}
		}
	}
	return nil, lastErr
}

func (o *Overpass) post(ctx context.Context, endpoint, q string) ([]element, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(url.Values{"data": {q}}.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("User-Agent", o.userAgent)
	resp, err := o.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	switch {
	case resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode == http.StatusGatewayTimeout:
		return nil, fmt.Errorf("%w (HTTP %d from %s)", errOverloaded, resp.StatusCode, endpoint)
	case resp.StatusCode != http.StatusOK:
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 300))
		return nil, fmt.Errorf("overpass: HTTP %d from %s: %s", resp.StatusCode, endpoint, body)
	}
	var out struct {
		Elements []element `json:"elements"`
		Remark   string    `json:"remark"` // set when the server gave up (e.g. query timeout)
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, fmt.Errorf("overpass: decoding response: %w", err)
	}
	if strings.Contains(strings.ToLower(out.Remark), "error") {
		return nil, fmt.Errorf("overpass: %s", out.Remark)
	}
	return out.Elements, nil
}

// toPlaces maps OpenStreetMap elements to places. Schools, colleges and hospitals without a name
// are skipped (an unnamed pin isn't useful to a buyer); landfills, sewage plants and power lines
// are kept with a plain label because their presence is what matters.
func toPlaces(els []element) []domain.NearbyPlace {
	out := make([]domain.NearbyPlace, 0, len(els))
	for _, e := range els {
		kind, label := classify(e.Tags)
		if kind == "" {
			continue
		}
		name := strings.TrimSpace(e.Tags["name:en"])
		if name == "" {
			name = strings.TrimSpace(e.Tags["name"])
		}
		if name == "" {
			if label == "" {
				continue
			}
			name = label
		}
		if kind == "high_tension_line" {
			if kv := voltageKV(e.Tags["voltage"]); kv > 0 {
				name = fmt.Sprintf("%s (%d kV)", name, kv)
			}
		}
		p := domain.NearbyPlace{OSMType: e.Type, OSMID: e.ID, Name: name, Kind: kind, Category: domain.CategoryForKind(kind)}
		if kind == "sewage_treatment" {
			p.Category = domain.InfraNegative // an existing plant next door is a nuisance, not an amenity
		}
		geom := e.Geom
		for _, m := range e.Members {
			geom = append(geom, m.Geom...)
		}
		switch {
		case len(geom) > 0:
			for _, g := range geom {
				p.Points = append(p.Points, domain.GeoPoint{Latitude: g.Lat, Longitude: g.Lon})
			}
		case e.Center != nil:
			p.Points = []domain.GeoPoint{{Latitude: e.Center.Lat, Longitude: e.Center.Lon}}
		case e.Type == "node":
			p.Points = []domain.GeoPoint{{Latitude: e.Lat, Longitude: e.Lon}}
		}
		if len(p.Points) > 0 {
			out = append(out, p)
		}
	}
	return out
}

// classify returns the kind and, for places whose presence matters more than their name, a label.
func classify(t map[string]string) (kind, label string) {
	switch {
	case t["railway"] == "station":
		switch t["station"] {
		case "subway", "light_rail", "monorail":
			return "metro_station", ""
		}
		return "rail_station", ""
	case t["highway"] == "motorway_junction":
		return "expressway_exit", "Expressway exit"
	case t["aeroway"] == "aerodrome":
		return "airport", ""
	case t["leisure"] == "park":
		return "park", ""
	case t["shop"] == "mall":
		return "mall", ""
	case t["amenity"] == "crematorium":
		return "cemetery", "Crematorium"
	case t["landuse"] == "cemetery" || t["amenity"] == "grave_yard":
		return "cemetery", "Cemetery"
	case t["landuse"] == "quarry":
		return "quarry", "Quarry"
	case t["wetland"] == "mangrove":
		return "mangrove", "Mangroves (protected)"
	case t["landuse"] == "forest":
		return "forest", "Forest land"
	case t["boundary"] == "protected_area" || t["leisure"] == "nature_reserve":
		return "protected_area", "Protected area"
	case t["amenity"] == "school":
		return "school", ""
	case t["amenity"] == "college" || t["amenity"] == "university":
		return "college", ""
	case t["amenity"] == "hospital":
		return "hospital", ""
	case t["landuse"] == "industrial":
		return "industrial_estate", ""
	case t["power"] == "substation":
		return "power_substation", "Power substation"
	case t["man_made"] == "water_works":
		return "water_supply", "Water treatment works"
	case t["landuse"] == "landfill":
		return "landfill", "Landfill / dumping ground"
	case t["man_made"] == "wastewater_plant":
		return "sewage_treatment", "Sewage treatment plant"
	case t["power"] == "line":
		return "high_tension_line", "High-tension power line"
	}
	return "", ""
}

// voltageKV reads OSM's voltage tag ("220000" or "220000;110000") as the highest value in kV.
func voltageKV(v string) int {
	best := 0
	for _, part := range strings.Split(v, ";") {
		if n, err := strconv.Atoi(strings.TrimSpace(part)); err == nil && n/1000 > best {
			best = n / 1000
		}
	}
	return best
}
