// Package locate is stage 5 of the planned-infrastructure pipeline: it gives a project's stations
// coordinates. Official geodata (the agency's own KML/GeoJSON) always wins; otherwise each
// verified station name is geocoded and kept only if the result is plausible — marked
// "approximate" so the app never presents it as surveyed.
package locate

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	"github.com/scridddhub/backend/internal/domain"
	"github.com/scridddhub/backend/internal/infrapipeline"
	"github.com/scridddhub/backend/internal/usecase"
)

// Bounds is a lat/lng box a geocoded point must fall inside.
type Bounds struct{ MinLat, MaxLat, MinLng, MaxLng float64 }

// MMR roughly covers the Mumbai Metropolitan Region (Palghar/Dahanu to Alibag/Pen, sea to Karjat/Shahapur).
var MMR = Bounds{MinLat: 18.55, MaxLat: 20.1, MinLng: 72.6, MaxLng: 73.6}

type Locator struct {
	Geocoder usecase.Geocoder
	Cache    usecase.GeocodeCache // optional; avoids re-asking the geocoder across runs
	Bounds   Bounds
	// MaxGapKm rejects a geocoded station whose nearest other located station is farther than
	// this — i.e. a name that geocoded to a same-named place elsewhere. Nearest-neighbour, not
	// distance-from-centre: lines are long (Metro Line 12 is ~23 km), so a real end station can
	// be far from the middle but is always near its neighbour.
	MaxGapKm float64
	// Budget caps geocoder calls per run (0 = unlimited). The public Nominatim service forbids
	// bulk use, so the CLI sets this unless a self-hosted geocoder is configured.
	Budget int
	used   int
}

var _ infrapipeline.Locator = (*Locator)(nil)

func New(g usecase.Geocoder, cache usecase.GeocodeCache) *Locator {
	return &Locator{Geocoder: g, Cache: cache, Bounds: MMR, MaxGapKm: 12}
}

func (l *Locator) Locate(ctx context.Context, vp infrapipeline.VerifiedProject, official []infrapipeline.GeoPoint) ([]infrapipeline.LocatedPoint, error) {
	if len(official) > 0 {
		out := make([]infrapipeline.LocatedPoint, 0, len(official))
		for _, p := range official {
			out = append(out, infrapipeline.LocatedPoint{GeoPoint: p, CoordSource: infrapipeline.CoordOfficialFile})
		}
		return out, nil
	}
	// Lines have stations. Roads, bridges and tunnels usually don't — for those, the places the
	// page says the project runs through are its best available location, placed as route points.
	places, kind := vp.Project.Stations, infrapipeline.PointStation
	if len(places) == 0 {
		places, kind = vp.Project.Localities, infrapipeline.PointRoute
	}
	if l.Geocoder == nil || len(places) == 0 {
		return nil, nil
	}

	var found []infrapipeline.LocatedPoint
	var firstErr error
stations:
	for _, st := range places {
		name := CleanStationName(st.Name)
		// Checked 2026-09-27: Nominatim rarely knows "X metro station" (under-construction stations
		// aren't in OpenStreetMap at all) but does know the neighbourhood by name — "Asalpha,
		// Mumbai" resolves to the Asalpha suburb. A suburb centre is typically within ~1 km of its
		// station, which is what "approximate" means here.
		// State-wide first: forcing ", Mumbai" pulled "Kalyan" (a separate city) to a same-named
		// spot inside Mumbai (2026-09-27). ", Mumbai" is only a fallback, and results must still
		// fall inside the MMR box.
		var r usecase.GeocodeResult
		for _, query := range []string{name + ", Maharashtra", name + ", Mumbai, Maharashtra"} {
			if l.Budget > 0 && l.used >= l.Budget {
				firstErr = fmt.Errorf("geocoding budget of %d reached; remaining stations left unlocated", l.Budget)
				break stations
			}
			var err error
			r, err = l.lookup(ctx, query)
			if err != nil {
				if firstErr == nil {
					firstErr = err
				}
				continue stations
			}
			if r.Found && l.inBounds(r.Point) {
				break
			}
		}
		if !r.Found || !l.inBounds(r.Point) {
			continue
		}
		found = append(found, infrapipeline.LocatedPoint{
			GeoPoint:    infrapipeline.GeoPoint{Label: st.Name, Kind: kind, Latitude: r.Point.Latitude, Longitude: r.Point.Longitude},
			CoordSource: infrapipeline.CoordApproximate,
		})
	}
	return dropIsolated(found, l.MaxGapKm), firstErr
}

func (l *Locator) lookup(ctx context.Context, query string) (usecase.GeocodeResult, error) {
	key := strings.ToLower(strings.Join(strings.Fields(query), " "))
	if l.Cache != nil {
		if c, err := l.Cache.Get(ctx, key); err == nil && c != nil {
			return *c, nil
		}
	}
	l.used++
	r, err := l.Geocoder.Search(ctx, query)
	if err != nil {
		return r, err
	}
	if l.Cache != nil {
		_ = l.Cache.Put(ctx, key, r, l.Geocoder.Provider())
	}
	return r, nil
}

func (l *Locator) inBounds(p domain.GeoPoint) bool {
	b := l.Bounds
	return p.Latitude >= b.MinLat && p.Latitude <= b.MaxLat && p.Longitude >= b.MinLng && p.Longitude <= b.MaxLng
}

var (
	sideOfLine    = regexp.MustCompile(`(?i)\(\s*(east|west|north|south)\s*\)`)
	parenthetical = regexp.MustCompile(`\([^)]*\)`)
	trailingMetro = regexp.MustCompile(`(?i)\s+metro(\s+station)?$`)
	spaceRun      = regexp.MustCompile(`\s+`)
)

// CleanStationName turns a station label as printed on an agency page into a geocodable place
// name: "Andheri (West)" -> "Andheri West", "Bhakti Park Metro" -> "Bhakti Park",
// "Dahisar(East)" -> "Dahisar East".
func CleanStationName(s string) string {
	s = sideOfLine.ReplaceAllString(s, " $1")
	s = parenthetical.ReplaceAllString(s, " ")
	s = strings.TrimSpace(spaceRun.ReplaceAllString(s, " "))
	return trailingMetro.ReplaceAllString(s, "")
}

// dropIsolated removes points whose nearest other point is farther than maxGapKm. With fewer
// than 3 points there's no neighbourhood to judge by, so nothing is dropped.
func dropIsolated(pts []infrapipeline.LocatedPoint, maxGapKm float64) []infrapipeline.LocatedPoint {
	if len(pts) < 3 || maxGapKm <= 0 {
		return pts
	}
	out := pts[:0:0]
	for i, p := range pts {
		a := domain.GeoPoint{Latitude: p.Latitude, Longitude: p.Longitude}
		for j, q := range pts {
			if i != j && domain.HaversineKm(a, domain.GeoPoint{Latitude: q.Latitude, Longitude: q.Longitude}) <= maxGapKm {
				out = append(out, p)
				break
			}
		}
	}
	return out
}
