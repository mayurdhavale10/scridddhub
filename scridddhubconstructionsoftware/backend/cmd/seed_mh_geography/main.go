// seed_mh_geography is a one-off loader, not a server. It reads the raw JSON snapshots fetched
// from Maharashtra's real, public Common Village Master API
// (services/estimatedparcelvalue/pipeline/raw_data/*.json — see that folder's own README for
// provenance) and bulk-loads them into mh_districts/mh_talukas/mh_villages (migration 000026).
//
// Run once against a fresh database (uses COPY, which fails on a primary-key conflict — it does
// not merge into an already-populated table). Re-running against a re-synced source needs the
// tables truncated first.
package main

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/joho/godotenv"
	"github.com/scridddhub/backend/internal/repository/postgres"
)

type districtRow struct {
	Code      string `json:"districtcode"`
	Name      string `json:"districtnameenglish"`
	NameLocal string `json:"districtlocalname"`
}

type talukaRow struct {
	DistrictCode string `json:"districtcode"`
	Code         string `json:"subdistrictcode"`
	Name         string `json:"subdistrictnameenglish"`
	NameLocal    string `json:"subdistrictlocalname"`
}

type villageRow struct {
	DistrictCode string `json:"districtcode"`
	TalukaCode   string `json:"subdistrictcode"`
	Code         string `json:"villagecode"`
	Name         string `json:"villagenameenglish"`
	NameLocal    string `json:"villagelocalname"`
}

func readJSON[T any](path string) []T {
	data, err := os.ReadFile(path)
	if err != nil {
		log.Fatalf("reading %s: %v", path, err)
	}
	var rows []T
	if err := json.Unmarshal(data, &rows); err != nil {
		log.Fatalf("parsing %s: %v", path, err)
	}
	return rows
}

func main() {
	if err := godotenv.Load("../.env"); err != nil {
		log.Printf("no .env loaded (%v) — using process environment", err)
	}

	dir := "services/estimatedparcelvalue/pipeline/raw_data"
	if len(os.Args) > 1 {
		dir = os.Args[1]
	}

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

	districts := readJSON[districtRow](dir + "/districts.json")
	talukas := readJSON[talukaRow](dir + "/talukas.json")
	villages := readJSON[villageRow](dir + "/villages.json")

	log.Printf("loaded from disk: %d districts, %d talukas, %d villages", len(districts), len(talukas), len(villages))

	districtCount, err := pool.CopyFrom(ctx,
		pgx.Identifier{"mh_districts"},
		[]string{"code", "name", "name_local"},
		pgx.CopyFromSlice(len(districts), func(i int) ([]any, error) {
			d := districts[i]
			return []any{strings.TrimSpace(d.Code), strings.TrimSpace(d.Name), strings.TrimSpace(d.NameLocal)}, nil
		}),
	)
	if err != nil {
		log.Fatalf("loading districts: %v", err)
	}
	log.Printf("inserted %d districts", districtCount)

	talukaCount, err := pool.CopyFrom(ctx,
		pgx.Identifier{"mh_talukas"},
		[]string{"district_code", "code", "name", "name_local"},
		pgx.CopyFromSlice(len(talukas), func(i int) ([]any, error) {
			t := talukas[i]
			return []any{strings.TrimSpace(t.DistrictCode), strings.TrimSpace(t.Code), strings.TrimSpace(t.Name), strings.TrimSpace(t.NameLocal)}, nil
		}),
	)
	if err != nil {
		log.Fatalf("loading talukas: %v", err)
	}
	log.Printf("inserted %d talukas", talukaCount)

	villageCount, err := pool.CopyFrom(ctx,
		pgx.Identifier{"mh_villages"},
		[]string{"district_code", "taluka_code", "code", "name", "name_local"},
		pgx.CopyFromSlice(len(villages), func(i int) ([]any, error) {
			v := villages[i]
			return []any{strings.TrimSpace(v.DistrictCode), strings.TrimSpace(v.TalukaCode), strings.TrimSpace(v.Code), strings.TrimSpace(v.Name), strings.TrimSpace(v.NameLocal)}, nil
		}),
	)
	if err != nil {
		log.Fatalf("loading villages: %v", err)
	}
	log.Printf("inserted %d villages", villageCount)
}
