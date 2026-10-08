package domain

import (
	"testing"
	"time"
)

func TestRegisteredTransactionSummary(t *testing.T) {
	now := time.Date(2026, 9, 29, 23, 59, 59, 0, time.UTC)
	sale := func(date time.Time, area float64, price int64) RegisteredTransaction {
		return RegisteredTransaction{RegistrationDate: date, AreaAcres: area, SalePriceRupees: price, Comparable: true, DeedType: "sale", PropertyType: "land"}
	}
	recent := now.AddDate(0, -1, 0)
	rows := []RegisteredTransaction{sale(recent, 5, 50000000), sale(recent, 1, 20000000), sale(recent, 1, 90000000), sale(now.AddDate(0, -8, 0), 1, 1000000)}
	result := SummarizeTransactions(rows, now)
	if result.Months != 6 || result.Count != 3 || result.MedianRate == nil || *result.MedianRate != 20000000 || *result.MinRate != 10000000 {
		t.Fatalf("per-acre median: %+v", result)
	}
	rows[2].DeedType = "gift"
	result = SummarizeTransactions(rows, now)
	if result.Months != 12 || result.SixMonthCount != 2 || result.Count != 3 || *result.MedianRate != 10000000 {
		t.Fatalf("fallback/filtering: %+v", result)
	}
	rows[3].PropertyType = "flat"
	result = SummarizeTransactions(rows, now)
	if result.Count != 2 || result.MedianRate != nil || result.MinRate != nil {
		t.Fatalf("sparse sample must not publish estimate: %+v", result)
	}
}

func TestRegisteredTransactionDatesAndEligibility(t *testing.T) {
	now := time.Date(2026, 3, 31, 23, 59, 59, 0, time.UTC)
	if got := MonthsBefore(now, 6).Format("2006-01-02"); got != "2025-09-30" {
		t.Fatal(got)
	}
	cutoff := MonthsBefore(now, 12)
	rows := []RegisteredTransaction{}
	for _, date := range []time.Time{cutoff, cutoff.AddDate(0, 0, -1), now.AddDate(0, 0, 1)} {
		rows = append(rows, RegisteredTransaction{RegistrationDate: date, AreaAcres: 1, SalePriceRupees: 1, Comparable: true, DeedType: "sale", PropertyType: "plot"})
	}
	got := SummarizeTransactions(rows, now)
	if got.Count != 1 {
		t.Fatalf("inclusive lower bound and future exclusion: %+v", got)
	}
	got = SummarizeTransactions(nil, now)
	if got.Items == nil || got.Count != 0 || got.MedianRate != nil {
		t.Fatalf("empty response: %+v", got)
	}
}

func TestRegisteredTransactionEvenMedian(t *testing.T) {
	now := time.Now()
	rows := []RegisteredTransaction{}
	for _, p := range []int64{10, 20, 30, 1000} {
		rows = append(rows, RegisteredTransaction{RegistrationDate: now, AreaAcres: 1, SalePriceRupees: p, Comparable: true, DeedType: "sale", PropertyType: "land"})
	}
	got := SummarizeTransactions(rows, now)
	if got.MedianRate == nil || *got.MedianRate != 25 {
		t.Fatalf("even median: %+v", got)
	}
}
