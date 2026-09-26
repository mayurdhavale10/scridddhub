// Command infra_review lists and reviews pipeline-drafted infrastructure projects until the review
// screen (PIPELINE_PLAN.md phase 3) exists. Only approved projects are shown in the app.
//
//	go run ./cmd/infra_review list                         # pending projects with their evidence
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
		}
	case "approve", "reject":
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
		status := map[string]string{"approve": "approved", "reject": "rejected"}[cmd]
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
  infra_review approve <canonical key> --by "<your name>"
  infra_review reject  <canonical key> --by "<your name>"`)
	os.Exit(2)
}
