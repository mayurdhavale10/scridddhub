package postgres

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/scridddhub/backend/internal/domain"
	"github.com/scridddhub/backend/internal/transactionpipeline"
)

// Run against local Postgres with TRANSACTION_TEST_DATABASE_URL. All DDL/data is rolled
// back, in a unique schema; neither real reference data nor real registrations are touched.
func TestRegisteredTransactionsPostgres(t *testing.T) {
	dsn := os.Getenv("TRANSACTION_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("set TRANSACTION_TEST_DATABASE_URL for Postgres integration checks")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	conn, err := pgx.Connect(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close(context.Background())
	tx, err := conn.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(context.Background())
	schema := pgx.Identifier{"transactions_test_" + uuid.New().String()}.Sanitize()
	if _, err = tx.Exec(ctx, "CREATE SCHEMA "+schema+"; SET LOCAL search_path TO "+schema+",public"); err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{"../../../migrations/000026_create_maharashtra_geography.up.sql", "../../../migrations/000040_registered_transactions.up.sql"} {
		sql, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		if _, err = tx.Exec(ctx, string(sql)); err != nil {
			t.Fatal(err)
		}
	}
	_, err = tx.Exec(ctx, `INSERT INTO mh_districts(code,name)VALUES('D','District');INSERT INTO mh_talukas(district_code,code,name)VALUES('D','T','Taluka');INSERT INTO mh_villages(district_code,taluka_code,code,name)VALUES('D','T','V','Village')`)
	if err != nil {
		t.Fatal(err)
	}
	r := &RegisteredTransactionRepository{pool: tx}
	now := time.Now().UTC()
	lat, lng := 19.0, 73.0
	m := transactionpipeline.ReviewedRecord{Area: 40, AreaUnit: "guntha", SourceReference: "DOC1/SRO/2026", FetchedAt: now, SinglePropertyFullInterest: true, Transaction: domain.RegisteredTransaction{
		RegistrationDate: now.AddDate(0, 0, -1), DocumentNo: "DOC1", OfficeCode: "SRO", OfficeName: "Office", DistrictCode: "D", TalukaCode: "T", VillageCode: "V", PropertyType: "land", DeedType: "sale", SalePriceRupees: 10000000, Latitude: &lat, Longitude: &lng, LocationMethod: "pin", Comparable: true, ReviewedBy: "integration-test", Source: "Maharashtra IGR", SourceURL: "https://pay2igr.igrmaharashtra.gov.in/eDisplay/Propertydetails/index",
	}}
	for i := 0; i < 2; i++ {
		if err = transactionpipeline.Import(ctx, r, []byte("synthetic source"), m, t.TempDir()); err != nil {
			t.Fatal(err)
		}
	}
	var rawCount, cleanCount int
	if err = tx.QueryRow(ctx, `SELECT (SELECT count(*) FROM transaction_source_records),(SELECT count(*) FROM registered_transactions)`).Scan(&rawCount, &cleanCount); err != nil {
		t.Fatal(err)
	}
	if rawCount != 1 || cleanCount != 1 {
		t.Fatalf("idempotency failed: raw=%d clean=%d", rawCount, cleanCount)
	}
	// Revised content keeps its original evidence and updates just one registration.
	m.Transaction.SalePriceRupees = 12000000
	if err = transactionpipeline.Import(ctx, r, []byte("revised synthetic source"), m, t.TempDir()); err != nil {
		t.Fatal(err)
	}
	q := domain.TransactionQuery{Latitude: &lat, Longitude: &lng, From: now.AddDate(0, -12, 0), To: now}
	items, err := r.FindNearby(ctx, q)
	if err != nil || len(items) != 1 || items[0].SalePriceRupees != 12000000 || *items[0].DistanceKm != 0 {
		t.Fatalf("nearby lookup: %+v %v", items, err)
	}
	// A nearby village centroid cannot masquerade as the parcel's location.
	m.Transaction.DocumentNo = "DOC2"
	m.Transaction.LocationMethod = "village_centre"
	if err = transactionpipeline.Import(ctx, r, []byte("centroid source"), m, t.TempDir()); err != nil {
		t.Fatal(err)
	}
	// A point in the SQL bounding box but outside the 3 km circle must be excluded.
	m.Transaction.DocumentNo = "DOC3"
	m.Transaction.LocationMethod = "pin"
	farLat, farLng := 19.025, 73.04
	m.Transaction.Latitude = &farLat
	m.Transaction.Longitude = &farLng
	if err = transactionpipeline.Import(ctx, r, []byte("distant source"), m, t.TempDir()); err != nil {
		t.Fatal(err)
	}
	items, err = r.FindNearby(ctx, q)
	if err != nil || len(items) != 1 {
		t.Fatalf("spatial eligibility: %+v %v", items, err)
	}
	q.Latitude = nil
	q.Longitude = nil
	q.District = "District"
	q.Taluka = "Taluka"
	q.Village = "Village"
	items, err = r.FindNearby(ctx, q)
	if err != nil || len(items) != 3 {
		t.Fatalf("canonical village fallback: %+v %v", items, err)
	}
	c, claimed, err := r.ClaimTransactionSearch(ctx, "test", q)
	if err != nil || !claimed || c.Status != "searching" {
		t.Fatal(c, claimed, err)
	}
	c, claimed, err = r.ClaimTransactionSearch(ctx, "test", q)
	if err != nil || claimed || c.Status != "searching" {
		t.Fatal("lease failed", c, claimed, err)
	}
	if err = r.FinishTransactionSearch(ctx, "test", domain.TransactionCoverage{Status: "searched"}); err != nil {
		t.Fatal(err)
	}
	c, claimed, err = r.ClaimTransactionSearch(ctx, "test", q)
	if err != nil || claimed || c.Status != "searched" || c.SearchedAt == nil {
		t.Fatal("negative-result cache failed", c, claimed, err)
	}
	down, err := os.ReadFile("../../../migrations/000040_registered_transactions.down.sql")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = tx.Exec(ctx, string(down)); err != nil {
		t.Fatal(err)
	}
}
