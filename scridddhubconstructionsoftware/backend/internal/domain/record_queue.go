package domain

import (
	"time"

	"github.com/google/uuid"
)

// Land records fetched once and reused (docs/design/land-records-acquisition.md). A RecordRequest
// is one lookup waiting for a person to type the captcha on the official site (the app fills the
// rest). A CachedRecord is what came back, keyed by the land itself so any parcel or report on the
// same survey number reuses it.

const (
	RecordKind712 = "7_12"

	RecordQueued   = "queued"
	RecordFetched  = "fetched"
	RecordNotFound = "not_found"
	RecordSkipped  = "skipped"
)

// RecordCacheFreshDays: a cached 7/12 older than this is re-fetched before an advocate signs.
const RecordCacheFreshDays = 30

type RecordRequest struct {
	ID           uuid.UUID
	Kind         string
	District     string
	Taluka       string
	Village      string
	SurveyNumber string
	SurveyKey    string
	Status       string
	Note         string
	LandParcelID *uuid.UUID
	RequestedBy  string
	CreatedAt    time.Time
	UpdatedAt    time.Time
	// Marathi names as the official site's dropdowns show them (from the village master).
	DistrictMR, TalukaMR, VillageMR string
}

type CachedRecord struct {
	Kind         string
	District     string
	Taluka       string
	Village      string
	SurveyNumber string
	SurveyKey    string
	RawText      string
	Parsed       SevenTwelve
	ReadBy       string
	SourceURL    string
	FetchedBy    string
	FetchedAt    time.Time
}

// Fresh reports whether the record can be relied on without fetching it again.
func (c *CachedRecord) Fresh(now time.Time) bool {
	return now.Sub(c.FetchedAt) <= RecordCacheFreshDays*24*time.Hour
}
