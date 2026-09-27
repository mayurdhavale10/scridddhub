// Command infra_pipeline builds and refreshes the planned-infrastructure list from official
// sources (services/plannedinfrastructure/PIPELINE_PLAN.md).
//
//	go run ./cmd/infra_pipeline --agency MMRDA --dry-run      # see what it would store
//	go run ./cmd/infra_pipeline --agency MMRDA                # store it
//	go run ./cmd/infra_pipeline --source <registered url>     # one source only
//	go run ./cmd/infra_pipeline --scheduled --max-duration 2h # Step D: what the scheduled task runs
//
// --scheduled = search queued areas users asked about (Step C queue), then refresh every source
// (unchanged pages are skipped cheaply), all within --max-duration. It stops cleanly if the LLM's
// daily quota runs out; the next run continues.
//
// Env: DATABASE_URL, GROQ_API_KEY, INFRA_PUBLISH_POLICY (strict|evidence|auto, default evidence),
// NOMINATIM_URL (self-hosted geocoder; without it the public service is used with a budget).
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"sort"
	"strings"
	"time"

	"github.com/joho/godotenv"
	"github.com/scridddhub/backend/internal/infrapipeline"
	"github.com/scridddhub/backend/internal/infrapipeline/setup"
	"github.com/scridddhub/backend/internal/repository/postgres"
)

func main() {
	agency := flag.String("agency", "", "only sources from this agency (e.g. MMRDA); empty = all")
	source := flag.String("source", "", "only this registered source URL")
	dryRun := flag.Bool("dry-run", false, "fetch, extract, verify and locate, but write nothing")
	force := flag.Bool("force", false, "re-extract pages even if unchanged since the last run")
	policyFlag := flag.String("policy", "", "publish policy: strict | evidence | auto (overrides INFRA_PUBLISH_POLICY)")
	maxDiscovered := flag.Int("max-discovered", 200, "max new project pages to follow in one run")
	scheduled := flag.Bool("scheduled", false, "search queued areas, then refresh all sources (the scheduled task)")
	processCoverage := flag.Int("process-coverage", 0, "search up to N queued areas (0 = none, unless --scheduled)")
	maxDuration := flag.Duration("max-duration", 0, "stop after this long, storing what was gathered (e.g. 2h); 0 = no limit")
	flag.Parse()

	if err := godotenv.Load(); err != nil {
		log.Printf("no .env file loaded (%v) — using process environment", err)
	}
	groqKey := os.Getenv("GROQ_API_KEY")
	if groqKey == "" {
		log.Fatal("GROQ_API_KEY is required (page extraction)")
	}
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		databaseURL = "postgres://scridddhub:scridddhub_dev@localhost:5434/scridddhub?sslmode=disable"
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()
	if *maxDuration > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, *maxDuration)
		defer cancel()
		log.Printf("time budget: %s (stops at %s)", *maxDuration, time.Now().Add(*maxDuration).Format("15:04"))
	}

	pool, err := postgres.NewPool(ctx, databaseURL)
	if err != nil {
		log.Fatalf("connecting to database: %v", err)
	}
	defer pool.Close()

	built, err := setup.New(pool, groqKey, *policyFlag, log.Printf)
	if err != nil {
		log.Fatal(err)
	}
	if os.Getenv("NOMINATIM_URL") == "" {
		log.Printf("geocoder: public Nominatim (budget %d lookups/run; set NOMINATIM_URL for bulk runs)", setup.PublicGeocodeBudget)
	}

	// Step C queue first: areas people actually looked up matter most.
	areas := *processCoverage
	if *scheduled && areas == 0 {
		areas = 50
	}
	if areas > 0 && !*dryRun {
		worker := infrapipeline.NewAreaWorker(built.Pipeline, built.Store, built.Discoverer)
		n, err := worker.ProcessQueue(ctx, areas)
		log.Printf("searched %d queued area(s)", n)
		if stopRun(err) {
			log.Printf("stopping: %v", err)
			return
		}
	}
	if (*processCoverage > 0 && !*scheduled) || ctx.Err() != nil {
		return
	}

	res, runErr := built.Pipeline.Run(ctx, infrapipeline.RunOptions{
		Trigger: triggerFor(*scheduled), Agency: *agency, SourceURL: *source,
		DryRun: *dryRun, Force: *force, MaxDiscovered: *maxDiscovered,
	})
	report(res, *dryRun)
	if runErr != nil && !stopRun(runErr) {
		log.Fatalf("run stopped: %v", runErr)
	} else if runErr != nil {
		log.Printf("run ended early (saved what was gathered): %v", runErr)
	}
}

// stopRun: a time-budget expiry or the daily LLM quota ends the run normally (not a failure).
func stopRun(err error) bool {
	return err != nil && (errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) ||
		strings.Contains(err.Error(), "daily token quota"))
}

func triggerFor(scheduled bool) infrapipeline.RunTrigger {
	if scheduled {
		return infrapipeline.TriggerSchedule
	}
	return infrapipeline.TriggerCLI
}

func report(res infrapipeline.RunResult, dryRun bool) {
	st := res.Stats
	fmt.Printf("\nsources %d · fetched %d · unchanged %d · blocked %d · errors %d · extracted %d · rejected fields %d",
		st.Sources, st.Fetched, st.Unchanged, st.Blocked, st.Errors, st.Extracted, st.Rejected)
	if dryRun {
		fmt.Printf("\n\nDRY RUN — nothing written. Would store %d project(s):\n", len(res.DryRun))
		for _, d := range res.DryRun {
			fmt.Printf("\n  %s  [%s]  %s\n", d.Key, d.Review, d.Name)
			keys := make([]string, 0, len(d.Kept))
			for k := range d.Kept {
				keys = append(keys, k)
			}
			sort.Strings(keys)
			for _, k := range keys {
				fmt.Printf("    ✓ %-28s %q\n", k, truncate(d.Kept[k], 90))
			}
			for _, r := range d.Rejected {
				fmt.Printf("    ✗ %s (no supporting text on the page)\n", r)
			}
			fmt.Printf("    points: %d\n", len(d.Points))
		}
	} else {
		// Policy verdicts for this run's data; an already-approved project stays approved in the
		// database even when its new data would only earn "pending".
		fmt.Printf(" · policy verdicts: %d approve, %d review\n", st.Approved, st.Pending)
	}
	for _, s := range res.Skipped {
		fmt.Println("  skipped:", s)
	}
}

func truncate(s string, n int) string {
	s = strings.Join(strings.Fields(s), " ")
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
