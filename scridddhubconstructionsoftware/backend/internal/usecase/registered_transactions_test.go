package usecase

import (
	"context"
	"errors"
	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
	"testing"
	"time"
)

type transactionTestStore struct {
	rows                    []domain.RegisteredTransaction
	claims, reads, finishes int
	claimed                 bool
	coverage                domain.TransactionCoverage
	query                   domain.TransactionQuery
}

func (s *transactionTestStore) FindNearby(_ context.Context, q domain.TransactionQuery) ([]domain.RegisteredTransaction, error) {
	s.reads++
	s.query = q
	return s.rows, nil
}
func (s *transactionTestStore) ClaimTransactionSearch(context.Context, string, domain.TransactionQuery) (domain.TransactionCoverage, bool, error) {
	s.claims++
	return s.coverage, s.claimed, nil
}
func (s *transactionTestStore) FinishTransactionSearch(_ context.Context, _ string, c domain.TransactionCoverage) error {
	s.finishes++
	s.coverage = c
	return nil
}

type transactionCollectorFunc func(context.Context, domain.TransactionQuery) (domain.TransactionCoverage, error)

func (f transactionCollectorFunc) Collect(c context.Context, q domain.TransactionQuery) (domain.TransactionCoverage, error) {
	return f(c, q)
}

func TestTransactionDatabaseFirstAndDemandReread(t *testing.T) {
	now := time.Date(2026, 9, 29, 12, 0, 0, 0, time.UTC)
	makeRows := func() []domain.RegisteredTransaction {
		rows := []domain.RegisteredTransaction{}
		for i := 0; i < 3; i++ {
			rows = append(rows, domain.RegisteredTransaction{RegistrationDate: now, PropertyType: "land", DeedType: "sale", Comparable: true, AreaAcres: 1, SalePriceRupees: 10000000})
		}
		return rows
	}
	q := domain.TransactionQuery{District: "D", Taluka: "T", Village: "V"}
	s := &transactionTestStore{rows: makeRows(), claimed: true}
	u := NewRegisteredTransactionsUsecase(nil, s, nil)
	u.now = func() time.Time { return now }
	result, err := u.ForLocation(context.Background(), q)
	if err != nil || result.Count != 3 || s.claims != 0 {
		t.Fatalf("database hit should not collect: %+v %v", result, err)
	}
	s.rows = nil
	u.collector = transactionCollectorFunc(func(context.Context, domain.TransactionQuery) (domain.TransactionCoverage, error) {
		s.rows = makeRows()
		return domain.TransactionCoverage{Status: "searched"}, nil
	})
	result, err = u.ForLocation(context.Background(), q)
	if err != nil || result.Count != 3 || result.Coverage.Status != "searched" || s.finishes != 1 || s.reads != 3 {
		t.Fatalf("collection must be reread from database: %+v %v", result, err)
	}
}

func TestTransactionCoverageFailureAndSharedSearch(t *testing.T) {
	q := domain.TransactionQuery{District: "D", Taluka: "T", Village: "V"}
	for _, status := range []string{"searching", "searched", "access_required"} {
		s := &transactionTestStore{coverage: domain.TransactionCoverage{Status: status}}
		u := NewRegisteredTransactionsUsecase(nil, s, transactionCollectorFunc(func(context.Context, domain.TransactionQuery) (domain.TransactionCoverage, error) {
			t.Fatal("duplicate search")
			return domain.TransactionCoverage{}, nil
		}))
		result, err := u.ForLocation(context.Background(), q)
		if err != nil || result.Coverage.Status != status || s.finishes != 0 {
			t.Fatalf("cached coverage: %+v %v", result, err)
		}
	}
	s := &transactionTestStore{claimed: true}
	u := NewRegisteredTransactionsUsecase(nil, s, nil)
	result, err := u.ForLocation(context.Background(), q)
	if err != nil || result.Coverage.Status != "access_required" {
		t.Fatal(result, err)
	}
	u.collector = transactionCollectorFunc(func(context.Context, domain.TransactionQuery) (domain.TransactionCoverage, error) {
		return domain.TransactionCoverage{}, errors.New("source timeout")
	})
	result, err = u.ForLocation(context.Background(), q)
	if err != nil || result.Coverage.Status != "failed" {
		t.Fatal(result, err)
	}
}

func TestTransactionParcelVillageFallback(t *testing.T) {
	d, ta, v, source := "D", "T", "V", "village"
	lat, lng := 19.0, 73.0
	p := &domain.LandParcel{District: &d, Taluka: &ta, Village: &v, Latitude: &lat, Longitude: &lng, LocationSource: &source}
	s := &transactionTestStore{}
	u := NewRegisteredTransactionsUsecase(oneParcel{p}, s, nil)
	result, err := u.ForParcel(context.Background(), uuid.New())
	if err != nil || result.MatchBasis != "village" || s.query.Latitude != nil {
		t.Fatalf("village centroid is not a parcel pin: %+v %v", result, err)
	}
	source = "pin"
	result, err = u.ForParcel(context.Background(), uuid.New())
	if err != nil || result.MatchBasis != "distance" || s.query.Latitude == nil {
		t.Fatal(result, err)
	}
	p.Latitude = nil
	p.Longitude = nil
	p.Village = nil
	reads := s.reads
	result, err = u.ForParcel(context.Background(), uuid.New())
	if err != nil || result.Coverage.Status != "location_required" || s.reads != reads {
		t.Fatal(result, err)
	}
}
