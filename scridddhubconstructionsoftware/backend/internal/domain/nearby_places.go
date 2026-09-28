package domain

import (
	"math"
	"sort"
	"strconv"
	"strings"
)

// NearbyPlace is something that already exists near a property (a school, a hospital, a landfill,
// a power line) as mapped in OpenStreetMap. Unlike InfrastructureProject it isn't planned, isn't
// AI-extracted and isn't reviewed: it's shown as-is with OpenStreetMap as the source.
type NearbyPlace struct {
	OSMType  string // node | way | relation
	OSMID    int64
	Name     string
	Kind     string // an InfraKindCategory kind (osm.classify lists the ones OpenStreetMap supplies)
	Category string // usually CategoryForKind(Kind); an existing sewage plant is "negative"
	// Points: one for a place (its centre), every vertex for a line — distance is to the nearest.
	Points []GeoPoint
}

// NearbyPlaceMatch is a NearbyPlace with its straight-line distance from the property.
type NearbyPlaceMatch struct {
	Place      NearbyPlace
	DistanceKm float64
}

// NearbyPlaceRadiusKm is how far each kind of existing place is worth mentioning. A school or
// hospital matters within a short drive; a landfill's smell and reputation carry further; a
// high-tension line only matters if it's close to (or over) the land; an industrial estate is a
// commute-distance employer.
// Airports matter at city scale; a cemetery or mangrove only right next door (mangroves carry a
// no-construction buffer).
func NearbyPlaceRadiusKm(kind string) float64 {
	switch kind {
	case "airport":
		return 40
	case "landfill", "industrial_estate", "expressway_exit":
		return 5
	case "high_tension_line", "cemetery", "mangrove":
		return 1
	case "forest", "protected_area":
		return 1.5
	case "power_substation", "water_supply", "park":
		return 2
	default: // school, college, hospital, sewage_treatment, rail/metro station, mall, quarry
		return 3
	}
}

// MatchNearbyPlaces keeps each place within its kind's radius of at, nearest first. Same kind and
// name appear once (the nearest): OpenStreetMap maps one power line as many segments, and often
// has a school both as a pin and as a building outline.
func MatchNearbyPlaces(at GeoPoint, places []NearbyPlace) []NearbyPlaceMatch {
	out := make([]NearbyPlaceMatch, 0, len(places))
	for _, p := range places {
		if len(p.Points) == 0 {
			continue
		}
		d := math.Inf(1)
		for _, pt := range p.Points {
			d = math.Min(d, HaversineKm(at, pt))
		}
		if d <= NearbyPlaceRadiusKm(p.Kind) {
			out = append(out, NearbyPlaceMatch{Place: p, DistanceKm: math.Round(d*10) / 10})
		}
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].DistanceKm < out[j].DistanceKm })
	seen := map[string]bool{}
	unique := out[:0]
	for _, m := range out {
		key := m.Place.Kind + "|" + strings.ToLower(strings.TrimSpace(m.Place.Name))
		if !seen[key] {
			seen[key] = true
			unique = append(unique, m)
		}
	}
	return unique
}

// nearbyCellDeg is the cache grid for existing places: 0.01° ≈ 1.1 km in Mumbai. Much finer than
// CoverageCell because a dense city has hundreds of schools within 5 km — small cells keep each
// OpenStreetMap query small enough not to time out.
const nearbyCellDeg = 0.01

// NearbyCellHalfDiagonalKm is the farthest a point can be from its cell's centre (≈0.78 km). A
// lookup around the centre must reach this much further so no place near any point is missed.
const NearbyCellHalfDiagonalKm = 0.8

// NearbyCell buckets a point into its cache cell: the key ("19.25,73.13") and the cell's centre.
func NearbyCell(p GeoPoint) (string, GeoPoint) {
	latCell := math.Floor(p.Latitude / nearbyCellDeg)
	lngCell := math.Floor(p.Longitude / nearbyCellDeg)
	key := strconv.FormatFloat(latCell*nearbyCellDeg, 'f', 2, 64) + "," + strconv.FormatFloat(lngCell*nearbyCellDeg, 'f', 2, 64)
	return key, GeoPoint{Latitude: (latCell + 0.5) * nearbyCellDeg, Longitude: (lngCell + 0.5) * nearbyCellDeg}
}
