// Command infra_review lists and reviews pipeline-drafted infrastructure projects until the review
// screen (PIPELINE_PLAN.md phase 3) exists. Only approved projects are shown in the app.
//
//	go run ./cmd/infra_review list                         # pending projects with their evidence
//	go run ./cmd/infra_review points "mmrda:metro line 2a" # every point, to check on a map
//	go run ./cmd/infra_review drop-point "mmrda:metro line 2a" "Anand Nagar"
//	go run ./cmd/infra_review add-point "mmrda:mumbai trans harbour link" "Sewri" --by "Mayur Dhavale"
//	go run ./cmd/infra_review set-status "mmrda:metro line 7" operational --source <url> --quote "..." --by "Mayur Dhavale"
//	go run ./cmd/infra_review approve "mmrda:metro line 4" --by "Mayur Dhavale"
//	go run ./cmd/infra_review reject  "mmrda:dc to ac conversion" --by "Mayur Dhavale"
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"sort"
	"strings"

	"github.com/joho/godotenv"
	"github.com/scridddhub/backend/internal/geo"
	"github.com/scridddhub/backend/internal/infrapipeline"
	"github.com/scridddhub/backend/internal/infrapipeline/fetch"
	"github.com/scridddhub/backend/internal/infrapipeline/locate"
	"github.com/scridddhub/backend/internal/repository/postgres"
)

