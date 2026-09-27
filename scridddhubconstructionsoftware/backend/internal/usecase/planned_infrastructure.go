package usecase

import (
	"context"
	"fmt"
	"log"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
)

// InfrastructureProjectRepository is defined by this usecase (the consumer), implemented by
// internal/repository/postgres. Read-only: the list is reference data (migrations 000028/000029),
// never created or edited through the app.
type InfrastructureProjectRepository interface {
	// ListApproved returns approved projects with their areas and located points.
	ListApproved(ctx context.Context) ([]domain.InfrastructureProject, error)
}

type ParcelGetter interface {
	Get(ctx context.Context, id uuid.UUID) (*domain.LandParcel, error)
}

// GeocodeResult is what a free-text location resolved to. MatchedQuery is the text that actually
// matched — shorter than the input when only part of it could be found — so the UI can show the
// user exactly where the app thinks the parcel is.
type GeocodeResult struct {
	Found        bool
	Point        domain.GeoPoint
	DisplayName  string
	MatchedQuery string
}

// Geocoder is implemented by internal/geo (swap providers without touching this usecase).
type Geocoder interface {
	Search(ctx context.Context, query string) (GeocodeResult, error)
	Provider() string
}

// GeocodeCache stores resolved lookups by normalized query text (misses included), so the same
// location is never sent to the geocoder twice.
type GeocodeCache interface {
	Get(ctx context.Context, query string) (*GeocodeResult, error) // nil, nil when not cached
	Put(ctx context.Context, query string, result GeocodeResult, provider string) error
}

type PlannedInfrastructureUsecase struct {
	parcels  ParcelGetter
	projects InfrastructureProjectRepository
	geocoder Geocoder
	cache    GeocodeCache
	coverage CoverageRecorder // optional (Step C); nil = no on-demand search
	onQueued func(cell string)
	nearby   NearbyPlaceFinder // optional; nil = no existing places
}

// NearbyPlaceFinder returns existing places (schools, hospitals, landfills...) around a point,
// implemented by internal/osm. The usecase filters them by distance.
type NearbyPlaceFinder interface {
	Near(ctx context.Context, at domain.GeoPoint) ([]domain.NearbyPlace, error)
}

// WithNearbyPlaces adds existing places from OpenStreetMap alongside the planned projects.
func (u *PlannedInfrastructureUsecase) WithNearbyPlaces(f NearbyPlaceFinder) *PlannedInfrastructureUsecase {
	u.nearby = f
	return u
}

func NewPlannedInfrastructureUsecase(parcels ParcelGetter, projects InfrastructureProjectRepository, geocoder Geocoder, cache GeocodeCache) *PlannedInfrastructureUsecase {
	return &PlannedInfrastructureUsecase{parcels: parcels, projects: projects, geocoder: geocoder, cache: cache}
}

// CoverageStatus is what's known about searching an area for infrastructure (Step C).
type CoverageStatus struct {
	Status         string // queued | searching | searched | failed
	LastSearchedAt *time.Time
	ProjectsFound  int
}

// CoverageRecorder records lookups of areas with nothing nearby on file.
type CoverageRecorder interface {
	RequestCoverage(ctx context.Context, cell, place string, lat, lng float64) (CoverageStatus, error)
}

// WithCoverage enables Step C: an area with no measured project nearby is recorded, and onQueued
// (e.g. waking a background searcher) is called when it's newly queued for searching.
func (u *PlannedInfrastructureUsecase) WithCoverage(c CoverageRecorder, onQueued func(cell string)) *PlannedInfrastructureUsecase {
	u.coverage, u.onQueued = c, onQueued
	return u
}

type PlannedInfrastructureResult struct {
	// Location is nil when the parcel's location couldn't be resolved (or the geocoder failed);
	// matching then falls back to taluka rules for every project.
	Location *GeocodeResult
	RadiusKm float64
	Matches  []domain.PlannedInfrastructureMatch
	// Coverage is set when nothing on the list is measured within RadiusKm of the location: it
	// says whether this area is being searched for more (queued/searching) or already was.
	Coverage *CoverageStatus
	// Existing places already there (OpenStreetMap), nearest first; empty when the location
	// couldn't be resolved or the lookup is still running.
	Existing []domain.NearbyPlaceMatch
}

// ForParcel returns approved infrastructure near a saved parcel's location.
func (u *PlannedInfrastructureUsecase) ForParcel(ctx context.Context, parcelID uuid.UUID) (*PlannedInfrastructureResult, error) {
	parcel, err := u.parcels.Get(ctx, parcelID)
	if err != nil {
		return nil, err
	}
	return u.ForLocation(ctx, domain.PropertyLocation{Text: parcel.Location, District: parcel.District, Taluka: parcel.Taluka})
}

