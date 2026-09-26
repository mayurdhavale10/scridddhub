// Package geo implements usecase.Geocoder.
package geo

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/scridddhub/backend/internal/domain"
	"github.com/scridddhub/backend/internal/usecase"
)

// NominatimGeocoder uses OpenStreetMap's public Nominatim service. Fine for development and low
// volume only: its usage policy allows at most 1 request/second, requires an identifying
// User-Agent, and forbids bulk geocoding — hence the rate limit here and the geocode_cache table.
// Swap in a commercial provider (Google, Mappls) behind usecase.Geocoder before real traffic.
// Results are © OpenStreetMap contributors (ODbL) and need attribution where shown.
type NominatimGeocoder struct {
	baseURL   string
	userAgent string
	client    *http.Client

	mu       sync.Mutex
	lastCall time.Time
}

const publicNominatimSearch = "https://nominatim.openstreetmap.org/search"

func NewNominatimGeocoder() *NominatimGeocoder {
	return &NominatimGeocoder{
		baseURL:   publicNominatimSearch,
		userAgent: "ScridddHub/0.1 (land-parcel planning ERP; development)",
		client:    &http.Client{Timeout: 10 * time.Second},
	}
}

// NewNominatimGeocoderWithBaseURL points at a self-hosted Nominatim (docs/self-hosted-nominatim.md),
// e.g. "http://localhost:8088". The public service's 1 request/second limit is skipped for any
// host other than nominatim.openstreetmap.org — it's our own server.
func NewNominatimGeocoderWithBaseURL(baseURL string) *NominatimGeocoder {
	g := NewNominatimGeocoder()
	g.baseURL = strings.TrimRight(baseURL, "/") + "/search"
	return g
}

// IsPublic reports whether this geocoder uses the public OpenStreetMap service (bulk use forbidden).
func (g *NominatimGeocoder) IsPublic() bool { return g.baseURL == publicNominatimSearch }

func (g *NominatimGeocoder) Provider() string {
	if g.IsPublic() {
		return "nominatim"
	}
	return "nominatim-self-hosted"
}

type nominatimResult struct {
	Lat         string `json:"lat"`
	Lon         string `json:"lon"`
	DisplayName string `json:"display_name"`
}

func (g *NominatimGeocoder) Search(ctx context.Context, query string) (usecase.GeocodeResult, error) {
	g.waitTurn()

	q := url.Values{}
	q.Set("q", query)
	q.Set("format", "jsonv2")
	q.Set("limit", "1")
	q.Set("countrycodes", "in")
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, g.baseURL+"?"+q.Encode(), nil)
	if err != nil {
		return usecase.GeocodeResult{}, err
	}
	req.Header.Set("User-Agent", g.userAgent)

	resp, err := g.client.Do(req)
	if err != nil {
		return usecase.GeocodeResult{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return usecase.GeocodeResult{}, fmt.Errorf("nominatim: HTTP %d", resp.StatusCode)
	}

	var results []nominatimResult
	if err := json.NewDecoder(resp.Body).Decode(&results); err != nil {
		return usecase.GeocodeResult{}, fmt.Errorf("nominatim: decoding response: %w", err)
	}
	if len(results) == 0 {
		return usecase.GeocodeResult{Found: false}, nil
	}
	lat, errLat := strconv.ParseFloat(results[0].Lat, 64)
	lng, errLng := strconv.ParseFloat(results[0].Lon, 64)
	if errLat != nil || errLng != nil {
		return usecase.GeocodeResult{}, fmt.Errorf("nominatim: bad coordinates %q,%q", results[0].Lat, results[0].Lon)
	}
	return usecase.GeocodeResult{
		Found:       true,
		Point:       domain.GeoPoint{Latitude: lat, Longitude: lng},
		DisplayName: results[0].DisplayName,
	}, nil
}

// waitTurn enforces the public service's 1 request/second policy across all callers.
func (g *NominatimGeocoder) waitTurn() {
	if !g.IsPublic() {
		return
	}
	g.mu.Lock()
	defer g.mu.Unlock()
	if wait := time.Second - time.Since(g.lastCall); wait > 0 {
		time.Sleep(wait)
	}
	g.lastCall = time.Now()
}
