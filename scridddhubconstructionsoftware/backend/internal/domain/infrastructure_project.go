package domain

import (
	"math"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
)

// InfrastructureProject is one real public project (metro line, highway, airport...) from the
// shared reference list (migrations 000028/000029). Reference data, not a business entity: no
// audit trail, not editable through the app. Only 'approved' projects are ever matched to parcels.
type InfrastructureProject struct {
	ID                 uuid.UUID
	Name               string
	Kind               string
	Status             string
	ExpectedCompletion string // free text, may be a range; "" when unknown
	Description        string
	SourceName         string
	SourceURL          string
	VerifiedAt         time.Time
	VerifiedBy         string
	Areas              []InfrastructureProjectArea
	Points             []InfrastructurePoint
}

type InfrastructureProjectArea struct {
	District string
	Taluka   string
	Note     string
}

// InfrastructurePoint is a located part of a project — a station, or a route vertex.
type InfrastructurePoint struct {
	Label       string
	Kind        string // station | route
	Latitude    float64
	Longitude   float64
	CoordSource string // official_file | approximate | manual
}

// PropertyLocation is what "what's planned near here?" is asked about: a saved parcel's location,
// or any location typed in before a parcel exists. District/Taluka are set only when known
// (picked from the real village list); Text is always present.
type PropertyLocation struct {
	Text     string
	District *string
	Taluka   *string
}

// GeoPoint is a resolved location for a free-text location.
type GeoPoint struct {
	Latitude  float64
	Longitude float64
}

// How a parcel was matched to a project — shown to the user so a looser match is never presented
// as if it were as reliable as a measured one.
const (
	MatchBasisDistance     = "distance"      // measured from the parcel's resolved location to the project's nearest point
	MatchBasisTaluka       = "taluka"        // project has no located points; parcel's structured taluka is served
	MatchBasisLocationText = "location_text" // project has no located points; parcel's free text names a served taluka
	MatchBasisResolvedArea = "resolved_area" // project has no located points; the geocoded address of the parcel names a served taluka
)

// DefaultNearbyRadiusKm is how far "nearby" reaches. Metro premiums in Indian cities are usually
// discussed within ~500m–2km of a station; 10km keeps farther but still relevant projects (a
// highway interchange, an airport) visible while sorted by distance.
const DefaultNearbyRadiusKm = 10.0

type PlannedInfrastructureMatch struct {
	Project    InfrastructureProject
	MatchBasis string
	AreaNote   string // taluka/text matches only
	// Distance matches only:
	DistanceKm   *float64
	NearestPoint *InfrastructurePoint
}

// MatchPlannedInfrastructure returns the approved projects near a parcel, at most once each.
//
// A project WITH located points is matched by distance only: it's included when its nearest point
// is within radiusKm of the parcel's resolved location, and skipped otherwise — even if it serves
// the same taluka, because a measured "12 km away" beats a same-taluka guess. If the parcel's
// location couldn't be resolved, such projects fall back to the taluka rules below.
//
// A project WITHOUT located points falls back to taluka matching: exact structured
// district/taluka when the parcel has one, otherwise the parcel's free text naming a served taluka
// as a whole word ("Khadakpada kalyan west" matches Kalyan; "Kalyani" does not), otherwise the
// geocoder's resolved address for the parcel (resolvedAddress, "" if none) naming one.
//
// Distance matches come first, nearest first.
func MatchPlannedInfrastructure(place PropertyLocation, at *GeoPoint, resolvedAddress string, projects []InfrastructureProject, radiusKm float64) []PlannedInfrastructureMatch {
	var byDistance, byArea []PlannedInfrastructureMatch
	for _, p := range projects {
		if at != nil && len(p.Points) > 0 {
			nearest, d := nearestPoint(*at, p.Points)
			if d <= radiusKm {
				dist := math.Round(d*10) / 10
				byDistance = append(byDistance, PlannedInfrastructureMatch{
					Project: p, MatchBasis: MatchBasisDistance, DistanceKm: &dist, NearestPoint: &nearest,
				})
			}
			continue
		}
		if m, ok := matchByArea(place, resolvedAddress, p); ok {
			byArea = append(byArea, m)
		}
	}
	sortByDistance(byDistance)
	return append(append(make([]PlannedInfrastructureMatch, 0, len(byDistance)+len(byArea)), byDistance...), byArea...)
}

func matchByArea(place PropertyLocation, resolvedAddress string, p InfrastructureProject) (PlannedInfrastructureMatch, bool) {
	structured := place.District != nil && *place.District != "" && place.Taluka != nil && *place.Taluka != ""
	if structured {
		for _, a := range p.Areas {
			if strings.EqualFold(a.District, *place.District) && strings.EqualFold(a.Taluka, *place.Taluka) {
				return PlannedInfrastructureMatch{Project: p, MatchBasis: MatchBasisTaluka, AreaNote: a.Note}, true
			}
		}
		return PlannedInfrastructureMatch{}, false // a structured location is authoritative
	}
	for _, a := range p.Areas {
		if containsWord(place.Text, a.Taluka) {
			return PlannedInfrastructureMatch{Project: p, MatchBasis: MatchBasisLocationText, AreaNote: a.Note}, true
		}
	}
	for _, a := range p.Areas {
		if containsWord(resolvedAddress, a.Taluka) {
			return PlannedInfrastructureMatch{Project: p, MatchBasis: MatchBasisResolvedArea, AreaNote: a.Note}, true
		}
	}
	return PlannedInfrastructureMatch{}, false
}

func nearestPoint(at GeoPoint, points []InfrastructurePoint) (InfrastructurePoint, float64) {
	best, bestD := points[0], math.Inf(1)
	for _, pt := range points {
		if d := HaversineKm(at, GeoPoint{Latitude: pt.Latitude, Longitude: pt.Longitude}); d < bestD {
			best, bestD = pt, d
		}
	}
	return best, bestD
}

func sortByDistance(ms []PlannedInfrastructureMatch) {
	for i := 1; i < len(ms); i++ { // tiny lists: insertion sort keeps this dependency-free
		for j := i; j > 0 && *ms[j].DistanceKm < *ms[j-1].DistanceKm; j-- {
			ms[j], ms[j-1] = ms[j-1], ms[j]
		}
	}
}

// HaversineKm is the great-circle distance between two points — straight-line, not road distance.
func HaversineKm(a, b GeoPoint) float64 {
	const earthRadiusKm = 6371.0
	rad := math.Pi / 180
	dLat := (b.Latitude - a.Latitude) * rad
	dLng := (b.Longitude - a.Longitude) * rad
	h := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(a.Latitude*rad)*math.Cos(b.Latitude*rad)*math.Sin(dLng/2)*math.Sin(dLng/2)
	return 2 * earthRadiusKm * math.Asin(math.Sqrt(h))
}

func containsWord(text, word string) bool {
	if strings.TrimSpace(word) == "" {
		return false
	}
	re := regexp.MustCompile(`(?i)\b` + regexp.QuoteMeta(word) + `\b`)
	return re.MatchString(text)
}
