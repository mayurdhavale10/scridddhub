// Package setup builds the planned-infrastructure pipeline from its real parts, so the server
// (on-demand searches, Step C) and cmd/infra_pipeline (bulk and scheduled runs) are wired
// identically.
package setup

import (
	"errors"
	"log"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scridddhub/backend/internal/geo"
	"github.com/scridddhub/backend/internal/infrapipeline"
	"github.com/scridddhub/backend/internal/infrapipeline/fetch"
	"github.com/scridddhub/backend/internal/infrapipeline/geodata"
	"github.com/scridddhub/backend/internal/infrapipeline/locate"
	"github.com/scridddhub/backend/internal/infrapipeline/verify"
	"github.com/scridddhub/backend/internal/llm"
	"github.com/scridddhub/backend/internal/repository/postgres"
	"github.com/scridddhub/backend/internal/search"
)

// PublicGeocodeBudget bounds one run's use of the public Nominatim service (≤1 req/s, no bulk).
// Development only — set NOMINATIM_URL to the self-hosted geocoder before launch or more agencies
// (docs/self-hosted-nominatim.md). Decided with the owner 2026-09-27.
const PublicGeocodeBudget = 300

type Built struct {
	Pipeline   *infrapipeline.Pipeline
	Store      *postgres.InfraPipelineStore
	Discoverer infrapipeline.Discoverer
}

// New wires the pipeline. policy "" means INFRA_PUBLISH_POLICY or the default (evidence).
func New(pool *pgxpool.Pool, groqKey, policyName string, logf func(string, ...any)) (*Built, error) {
	if policyName == "" {
		policyName = os.Getenv("INFRA_PUBLISH_POLICY")
	}
	policy, err := infrapipeline.ParsePublishPolicy(policyName)
	if err != nil {
		return nil, err
	}
	if logf == nil {
		logf = log.Printf
	}

	var geocoder *geo.NominatimGeocoder
	if u := os.Getenv("NOMINATIM_URL"); u != "" {
		geocoder = geo.NewNominatimGeocoderWithBaseURL(u)
	} else {
		geocoder = geo.NewNominatimGeocoder()
	}
	locator := locate.New(geocoder, postgres.NewGeocodeCacheRepository(pool))
	if geocoder.IsPublic() {
		locator.Budget = PublicGeocodeBudget
	}

	// Discovery (Step C): Exa when EXA_API_KEY is set (reliable, domain-filtered); otherwise Groq
	// browser_search, which failed repeatedly on 2026-09-27 and is only a fallback.
	var discoverer infrapipeline.Discoverer = llm.NewGroqAreaDiscoverer(groqKey)
	if k := os.Getenv("EXA_API_KEY"); k != "" {
		discoverer = search.NewExaDiscoverer(k)
	}

	store := postgres.NewInfraPipelineStore(pool)
	return &Built{
		Store:      store,
		Discoverer: discoverer,
		Pipeline: &infrapipeline.Pipeline{
			Store:     store,
			Fetcher:   fetch.New(),
			Extractor: llm.NewGroqInfraExtractor(groqKey),
			Verifier:  verify.Verifier{},
			Geodata:   geodata.Parser{},
			Locator:   locator,
			Policy:    policy,
			Logf:      logf,
			IsFatal:   func(err error) bool { return errors.Is(err, llm.ErrDailyQuota) },
		},
	}, nil
}
