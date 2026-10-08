package transactionpipeline

import (
	"context"
	"github.com/scridddhub/backend/internal/domain"
	"math"
	"os"
	"testing"
	"time"
)

type importStore struct {
	raw   []SourceRecord
	clean []domain.RegisteredTransaction
}

func (s *importStore) SaveTransactionSource(_ context.Context, r SourceRecord) (string, error) {
	s.raw = append(s.raw, r)
	return "raw-id", nil
}
func (s *importStore) SaveRegisteredTransaction(_ context.Context, t domain.RegisteredTransaction) error {
	s.clean = append(s.clean, t)
	return nil
}
func reviewed() ReviewedRecord {
	return ReviewedRecord{Area: 40, AreaUnit: "guntha", SourceReference: "DOC/2026", FetchedAt: time.Now(), SinglePropertyFullInterest: true, Transaction: domain.RegisteredTransaction{Source: "Maharashtra IGR", SourceURL: "https://freesearchigrservice.maharashtra.gov.in/", RegistrationDate: time.Now().Add(-time.Hour), DocumentNo: " 123 ", OfficeCode: " haveli1 ", OfficeName: "Haveli 1", ReviewedBy: "test-reviewer", DeedType: "sale", SalePriceRupees: 100, Comparable: true}}
}
func TestAreaNormalization(t *testing.T) {
	for _, test := range []struct {
		n float64
		u string
	}{{1, "acre"}, {4046.8564224, "sqm"}, {43560, "sqft"}, {40, "guntha"}, {0.40468564224, "hectare"}} {
		got, err := Acres(test.n, test.u)
		if err != nil || math.Abs(got-1) > 1e-9 {
			t.Fatal(test, got, err)
		}
	}
	for _, n := range []float64{0, -1, math.NaN(), math.Inf(1)} {
		if _, err := Acres(n, "acre"); err == nil {
			t.Fatal("invalid area accepted")
		}
	}
	if _, err := Acres(1, "bigha"); err == nil {
		t.Fatal("ambiguous unit accepted")
	}
}
func TestRawPreservedWhenNormalizationFails(t *testing.T) {
	s := &importStore{}
	m := reviewed()
	m.AreaUnit = "unknown"
	raw := []byte("original evidence\n")
	if err := Import(context.Background(), s, raw, m, t.TempDir()); err == nil {
		t.Fatal("expected invalid unit")
	}
	if len(s.raw) != 1 || *s.raw[0].RawText != string(raw) || len(s.clean) != 0 {
		t.Fatal("raw evidence must survive parser failure")
	}
}
func TestBinaryArchiveAndExclusion(t *testing.T) {
	s := &importStore{}
	m := reviewed()
	m.SinglePropertyFullInterest = false
	raw := []byte("%PDF-synthetic-test-evidence")
	dir := t.TempDir()
	for i := 0; i < 2; i++ {
		if err := Import(context.Background(), s, raw, m, dir); err != nil {
			t.Fatal(err)
		}
	}
	if s.clean[0].Comparable || s.clean[0].AreaAcres != 1 || s.clean[0].SourceRecordID != "raw-id" || s.clean[0].OfficeCode != "HAVELI1" {
		t.Fatal(s.clean)
	}
	bytes, err := os.ReadFile(*s.raw[0].FilePath)
	if err != nil || string(bytes) != string(raw) {
		t.Fatal("evidence changed", err)
	}
	if s.raw[0].Hash != s.raw[1].Hash {
		t.Fatal("unstable hash")
	}
}
