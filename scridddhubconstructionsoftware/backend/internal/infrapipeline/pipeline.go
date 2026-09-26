// Package infrapipeline builds and refreshes the planned-infrastructure reference list from
// official agency sources, with no manual steps — see
// services/plannedinfrastructure/PIPELINE_PLAN.md.
//
// Stages: Sources → Fetch → Extract → Verify → Locate → Dedupe → Store.
// This file defines the types passed between stages and the interfaces each stage implements, so
// stages can be built and tested independently (sub-packages fetch/, geodata/, extract/, verify/).
//
// Rules every stage must keep (plan §2):
//   - Official public pages only; obey robots.txt; identify the app; rate-limit per domain;
//     record blocks (403/429/challenge) instead of working around them.
//   - Never publish a fact without an evidence quote that exists in the fetched page text.
package infrapipeline

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// ---------------------------------------------------------------------------------------------
// Stage 1 · Sources
// ---------------------------------------------------------------------------------------------

type SourceKind string

const (
	SourceProjectIndex SourceKind = "project_index" // lists projects; yields new project_page sources
	SourceProjectPage  SourceKind = "project_page"  // one project's facts
	SourceGeodata      SourceKind = "geodata"       // KML / KMZ / GeoJSON with coordinates
	SourceDocument     SourceKind = "document"      // PDF etc. (v2)
)

type RobotsStatus string

const (
	RobotsAllowed    RobotsStatus = "allowed"
	RobotsDisallowed RobotsStatus = "disallowed"
	RobotsUnknown    RobotsStatus = "unknown"
)

// Source is one registry row (table infrastructure_sources).
type Source struct {
	ID           uuid.UUID
	Agency       string // "MMRDA", "CIDCO", ...
	URL          string
	Kind         SourceKind
	Enabled      bool
	RobotsStatus RobotsStatus
	// LastContentHash lets the orchestrator skip re-extracting an unchanged page.
	LastContentHash string
	// ProjectHint names the project this source is about. Required for geodata (a KML has
	// coordinates but no verifiable project name); on a project page it keeps the dedupe key
	// stable when the page's own title varies. Resolved with CanonicalKey(Agency, ProjectHint).
	ProjectHint string
}

// ---------------------------------------------------------------------------------------------
// Stage 2 · Fetch  (implemented in infrapipeline/fetch — Codex task T1.2)
// ---------------------------------------------------------------------------------------------

type FetchStatus string

const (
	FetchOK      FetchStatus = "ok"
	FetchBlocked FetchStatus = "blocked" // robots.txt disallow, 403, 429, or a bot-challenge page
	FetchError   FetchStatus = "error"   // network failure, 5xx, unreadable body
)

// FetchResult is one fetched page. Text is the normalized text (tags, scripts, styles and site
// navigation removed; whitespace collapsed) — the exact text evidence quotes are checked against.
// Raw keeps the original bytes for binary kinds (KML/KMZ/GeoJSON) that the geodata parser needs.
type FetchResult struct {
	FinalURL    string
	HTTPStatus  int // 0 when no request was made (e.g. robots.txt disallowed)
	Status      FetchStatus
	Detail      string // human-readable reason for blocked/error
	ContentType string
	Raw         []byte
	Text        string
	ContentHash string // sha256 hex of Raw
	FetchedAt   time.Time
}

// Fetcher retrieves one URL politely. It returns a non-nil error only when ctx is cancelled or on
// a programming error; every network/HTTP outcome is reported through FetchResult.Status.
// Implementations must be safe for concurrent use.
type Fetcher interface {
	Fetch(ctx context.Context, url string) (FetchResult, error)
}

// ---------------------------------------------------------------------------------------------
// Geodata  (implemented in infrapipeline/geodata — Codex task T1.3)
// ---------------------------------------------------------------------------------------------

type PointKind string

const (
	PointStation PointKind = "station"
	PointRoute   PointKind = "route"
)

// GeoPoint is one located feature from an official geodata file.
type GeoPoint struct {
	Label     string // cleaned, e.g. "Bhiwandi" from "Bhiwandi(M) Statiion"
	Kind      PointKind
	Latitude  float64
	Longitude float64
}

// GeodataParser turns a KML, KMZ or GeoJSON file into points. contentType and url help it pick
// the format; the bytes decide if they disagree.
type GeodataParser interface {
	Parse(raw []byte, contentType, url string) ([]GeoPoint, error)
}

// ---------------------------------------------------------------------------------------------
// Stage 3 · Extract  (implemented in infrapipeline/extract — Claude task T2.1)
// ---------------------------------------------------------------------------------------------

// Field is one extracted value plus the verbatim sentence from the page that states it. Value is
// nil when the page doesn't state it — the extractor must never infer (especially dates).
type Field[T any] struct {
	Value    *T
	Evidence string
}

