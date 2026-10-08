// transaction_import loads one reviewed Index-II record and its original evidence.
package main

import (
	"context"
	"encoding/json"
	"flag"
	"github.com/joho/godotenv"
	"github.com/scridddhub/backend/internal/repository/postgres"
	"github.com/scridddhub/backend/internal/transactionpipeline"
	"log"
	"os"
	"time"
)

func main() {
	rawPath := flag.String("raw", "", "original source HTML, JSON, text or PDF")
	metadata := flag.String("record", "", "reviewed JSON metadata (see service README)")
	files := flag.String("files", "../services/registeredtransactions/data/files", "large evidence file store")
	flag.Parse()
	if *rawPath == "" || *metadata == "" {
		log.Fatal("-raw and -record are required")
	}
	_ = godotenv.Load()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL is required")
	}
	raw, err := os.ReadFile(*rawPath)
	if err != nil {
		log.Fatal(err)
	}
	f, err := os.Open(*metadata)
	if err != nil {
		log.Fatal(err)
	}
	defer f.Close()
	var m transactionpipeline.ReviewedRecord
	decoder := json.NewDecoder(f)
	decoder.DisallowUnknownFields()
	if err = decoder.Decode(&m); err != nil {
		log.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	pool, err := postgres.NewPool(ctx, dsn)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()
	if err = transactionpipeline.Import(ctx, postgres.NewRegisteredTransactionRepository(pool), raw, m, *files); err != nil {
		log.Fatal(err)
	}
	log.Print("Source evidence archived and registered transaction upserted.")
}