// ForLocation answers "what's planned near here?" for any location — no parcel needs to exist.
// An empty result means nothing on the shared list is near it, not that nothing is planned there.
func (u *PlannedInfrastructureUsecase) ForLocation(ctx context.Context, place domain.PropertyLocation) (*PlannedInfrastructureResult, error) {
	if strings.TrimSpace(place.Text) == "" {
		return nil, fmt.Errorf("location is required")
	}
	projects, err := u.projects.ListApproved(ctx)
	if err != nil {
		return nil, err
	}

	var at *domain.GeoPoint
	var resolvedAddress string
	loc, err := u.resolve(ctx, place.Text)
	if err != nil {
		// A geocoder outage must not blank the whole section — degrade to taluka matching.
		log.Printf("geocoding %q failed, falling back to taluka matching: %v", place.Text, err)
		loc = nil
	}
	if loc != nil && loc.Found {
		at = &loc.Point
		resolvedAddress = loc.DisplayName
	} else {
		loc = nil
	}

	res := &PlannedInfrastructureResult{
		Location: loc,
		RadiusKm: domain.DefaultNearbyRadiusKm,
		Matches:  domain.MatchPlannedInfrastructure(place, at, resolvedAddress, projects, domain.DefaultNearbyRadiusKm),
	}
	if at != nil && u.coverage != nil && !hasDistanceMatch(res.Matches) {
		res.Coverage = u.recordCoverage(ctx, *at, loc.DisplayName)
	}
	if at != nil && u.nearby != nil {
		// Existing places are a bonus: a lookup failure never breaks the planned list.
		if places, err := u.nearby.Near(ctx, *at); err != nil {
			log.Printf("finding existing places near %q: %v", place.Text, err)
		} else {
			res.Existing = domain.MatchNearbyPlaces(*at, places)
		}
	}
	return res, nil
}

func hasDistanceMatch(ms []domain.PlannedInfrastructureMatch) bool {
	for _, m := range ms {
		if m.MatchBasis == domain.MatchBasisDistance {
			return true
		}
	}
	return false
}

// recordCoverage notes that this area has nothing measured nearby and, if it's newly queued,
// wakes the background searcher. Failures never break the lookup itself.
func (u *PlannedInfrastructureUsecase) recordCoverage(ctx context.Context, at domain.GeoPoint, place string) *CoverageStatus {
	cell, centre := domain.CoverageCell(at)
	st, err := u.coverage.RequestCoverage(ctx, cell, place, centre.Latitude, centre.Longitude)
	if err != nil {
		log.Printf("recording coverage request for %s: %v", cell, err)
		return nil
	}
	if st.Status == "queued" && u.onQueued != nil {
		u.onQueued(cell)
	}
	return &st
}

var spaces = regexp.MustCompile(`\s+`)

func normalizeQuery(s string) string {
	return strings.ToLower(spaces.ReplaceAllString(strings.TrimSpace(s), " "))
}

// resolve geocodes a free-text location, trying the full text first and then dropping leading
// comma-separated parts ("Godrej Hill, Khadakpada" -> "Khadakpada"), each scoped to Maharashtra.
// Dropping from the front keeps the broader, more findable place names.
func (u *PlannedInfrastructureUsecase) resolve(ctx context.Context, location string) (*GeocodeResult, error) {
	key := normalizeQuery(location)
	if key == "" {
		return nil, nil
	}
	if cached, err := u.cache.Get(ctx, key); err != nil {
		return nil, err
	} else if cached != nil {
		return cached, nil
	}

	parts := strings.Split(location, ",")
	result := GeocodeResult{Found: false}
	for i := range parts {
		candidate := strings.TrimSpace(strings.Join(parts[i:], ","))
		if candidate == "" {
			continue
		}
		if !strings.Contains(strings.ToLower(candidate), "maharashtra") {
			candidate += ", Maharashtra"
		}
		r, err := u.geocoder.Search(ctx, candidate)
		if err != nil {
			return nil, err // don't cache transient failures
		}
		if r.Found {
			r.MatchedQuery = candidate
			result = r
			break
		}
	}
	if err := u.cache.Put(ctx, key, result, u.geocoder.Provider()); err != nil {
		log.Printf("caching geocode for %q: %v", key, err)
	}
	return &result, nil
}