// NamedPlace is a station or locality named on the page.
type NamedPlace struct {
	Name     string
	Evidence string
}

type ExtractedProject struct {
	Name               string
	NameEvidence       string
	Kind               string // metro | suburban_rail | highway | road | airport | other
	Status             Field[string]
	ExpectedCompletion Field[string]
	LengthKm           Field[float64]
	Stations           []NamedPlace
	Localities         []NamedPlace
}

// DiscoveredSource is a new official page found on an index page (e.g. a project's own page).
type DiscoveredSource struct {
	URL  string
	Kind SourceKind
}

type ExtractResult struct {
	Projects   []ExtractedProject
	Discovered []DiscoveredSource
}

type Extractor interface {
	Extract(ctx context.Context, src Source, page FetchResult) (ExtractResult, error)
}

// ---------------------------------------------------------------------------------------------
// Stage 4 · Verify  (implemented in infrapipeline/verify — Claude task T2.2)
// ---------------------------------------------------------------------------------------------

// VerifiedProject keeps only fields whose evidence was found in the page text; FieldEvidence maps
// each kept field name to its quote, and Rejected lists fields dropped for missing evidence.
type VerifiedProject struct {
	Project       ExtractedProject
	FieldEvidence map[string]string
	Rejected      []string
}

type Verifier interface {
	Verify(p ExtractedProject, pageText string) VerifiedProject
}

// ---------------------------------------------------------------------------------------------
// Stage 5 · Locate  (Claude task T4.1)
// ---------------------------------------------------------------------------------------------

type CoordSource string

const (
	CoordOfficialFile CoordSource = "official_file"
	CoordApproximate  CoordSource = "approximate"
	CoordManual       CoordSource = "manual"
)

type LocatedPoint struct {
	GeoPoint
	CoordSource CoordSource
}

// Locator places a project's stations: official geodata points first, geocoding otherwise.
type Locator interface {
	Locate(ctx context.Context, p VerifiedProject, official []GeoPoint) ([]LocatedPoint, error)
}

// ---------------------------------------------------------------------------------------------
// Stages 6–7 · Dedupe + Store  (Claude task T4.1)
// ---------------------------------------------------------------------------------------------

type ReviewStatus string

const (
	ReviewPending  ReviewStatus = "pending"
	ReviewApproved ReviewStatus = "approved"
)

// CanonicalProject is a deduplicated project ready to store, with every source that supports it.
type CanonicalProject struct {
	Key     string // agency + normalized name; stable across runs
	Agency  string
	Project VerifiedProject
	Points  []LocatedPoint
	Sources []ProjectSourceRef
	Review  ReviewStatus
}

type ProjectSourceRef struct {
	SourceID      uuid.UUID
	SourceURL     string
	FetchID       uuid.UUID
	FieldEvidence map[string]string
}

type RunTrigger string

const (
	TriggerCLI      RunTrigger = "cli"
	TriggerOnDemand RunTrigger = "on_demand"
	TriggerSchedule RunTrigger = "schedule"
)

// RunStats is stored on infrastructure_pipeline_runs.stats.
type RunStats struct {
	Sources   int `json:"sources"`
	Fetched   int `json:"fetched"`
	Unchanged int `json:"unchanged"`
	Blocked   int `json:"blocked"`
	Errors    int `json:"errors"`
	Extracted int `json:"extracted"`
	Rejected  int `json:"rejected_fields"`
	Approved  int `json:"approved"`
	Pending   int `json:"pending"`
}

// Store persists pipeline state (implemented over Postgres in repository/postgres).
type Store interface {
	ListEnabledSources(ctx context.Context, agency string) ([]Source, error)
	AddDiscoveredSources(ctx context.Context, from uuid.UUID, agency string, found []DiscoveredSource) (int, error)
	StartRun(ctx context.Context, trigger RunTrigger, params map[string]any) (uuid.UUID, error)
	FinishRun(ctx context.Context, runID uuid.UUID, stats RunStats, runErr error) error
	SaveFetch(ctx context.Context, runID uuid.UUID, src Source, res FetchResult) (uuid.UUID, error)
	// MarkUnchanged records that a source was re-checked and its content hash hadn't changed —
	// no new fetch row, so identical page copies aren't stored again.
	MarkUnchanged(ctx context.Context, sourceID uuid.UUID) error
	// UpsertProject inserts or updates by Key, never overwriting a project's locked fields, and
	// never downgrading an approved project to pending. A candidate whose name didn't verify can
	// only update an existing project (e.g. new official points); it never creates one. Returns
	// whether a row was written.
	UpsertProject(ctx context.Context, p CanonicalProject) (bool, error)
}
