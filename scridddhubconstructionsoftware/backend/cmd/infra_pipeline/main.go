// Command infra_pipeline builds and refreshes the planned-infrastructure list from the official
// sources in infrastructure_sources (services/plannedinfrastructure/PIPELINE_PLAN.md).
//
//	go run ./cmd/infra_pipeline --agency MMRDA --dry-run     # see what it would store
//	go run ./cmd/infra_pipeline --agency MMRDA               # store it
//	go run ./cmd/infra_pipeline --source <registered url>    # one source only
//
// Env: DATABASE_URL, GROQ_API_KEY, INFRA_PUBLISH_POLICY (strict|evidence|auto, default evidence),
// NOMINATIM_URL (self-hosted geocoder; without it the public service is used with a small budget).
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"sort"
	"strings"

	"github.com/joho/godotenv"
	"github.com/scridddhub/backend/internal/geo"
	"github.com/scridddhub/backend/internal/infrapipeline"
	"github.com/scridddhub/backend/internal/infrapipeline/fetch"
	"github.com/scridddhub/backend/internal/infrapipeline/geodata"
	"github.com/scridddhub/backend/internal/infrapipeline/locate"
	"github.com/scridddhub/backend/internal/infrapipeline/verify"
	"github.com/scridddhub/backend/internal/llm"
	"github.com/scridddhub/backend/internal/repository/postgres"
)

// publicGeocodeBudget bounds one run's use of the public Nominatim service (≤1 req/s, no bulk).
// ~300 covers MMRDA's stations once (~5 min); results are cached, so later runs barely geocode.
// Development only — before launch or more agencies, set NOMINATIM_URL to the self-hosted geocoder
// (docs/self-hosted-nominatim.md). Decided with the owner 2026-09-27.
const publicGeocodeBudget = 300

func main() {
	agency := flag.String("agency", "", "only sources from this agency (e.g. MMRDA); empty = all")
	source := flag.String("source", "", "only this registered source URL")
	dryRun := flag.Bool("dry-run", false, "fetch, extract, verify and locate, but write nothing")
	force := flag.Bool("force", false, "re-extract pages even if unchanged since the last run")
	policyFlag := flag.String("policy", "", "publish policy: strict | evidence | auto (overrides INFRA_PUBLISH_POLICY)")
	maxDiscovered := flag.Int("max-discovered", 200, "max new project pages to follow in one run")
	flag.Parse()

	if err := godotenv.Load(); err != nil {
		log.Printf("no .env file loaded (%v) — using process environment", err)
	}
	policyName := *policyFlag
	if policyName == "" {
		policyName = os.Getenv("INFRA_PUBLISH_POLICY")
	}
	policy, err := infrapipeline.ParsePublishPolicy(policyName)
	if err != nil {
		log.Fatal(err)
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
	pool, err := postgres.NewPool(ctx, databaseURL)
	if err != nil {
		log.Fatalf("connecting to database: %v", err)
	}
	defer pool.Close()

	var geocoder *geo.NominatimGeocoder
	if u := os.Getenv("NOMINATIM_URL"); u != "" {
		geocoder = geo.NewNominatimGeocoderWithBaseURL(u)
	} else {
		geocoder = geo.NewNominatimGeocoder()
	}
	locator := locate.New(geocoder, postgres.NewGeocodeCacheRepository(pool))
	if geocoder.IsPublic() {
		locator.Budget = publicGeocodeBudget
		log.Printf("geocoder: public Nominatim (budget %d lookups/run; set NOMINATIM_URL for bulk runs)", publicGeocodeBudget)
	}

	p := &infrapipeline.Pipeline{
		Store:     postgres.NewInfraPipelineStore(pool),
		Fetcher:   fetch.New(),
		Extractor: llm.NewGroqInfraExtractor(groqKey),
		Verifier:  verify.Verifier{},
		Geodata:   geodata.Parser{},
		Locator:   locator,
		Policy:    policy,
		Logf:      log.Printf,
	}

	res, runErr := p.Run(ctx, infrapipeline.RunOptions{
		Trigger: infrapipeline.TriggerCLI, Agency: *agency, SourceURL: *source,
		DryRun: *dryRun, Force: *force, MaxDiscovered: *maxDiscovered,
	})

	st := res.Stats
	fmt.Printf("\nsources %d · fetched %d · unchanged %d · blocked %d · errors %d · extracted %d · rejected fields %d",
		st.Sources, st.Fetched, st.Unchanged, st.Blocked, st.Errors, st.Extracted, st.Rejected)
	if *dryRun {
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
		fmt.Printf(" · approved %d · pending %d\n", st.Approved, st.Pending)
	}
	for _, s := range res.Skipped {
		fmt.Println("  skipped:", s)
	}
	if runErr != nil {
		log.Fatalf("run stopped: %v", runErr)
	}
}

func truncate(s string, n int) string {
	s = strings.Join(strings.Fields(s), " ")
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
