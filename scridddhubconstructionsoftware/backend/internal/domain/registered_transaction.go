package domain

import (
	"math"
	"sort"
	"time"
)

const TransactionRadiusKm = 3.0

type TransactionQuery struct {
	Latitude  *float64  `json:"latitude"`
	Longitude *float64  `json:"longitude"`
	District  string    `json:"district"`
	Taluka    string    `json:"taluka"`
	Village   string    `json:"village"`
	From      time.Time `json:"from"`
	To        time.Time `json:"to"`
}

type RegisteredTransaction struct {
	ID                    string    `json:"id"`
	RegistrationDate      time.Time `json:"registration_date"`
	DocumentNo            string    `json:"document_no"`
	OfficeCode            string    `json:"office_code"`
	OfficeName            string    `json:"office_name"`
	DistrictCode          string    `json:"district_code"`
	TalukaCode            string    `json:"taluka_code"`
	VillageCode           string    `json:"village_code"`
	SurveyNo              string    `json:"survey_no"`
	PropertyType          string    `json:"property_type"`
	DeedType              string    `json:"deed_type"`
	AreaAcres             float64   `json:"area_acres"`
	SalePriceRupees       int64     `json:"sale_price_rupees"`
	GovernmentValueRupees *int64    `json:"government_value_rupees"`
	Latitude              *float64  `json:"latitude"`
	Longitude             *float64  `json:"longitude"`
	LocationMethod        string    `json:"location_method"`
	Comparable            bool      `json:"comparable"`
	ExclusionReason       string    `json:"exclusion_reason"`
	ReviewedBy            string    `json:"reviewed_by"`
	Source                string    `json:"source"`
	SourceURL             string    `json:"source_url"`
	SourceRecordID        string    `json:"source_record_id"`
	DistanceKm            *float64  `json:"distance_km"`
	RatePerAcre           float64   `json:"rate_per_acre"`
}

type TransactionCoverage struct {
	Status     string     `json:"status"`
	Message    string     `json:"message"`
	SearchedAt *time.Time `json:"searched_at"`
}

type NearbyTransactions struct {
	Items         []RegisteredTransaction `json:"items"`
	Months        int                     `json:"months"`
	SixMonthCount int                     `json:"six_month_count"`
	Count         int                     `json:"count"`
	RadiusKm      float64                 `json:"radius_km"`
	MatchBasis    string                  `json:"match_basis"`
	MedianRate    *float64                `json:"median_rate_per_acre"`
	MinRate       *float64                `json:"min_rate_per_acre"`
	MaxRate       *float64                `json:"max_rate_per_acre"`
	Coverage      *TransactionCoverage    `json:"coverage"`
}

// Calendar months, clamped at month end (March 31 minus six months = September 30).
func MonthsBefore(t time.Time, months int) time.Time {
	first := time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, t.Location()).AddDate(0, -months, 0)
	day := t.Day()
	last := first.AddDate(0, 1, -1).Day()
	if day > last {
		day = last
	}
	return time.Date(first.Year(), first.Month(), day, 0, 0, 0, 0, t.Location())
}

// Inputs are already spatially matched. Recheck sale eligibility before computing statistics.
func SummarizeTransactions(rows []RegisteredTransaction, now time.Time) NearbyTransactions {
	result := NearbyTransactions{Items: []RegisteredTransaction{}, Months: 6, RadiusKm: TransactionRadiusKm}
	six, twelve := MonthsBefore(now, 6), MonthsBefore(now, 12)
	candidates := []RegisteredTransaction{}
	for _, r := range rows {
		if !r.Comparable || r.DeedType != "sale" || (r.PropertyType != "land" && r.PropertyType != "plot") ||
			r.AreaAcres <= 0 || math.IsNaN(r.AreaAcres) || math.IsInf(r.AreaAcres, 0) || r.SalePriceRupees <= 0 || r.RegistrationDate.Before(twelve) || r.RegistrationDate.After(now) {
			continue
		}
		r.RatePerAcre = float64(r.SalePriceRupees) / r.AreaAcres
		if math.IsInf(r.RatePerAcre, 0) {
			continue
		}
		candidates = append(candidates, r)
		if !r.RegistrationDate.Before(six) {
			result.SixMonthCount++
		}
	}
	if result.SixMonthCount < 3 {
		result.Months = 12
	}
	rates := []float64{}
	for _, r := range candidates {
		if result.Months == 6 && r.RegistrationDate.Before(six) {
			continue
		}
		result.Items = append(result.Items, r)
		rates = append(rates, r.RatePerAcre)
	}
	sort.Slice(result.Items, func(i, j int) bool {
		if result.Items[i].RegistrationDate.Equal(result.Items[j].RegistrationDate) {
			return result.Items[i].ID < result.Items[j].ID
		}
		return result.Items[i].RegistrationDate.After(result.Items[j].RegistrationDate)
	})
	result.Count = len(rates)
	if len(rates) >= 3 {
		sort.Float64s(rates)
		median := rates[len(rates)/2]
		if len(rates)%2 == 0 {
			median = rates[len(rates)/2-1]/2 + median/2
		}
		result.MedianRate = &median
		result.MinRate = &rates[0]
		result.MaxRate = &rates[len(rates)-1]
	}
	return result
}
