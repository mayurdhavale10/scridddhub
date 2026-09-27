package osm

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/scridddhub/backend/internal/domain"
)

// Cache stores each cell's places per group (migration 000034).
type Cache interface {
	// Get returns found=false when the cell/group was never fetched.
	Get(ctx context.Context, cell, group string) (places []domain.NearbyPlace, fetchedAt time.Time, found bool, err error)
	Put(ctx context.Context, cell, group string, places []domain.NearbyPlace) error
}

// Fetcher is the Overpass client (an interface so the finder is testable offline).
type Fetcher interface {
	Fetch(ctx context.Context, group string, centre domain.GeoPoint, padKm float64) ([]domain.NearbyPlace, error)
}

// refreshAfter: OpenStreetMap changes slowly; a month-old answer is still served while a fresh
// one is fetched in the background.
const refreshAfter = 30 * 24 * time.Hour

// fetchTimeout bounds one background group fetch, independent of the request that started it.
const fetchTimeout = 90 * time.Second

// Finder implements usecase.NearbyPlaceFinder: cached places for the property's ~1 km cell,
// fetched from Overpass on first lookup.
//
// A cold cell's fetch runs in the background, detached from the request: the request waits up to
// `wait` for it and otherwise returns what's cached, so a slow or overloaded public Overpass
// server delays the screen by at most `wait`, and the next lookup gets the result. Concurrent
// lookups of the same cell share one fetch.
type Finder struct {
	fetcher Fetcher
	cache   Cache
	wait    time.Duration

	mu       sync.Mutex
	inFlight map[string]chan struct{} // "cell|group" -> closed when the fetch finishes
	failedAt map[string]time.Time     // "cell|group" -> last failed fetch
}

// retryAfterFailure: after a failed fetch the cell/group isn't retried for this long, so while
// Overpass is overloaded lookups return at once instead of each waiting out `wait`.
const retryAfterFailure = 2 * time.Minute

func NewFinder(fetcher Fetcher, cache Cache, wait time.Duration) *Finder {
	return &Finder{fetcher: fetcher, cache: cache, wait: wait,
		inFlight: map[string]chan struct{}{}, failedAt: map[string]time.Time{}}
}

// Near returns every cached-or-fetched place in at's cell. The caller filters by distance
// (domain.MatchNearbyPlaces). Groups still fetching when the wait runs out are simply missing.
func (f *Finder) Near(ctx context.Context, at domain.GeoPoint) ([]domain.NearbyPlace, error) {
	cell, centre := domain.NearbyCell(at)
	var out []domain.NearbyPlace
	var pending []chan struct{}
	var pendingGroups []string
	for _, g := range Groups {
		places, fetchedAt, found, err := f.cache.Get(ctx, cell, g)
		if err != nil {
			return nil, err
		}
		if found {
			out = append(out, places...)
			if time.Since(fetchedAt) > refreshAfter {
				f.start(cell, g, centre) // stale: serve it, refresh for next time
			}
			continue
		}
		if done := f.start(cell, g, centre); done != nil {
			pending = append(pending, done)
			pendingGroups = append(pendingGroups, g)
		}
	}
	if len(pending) == 0 {
		return out, nil
	}

	timer := time.NewTimer(f.wait)
	defer timer.Stop()
	for i, done := range pending {
		select {
		case <-done:
		case <-timer.C:
			return out, nil // the rest arrive on a later lookup
		case <-ctx.Done():
			return out, nil
		}
		places, _, found, err := f.cache.Get(ctx, cell, pendingGroups[i])
		if err == nil && found {
			out = append(out, places...)
		}
	}
	return out, nil
}

// start fetches a cell's group in the background unless that fetch is already running, and
// returns a channel closed when it finishes (successfully or not — failures aren't cached, so a
// later lookup retries). Returns nil while the last failure is recent: nothing to wait for.
func (f *Finder) start(cell, group string, centre domain.GeoPoint) chan struct{} {
	key := cell + "|" + group
	f.mu.Lock()
	defer f.mu.Unlock()
	if done, ok := f.inFlight[key]; ok {
		return done
	}
	if t, ok := f.failedAt[key]; ok && time.Since(t) < retryAfterFailure {
		return nil
	}
	done := make(chan struct{})
	f.inFlight[key] = done
	go func() {
		defer func() {
			f.mu.Lock()
			delete(f.inFlight, key)
			f.mu.Unlock()
			close(done)
		}()
		ctx, cancel := context.WithTimeout(context.Background(), fetchTimeout)
		defer cancel()
		places, err := f.fetcher.Fetch(ctx, group, centre, domain.NearbyCellHalfDiagonalKm)
		if err != nil {
			log.Printf("osm: fetching %s near cell %s: %v", group, cell, err)
			f.mu.Lock()
			f.failedAt[key] = time.Now()
			f.mu.Unlock()
			return
		}
		if err := f.cache.Put(ctx, cell, group, places); err != nil {
			log.Printf("osm: caching %s for cell %s: %v", group, cell, err)
		}
	}()
	return done
}
