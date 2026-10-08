package usecase

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
)

type RegisteredTransactionStore interface {
	FindNearby(context.Context, domain.TransactionQuery) ([]domain.RegisteredTransaction, error)
	// Claim atomically acquires a bounded lease; another request must reuse its status.
	ClaimTransactionSearch(context.Context, string, domain.TransactionQuery) (domain.TransactionCoverage, bool, error)
	FinishTransactionSearch(context.Context, string, domain.TransactionCoverage) error
}

// A collector must archive raw evidence and upsert clean rows BEFORE reporting success.
// Complete coverage means the entire requested area AND date window, including pagination.
// A property-only search must return partial, never searched.
type RegisteredTransactionCollector interface {
	Collect(context.Context, domain.TransactionQuery) (domain.TransactionCoverage, error)
}

type RegisteredTransactionsUsecase struct {
	parcels   ParcelGetter
	store     RegisteredTransactionStore
	collector RegisteredTransactionCollector
	now       func() time.Time
}

func NewRegisteredTransactionsUsecase(p ParcelGetter, s RegisteredTransactionStore, c RegisteredTransactionCollector) *RegisteredTransactionsUsecase {
	return &RegisteredTransactionsUsecase{parcels: p, store: s, collector: c, now: time.Now}
}

func (u *RegisteredTransactionsUsecase) ForParcel(ctx context.Context, id uuid.UUID) (*domain.NearbyTransactions, error) {
	p, err := u.parcels.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	q := domain.TransactionQuery{}
	if p.District != nil {
		q.District = *p.District
	}
	if p.Taluka != nil {
		q.Taluka = *p.Taluka
	}
	if p.Village != nil {
		q.Village = *p.Village
	}
	// A village/text geocode is not a parcel pin. Use the same-village fallback instead.
	if p.Latitude != nil && p.Longitude != nil && (p.LocationSource == nil || (*p.LocationSource != "village" && *p.LocationSource != "text")) {
		q.Latitude, q.Longitude = p.Latitude, p.Longitude
	}
	return u.ForLocation(ctx, q)
}

func (u *RegisteredTransactionsUsecase) ForLocation(ctx context.Context, q domain.TransactionQuery) (*domain.NearbyTransactions, error) {
	// Registration dates are Maharashtra calendar dates, not UTC instants.
	now := u.now().In(time.FixedZone("IST", 19800))
	q.To = time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 0, now.Location())
	q.From = domain.MonthsBefore(q.To, 12)
	basis := "village"
	if q.Latitude != nil && q.Longitude != nil {
		basis = "distance"
	} else if q.District == "" || q.Taluka == "" || q.Village == "" {
		result := domain.SummarizeTransactions(nil, q.To)
		result.MatchBasis = "unresolved"
		result.Coverage = &domain.TransactionCoverage{Status: "location_required", Message: "Pin the parcel or select its district, taluka and village."}
		return &result, nil
	}
	rows, err := u.store.FindNearby(ctx, q)
	if err != nil {
		return nil, err
	}
	result := domain.SummarizeTransactions(rows, q.To)
	result.MatchBasis = basis
	// Sparse caches also deserve discovery before accepting a twelve-month fallback.
	if result.SixMonthCount >= 3 {
		return &result, nil
	}
	// Exact geometry avoids incorrectly treating adjacent circles as the same search.
	// Day/window form part of the key, so yesterday's negative result cannot hide today's sale.
	encoded, _ := json.Marshal(q)
	key := fmt.Sprintf("%x", sha256.Sum256(encoded))
	coverage, claimed, err := u.store.ClaimTransactionSearch(ctx, key, q)
	if err != nil {
		return nil, err
	}
	if claimed {
		coverage = domain.TransactionCoverage{Status: "access_required", Message: "Live IGR area discovery is not connected. Available database records are shown; coverage is incomplete."}
		if u.collector != nil {
			searchCtx, cancel := context.WithTimeout(ctx, 20*time.Second)
			collected, searchErr := u.collector.Collect(searchCtx, q)
			cancel()
			if searchErr != nil {
				coverage = domain.TransactionCoverage{Status: "failed", Message: "Could not search the registration source. Retry later."}
			} else {
				coverage = collected
			}
			if coverage.Status != "searched" && coverage.Status != "partial" && coverage.Status != "failed" && coverage.Status != "access_required" {
				coverage = domain.TransactionCoverage{Status: "failed", Message: "Source returned an invalid search status."}
			}
		}
		// Release the lease even when the requesting client disconnects.
		finishCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		err = u.store.FinishTransactionSearch(finishCtx, key, coverage)
		cancel()
		if err != nil {
			return nil, err
		}
		// Re-read after ingestion. The database is the single source of app results.
		if coverage.Status == "searched" || coverage.Status == "partial" {
			searchedAt := u.now()
			coverage.SearchedAt = &searchedAt
		}
		rows, err = u.store.FindNearby(ctx, q)
		if err != nil {
			return nil, err
		}
		result = domain.SummarizeTransactions(rows, q.To)
		result.MatchBasis = basis
	}
	result.Coverage = &coverage
	return &result, nil
}