func main() {
	if len(os.Args) < 2 {
		usage()
	}
	cmd, rest := os.Args[1], os.Args[2:]

	_ = godotenv.Load()
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		databaseURL = "postgres://scridddhub:scridddhub_dev@localhost:5434/scridddhub?sslmode=disable"
	}
	ctx := context.Background()
	pool, err := postgres.NewPool(ctx, databaseURL)
	if err != nil {
		log.Fatalf("connecting to database: %v", err)
	}
	defer pool.Close()
	store := postgres.NewInfraPipelineStore(pool)

	switch cmd {
	case "list":
		fs := flag.NewFlagSet("list", flag.ExitOnError)
		status := fs.String("status", "pending", "pending | approved | rejected")
		fs.Parse(rest)
		projects, err := store.ListByReview(ctx, *status)
		if err != nil {
			log.Fatal(err)
		}
		fmt.Printf("%d %s project(s)\n", len(projects), *status)
		for _, p := range projects {
			fmt.Printf("\n%s\n  name:    %s\n  status:  %s", p.Key, p.Name, p.Status)
			if p.ExpectedCompletion != "" {
				fmt.Printf(" · est. %s", p.ExpectedCompletion)
			}
			fmt.Printf("\n  points:  %d official, %d approximate\n  source:  %s\n", p.OfficialPoints, p.ApproxPoints, p.SourceURL)
			if p.Description != "" {
				fmt.Printf("  summary: %s\n", p.Description)
			}
			keys := make([]string, 0, len(p.Evidence))
			for k := range p.Evidence {
				if k == "name" || k == "status" || k == "length_km" || k == "expected_completion" {
					keys = append(keys, k)
				}
			}
			sort.Strings(keys)
			for _, k := range keys {
				fmt.Printf("  ✓ %-20s %q\n", k, oneLine(p.Evidence[k], 100))
			}
			edits, err := store.ReviewEvidence(ctx, p.Key)
			if err != nil {
				log.Fatal(err)
			}
			for _, e := range edits {
				fmt.Printf("  ✎ %-20s %s — %q (%s)\n", e[0], e[1], oneLine(e[2], 80), e[3])
			}
		}
	case "points":
		if len(rest) == 0 {
			usage()
		}
		pts, err := store.ListPoints(ctx, rest[0])
		if err != nil {
			log.Fatal(err)
		}
		fmt.Printf("%d point(s) on %s (south to north). Paste lat,lng into Google Maps to check.\n", len(pts), rest[0])
		for _, p := range pts {
			fmt.Printf("  %-32s %.5f,%.5f  [%s, %s]\n", p.Label, p.Latitude, p.Longitude, p.Kind, p.CoordSource)
		}
	case "drop-point":
		if len(rest) < 2 {
			usage()
		}
		if err := store.DropPoint(ctx, rest[0], rest[1]); err != nil {
			log.Fatal(err)
		}
		fmt.Printf("removed %q from %s\n", rest[1], rest[0])
	case "set-status":
		// A status the page states but extraction missed (Metro Line 7: "is operational from 19th
		// January, 2023"). The quote must be on an official page; the field is then locked.
		fs := flag.NewFlagSet(cmd, flag.ExitOnError)
		by := fs.String("by", "", "reviewer's name (required)")
		src := fs.String("source", "", "official page that states the status (required)")
		quote := fs.String("quote", "", "the exact sentence on that page (required)")
		if len(rest) < 2 {
			usage()
		}
		key, status := rest[0], rest[1]
		fs.Parse(rest[2:])
		if strings.TrimSpace(*by) == "" || *src == "" || *quote == "" {
			log.Fatal("--by, --source and --quote are required")
		}
		switch status {
		case "planned", "under_construction", "partially_operational", "operational":
		default:
			log.Fatalf("status must be planned, under_construction, partially_operational or operational, got %q", status)
		}
		domains, err := store.OfficialDomains(ctx)
		if err != nil {
			log.Fatal(err)
		}
		if len(infrapipeline.FilterOfficial([]string{*src}, domains)) == 0 {
			log.Fatalf("%s is not on an official agency domain (infrastructure_official_domains)", *src)
		}
		text, err := fetchText(ctx, fetch.New(), *src)
		if err != nil {
			log.Fatal(err)
		}
		if !quoteOnPage(text, *quote) {
			log.Fatalf("that quote is not on %s — copy it exactly from the page", *src)
		}
		if err := store.SetStatusWithEvidence(ctx, key, status, *src, strings.TrimSpace(*quote), *by); err != nil {
			log.Fatal(err)
		}
		fmt.Printf("%s -> status %s (locked; quote verified on %s)\n", key, status, *src)
	case "add-point":
		// A place the project's own page names, which extraction or geocoding missed (Atal Setu:
		// "SEWRI – NHAVASHEVA ATAL SETU"). Located with the pipeline's strict locator; kept across
		// runs as a reviewer-placed ('manual') point.
		fs := flag.NewFlagSet(cmd, flag.ExitOnError)
		by := fs.String("by", "", "reviewer's name (required)")
		place := fs.String("place", "", "name to look up, if it differs from how the page writes it (\"Nhava Sheva\" for \"NHAVASHEVA\")")
		kind := fs.String("kind", "route", "station | route")
		if len(rest) < 2 {
			usage()
		}
		key, label := rest[0], rest[1]
		fs.Parse(rest[2:])
		if strings.TrimSpace(*by) == "" {
			log.Fatal("--by is required: record who reviewed it")
		}
		if *kind != "station" && *kind != "route" {
			log.Fatalf("--kind must be station or route")
		}
		urls, err := store.ProjectSourceURLs(ctx, key)
		if err != nil {
			log.Fatal(err)
		}
		f := fetch.New()
		var srcURL, line string
		for _, u := range urls {
			text, err := fetchText(ctx, f, u)
			if err != nil {
				fmt.Printf("  skipped %v\n", err)
				continue
			}
			if l, ok := sentenceWith(text, label); ok {
				srcURL, line = u, l
				break
			}
		}
		if srcURL == "" {
			log.Fatalf("%q is not named on any of this project's pages: %v", label, urls)
		}
		lookup := label
		if *place != "" {
			lookup = *place
		}
		locator := locate.New(geo.NewNominatimGeocoder(), postgres.NewGeocodeCacheRepository(pool))
		locator.MaxGapKm = 1e9 // one point: nothing to compare against
		pts, err := locator.Locate(ctx, infrapipeline.VerifiedProject{Project: infrapipeline.ExtractedProject{
			Name: key, Stations: []infrapipeline.NamedPlace{{Name: lookup}},
		}}, nil)
		if err != nil {
			log.Fatal(err)
		}
		if len(pts) == 0 {
			log.Fatalf("couldn't locate %q reliably inside the Mumbai region — try --place with another spelling", lookup)
		}
		pt := pts[0]
		if err := store.AddReviewedPoint(ctx, key, label, *kind, pt.Latitude, pt.Longitude, srcURL, line, *by); err != nil {
			log.Fatal(err)
		}
		fmt.Printf("added %q to %s at %.5f,%.5f — check it on a map\n  named on %s: %q\n", label, key, pt.Latitude, pt.Longitude, srcURL, oneLine(line, 120))
	case "approve", "reject", "reopen":
		fs := flag.NewFlagSet(cmd, flag.ExitOnError)
		by := fs.String("by", "", "reviewer's name (required)")
		if len(rest) == 0 {
			usage()
		}
		key := rest[0]
		fs.Parse(rest[1:])
		if strings.TrimSpace(*by) == "" {
			log.Fatal("--by is required: record who reviewed it")
		}
		status := map[string]string{"approve": "approved", "reject": "rejected", "reopen": "pending"}[cmd]
		if err := store.SetReview(ctx, key, status, *by); err != nil {
			log.Fatal(err)
		}
		fmt.Printf("%s -> %s (by %s)\n", key, status, *by)
	default:
		usage()
	}
}

func oneLine(s string, n int) string {
	s = strings.Join(strings.Fields(s), " ")
	if len(s) > n {
		return s[:n] + "…"
	}
	return s
}

func usage() {
	fmt.Fprintln(os.Stderr, `usage:
  infra_review list [--status pending|approved|rejected]
  infra_review points <canonical key>
  infra_review drop-point <canonical key> "<point label>"
  infra_review add-point  <canonical key> "<place as the page names it>" --by "<you>" [--place "<lookup name>"] [--kind station|route]
  infra_review set-status <canonical key> planned|under_construction|partially_operational|operational --source <official url> --quote "<exact sentence>" --by "<you>"
  infra_review approve <canonical key> --by "<your name>"
  infra_review reject  <canonical key> --by "<your name>"
  infra_review reopen  <canonical key> --by "<your name>"   (back to pending, hidden again)`)
	os.Exit(2)
}
