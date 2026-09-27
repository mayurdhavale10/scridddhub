package infrapipeline

import (
	"context"
	"time"
)

// AreaWorker searches queued areas in the background (Step C). The server wakes it when a lookup
// finds an area with nothing nearby; the scheduled job (Step D) drains the same queue. One area at
// a time, so a burst of lookups can't flood agency sites or the LLM quota.
type AreaWorker struct {
	Pipeline   *Pipeline
	Coverage   CoverageStore
	Discoverer Discoverer
	// PerArea bounds one area's search (discovery + fetch + extract of what it found).
	PerArea time.Duration
	wake    chan struct{}
}

func NewAreaWorker(p *Pipeline, cov CoverageStore, disc Discoverer) *AreaWorker {
	return &AreaWorker{Pipeline: p, Coverage: cov, Discoverer: disc, PerArea: 20 * time.Minute, wake: make(chan struct{}, 1)}
}

// Wake asks the worker to look at the queue; never blocks.
func (w *AreaWorker) Wake() {
	select {
	case w.wake <- struct{}{}:
	default:
	}
}

// Run processes the queue whenever woken, until ctx ends. Start it once, in a goroutine.
func (w *AreaWorker) Run(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case <-w.wake:
			if _, err := w.ProcessQueue(ctx, 0); err != nil {
				w.Pipeline.logf("area worker stopped this round: %v", err)
			}
		}
	}
}

// ProcessQueue searches queued areas, most-requested first, until the queue is empty, max areas
// are done (0 = no limit), ctx ends, or a fatal error (e.g. daily LLM quota) stops it.
func (w *AreaWorker) ProcessQueue(ctx context.Context, max int) (int, error) {
	done := 0
	for max == 0 || done < max {
		if ctx.Err() != nil {
			return done, ctx.Err()
		}
		areas, err := w.Coverage.NextQueuedAreas(ctx, 1)
		if err != nil {
			return done, err
		}
		if len(areas) == 0 {
			return done, nil
		}
		areaCtx, cancel := context.WithTimeout(ctx, w.PerArea)
		_, err = w.Pipeline.SearchArea(areaCtx, w.Coverage, w.Discoverer, areas[0])
		cancel()
		done++
		if err != nil && w.Pipeline.IsFatal != nil && w.Pipeline.IsFatal(err) {
			return done, err
		}
	}
	return done, nil
}
