package osm

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/scridddhub/backend/internal/domain"
)

type memCache struct {
	mu   sync.Mutex
	rows map[string][]domain.NearbyPlace
	at   map[string]time.Time
}

func newMemCache() *memCache {
	return &memCache{rows: map[string][]domain.NearbyPlace{}, at: map[string]time.Time{}}
}

func (c *memCache) Get(_ context.Context, cell, group string) ([]domain.NearbyPlace, time.Time, bool, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	p, ok := c.rows[cell+"|"+group]
	return p, c.at[cell+"|"+group], ok, nil
}

func (c *memCache) Put(_ context.Context, cell, group string, places []domain.NearbyPlace) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.rows[cell+"|"+group], c.at[cell+"|"+group] = places, time.Now()
	return nil
}

type fakeFetcher struct {
	delay time.Duration
	fail  bool
	calls atomic.Int32
}

func (f *fakeFetcher) Fetch(ctx context.Context, group string, _ domain.GeoPoint, _ float64) ([]domain.NearbyPlace, error) {
	f.calls.Add(1)
	select {
	case <-time.After(f.delay):
	case <-ctx.Done():
		return nil, ctx.Err()
	}
	if f.fail {
		return nil, errors.New("overpass down")
	}
	return []domain.NearbyPlace{{Name: group, Kind: "school"}}, nil
}

var khadakpada = domain.GeoPoint{Latitude: 19.255, Longitude: 73.135}

func TestFinder_ColdCellFetchesAllGroupsThenServesCache(t *testing.T) {
	f := &fakeFetcher{}
	finder := NewFinder(f, newMemCache(), time.Second)
	got, _ := finder.Near(context.Background(), khadakpada)
	if len(got) != len(Groups) {
		t.Fatalf("got %d places, want one per group", len(got))
	}
	got, _ = finder.Near(context.Background(), khadakpada)
	if len(got) != len(Groups) || f.calls.Load() != int32(len(Groups)) {
		t.Fatalf("second lookup should come from cache: %d places, %d fetches", len(got), f.calls.Load())
	}
}

// A slow Overpass must not hold the screen: the request returns after `wait`, the fetch finishes
// in the background, and the next lookup has it.
func TestFinder_SlowFetchReturnsAfterWaitAndFillsLater(t *testing.T) {
	f := &fakeFetcher{delay: 150 * time.Millisecond}
	finder := NewFinder(f, newMemCache(), 20*time.Millisecond)
	start := time.Now()
	got, _ := finder.Near(context.Background(), khadakpada)
	if len(got) != 0 || time.Since(start) > 100*time.Millisecond {
		t.Fatalf("want an empty answer within the wait, got %d after %v", len(got), time.Since(start))
	}
	time.Sleep(300 * time.Millisecond)
	if got, _ = finder.Near(context.Background(), khadakpada); len(got) != len(Groups) {
		t.Fatalf("background fetch should have filled the cache, got %d", len(got))
	}
}

func TestFinder_ConcurrentLookupsShareOneFetch(t *testing.T) {
	f := &fakeFetcher{delay: 50 * time.Millisecond}
	finder := NewFinder(f, newMemCache(), time.Second)
	var wg sync.WaitGroup
	for range 5 {
		wg.Add(1)
		go func() { defer wg.Done(); _, _ = finder.Near(context.Background(), khadakpada) }()
	}
	wg.Wait()
	if n := f.calls.Load(); n != int32(len(Groups)) {
		t.Fatalf("%d fetches, want one per group", n)
	}
}

func TestFinder_FailureIsNotCached(t *testing.T) {
	f := &fakeFetcher{fail: true}
	cache := newMemCache()
	finder := NewFinder(f, cache, time.Second)
	_, _ = finder.Near(context.Background(), khadakpada)
	f.fail = false

	// Within the cooldown: no new fetch, and no waiting.
	start := time.Now()
	if got, _ := finder.Near(context.Background(), khadakpada); len(got) != 0 || f.calls.Load() != int32(len(Groups)) {
		t.Fatalf("retried during cooldown: %d places, %d fetches", len(got), f.calls.Load())
	}
	if time.Since(start) > 100*time.Millisecond {
		t.Fatalf("a lookup during cooldown waited %v", time.Since(start))
	}

	// After it: retried, since failures aren't cached.
	for k := range finder.failedAt {
		finder.failedAt[k] = time.Now().Add(-retryAfterFailure)
	}
	if got, _ := finder.Near(context.Background(), khadakpada); len(got) != len(Groups) {
		t.Fatalf("a failed fetch must be retried after the cooldown, got %d", len(got))
	}
}
