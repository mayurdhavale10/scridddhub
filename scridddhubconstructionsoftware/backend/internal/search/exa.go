// Package search implements infrapipeline.Discoverer with web search APIs.
package search

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/scridddhub/backend/internal/infrapipeline"
)

// ExaDiscoverer finds candidate official pages about infrastructure near a place with Exa's search
// API (https://exa.ai/docs/reference/search), restricted to the official-domain allowlist via
// includeDomains. Chosen 2026-09-27 after Groq browser_search failed repeatedly and Google's Custom
// Search API closed to new customers. Measured then: ~2 s per search, $0.012 each (Exa's free
// monthly credit covers several hundred). Only URLs are used — facts come from the fetched pages.
type ExaDiscoverer struct {
	apiKey     string
	endpoint   string
	numResults int
	client     *http.Client
}

var _ infrapipeline.Discoverer = (*ExaDiscoverer)(nil)

func NewExaDiscoverer(apiKey string) *ExaDiscoverer {
	return &ExaDiscoverer{
		apiKey:     apiKey,
		endpoint:   "https://api.exa.ai/search",
		numResults: 20,
		client:     &http.Client{Timeout: 60 * time.Second},
	}
}

type exaRequest struct {
	Query          string   `json:"query"`
	Type           string   `json:"type"`
	NumResults     int      `json:"numResults"`
	IncludeDomains []string `json:"includeDomains,omitempty"`
}

type exaResponse struct {
	Results []struct {
		URL   string `json:"url"`
		Title string `json:"title"`
	} `json:"results"`
	Error string `json:"error"`
}

// exaQueries: one search per theme. A single query naming every kind of project returned mostly
// transport pages, so jobs hubs, utilities and hazards get their own.
func exaQueries(place string) []string {
	return []string{
		"planned or under-construction metro, suburban rail, highway, expressway, bridge, tunnel or airport project near " + place,
		"new industrial estate, MIDC area, IT park, SEZ, logistics park, growth centre, water supply scheme, sewage treatment plant, power substation or landfill project near " + place,
	}
}

// exaDomains sends each allowlisted domain both exactly and as a wildcard, so "gov.in" also covers
// "raigad.gov.in" and "mmrcl.com" covers "www.mmrcl.com".
func exaDomains(domains []string) []string {
	out := make([]string, 0, 2*len(domains))
	for _, d := range domains {
		out = append(out, d, "*."+d)
	}
	return out
}

// Discover runs each theme's search and returns the URLs found, first-seen order, without repeats.
func (e *ExaDiscoverer) Discover(ctx context.Context, place string, domains []string) ([]string, error) {
	var urls []string
	seen := map[string]bool{}
	for _, q := range exaQueries(place) {
		found, err := e.search(ctx, q, domains)
		if err != nil {
			return nil, err
		}
		for _, u := range found {
			if !seen[u] {
				seen[u] = true
				urls = append(urls, u)
			}
		}
	}
	return urls, nil
}

func (e *ExaDiscoverer) search(ctx context.Context, query string, domains []string) ([]string, error) {
	body, err := json.Marshal(exaRequest{Query: query, Type: "auto", NumResults: e.numResults, IncludeDomains: exaDomains(domains)})
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, e.endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", e.apiKey)

	resp, err := e.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 5<<20))
	if err != nil {
		return nil, err
	}
	var r exaResponse
	if err := json.Unmarshal(raw, &r); err != nil {
		return nil, fmt.Errorf("exa: HTTP %d, unreadable response", resp.StatusCode)
	}
	if resp.StatusCode != http.StatusOK {
		msg := r.Error
		if msg == "" {
			msg = strings.TrimSpace(string(raw[:min(len(raw), 200)]))
		}
		return nil, fmt.Errorf("exa: HTTP %d: %s", resp.StatusCode, msg)
	}

	urls := make([]string, 0, len(r.Results))
	for _, res := range r.Results {
		if res.URL != "" && !isDocument(res.URL) {
			urls = append(urls, res.URL)
		}
	}
	return urls, nil
}

// isDocument: PDFs (and download handlers serving them) can't be read by pipeline v1 — skipping
// them at discovery saves a pointless fetch each. PDF extraction is a planned v2 source kind.
func isDocument(u string) bool {
	l := strings.ToLower(u)
	return strings.HasSuffix(strings.SplitN(l, "?", 2)[0], ".pdf") || strings.Contains(l, "downloadpdf")
}
