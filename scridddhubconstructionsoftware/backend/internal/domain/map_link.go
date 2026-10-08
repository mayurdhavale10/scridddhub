package domain

import (
	"net/url"
	"regexp"
	"strconv"
)

var (
	// "!3d19.0760!4d72.8777": the dropped pin / place itself. Preferred over "@", which is only
	// where the map view was centred.
	mapPlaceRe = regexp.MustCompile(`!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)`)
	mapViewRe  = regexp.MustCompile(`@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)`)
	// "19.0760,72.8777" or "19.0760, +72.8777" in q= / query= / ll= / center= / destination=, or a
	// /search/ or /place/ path segment, or a geo: URI.
	latLngRe = regexp.MustCompile(`^\s*(-?\d{1,2}\.\d+)\s*,\s*\+?(-?\d{1,3}\.\d+)\s*$`)
	pathRe   = regexp.MustCompile(`/(?:search|place|dir)/(-?\d{1,2}\.\d+),\+?\s*(-?\d{1,3}\.\d+)`)
	geoURIRe = regexp.MustCompile(`^geo:(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)`)
)

// ParseMapLink reads the coordinates out of a Google Maps (or geo:) link someone pasted, e.g.
// https://www.google.com/maps/place/.../@19.2551,73.1350,17z/data=!3d19.2553!4d73.1347. It never
// guesses: a link without coordinates in it (a short link not yet expanded, a place name only)
// returns ok=false.
func ParseMapLink(link string) (lat, lng float64, ok bool) {
	pick := func(m []string) (float64, float64, bool) {
		if len(m) != 3 {
			return 0, 0, false
		}
		a, errA := strconv.ParseFloat(m[1], 64)
		b, errB := strconv.ParseFloat(m[2], 64)
		if errA != nil || errB != nil || a < -90 || a > 90 || b < -180 || b > 180 {
			return 0, 0, false
		}
		return a, b, true
	}
	if lat, lng, ok := pick(geoURIRe.FindStringSubmatch(link)); ok {
		return lat, lng, true
	}
	decoded, err := url.QueryUnescape(link)
	if err != nil {
		decoded = link
	}
	if lat, lng, ok := pick(mapPlaceRe.FindStringSubmatch(decoded)); ok {
		return lat, lng, true
	}
	if u, err := url.Parse(link); err == nil {
		q := u.Query()
		for _, key := range []string{"q", "query", "ll", "center", "destination"} {
			if lat, lng, ok := pick(latLngRe.FindStringSubmatch(q.Get(key))); ok {
				return lat, lng, true
			}
		}
	}
	if lat, lng, ok := pick(pathRe.FindStringSubmatch(decoded)); ok {
		return lat, lng, true
	}
	return pick(mapViewRe.FindStringSubmatch(decoded))
}
