package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/scridddhub/backend/internal/infrapipeline"
)

// GroqAreaDiscoverer implements infrapipeline.Discoverer with Groq's built-in browser_search tool
// on gpt-oss-120b (groq/compound, which had domain filtering, was deprecated 2026-09-21).
// browser_search can't be limited to domains, so it returns every URL it saw; the pipeline then
// keeps only official ones (infrapipeline.FilterOfficial) and verifies facts from those pages
// itself. Nothing the model *says* is used — only which pages it found.
//
// Cost note (measured 2026-09-27): a search call is slow (can take ~2 min) and puts search
// results into the prompt, so it uses far more tokens than an extraction; on the free tier's
// 200k tokens/day it competes with extraction for the same daily budget.
type GroqAreaDiscoverer struct {
	apiKey   string
	model    string
	endpoint string
	client   *http.Client
}

var _ infrapipeline.Discoverer = (*GroqAreaDiscoverer)(nil)

func NewGroqAreaDiscoverer(apiKey string) *GroqAreaDiscoverer {
	return &GroqAreaDiscoverer{
		apiKey:   apiKey,
		model:    "openai/gpt-oss-120b",
		endpoint: groqChatCompletionsURL,
		client:   &http.Client{Timeout: 5 * time.Minute},
	}
}

func discoveryPrompt(place string) string {
	return fmt.Sprintf(`Find official Indian government web pages about PLANNED or UNDER-CONSTRUCTION
transport infrastructure (metro lines, suburban rail, highways, expressways, bridges, tunnels,
airports) near %s. Prefer the implementing agency's own project pages (e.g. MMRDA, CIDCO, MSRDC,
MMRCL, NHAI, MRVC, NHSRCL, municipal corporations) on government domains such as *.gov.in.
Do not use news sites, property portals, blogs or Wikipedia.
List the exact URL of each official page you found, one per line.`, place)
}

type browserSearchRequest struct {
	Model       string            `json:"model"`
	Messages    []groqChatMessage `json:"messages"`
	Tools       []map[string]any  `json:"tools"`
	ToolChoice  string            `json:"tool_choice"`
	Temperature float64           `json:"temperature"`
}

// Discover retries once on the transient failures browser_search showed on 2026-09-27 ("Parsing
// failed ... failed_generation", gateway 5xx/524 timeouts). A daily-quota error is not retried.
func (d *GroqAreaDiscoverer) Discover(ctx context.Context, place string, _ []string) ([]string, error) {
	urls, err := d.discoverOnce(ctx, place)
	if err != nil && ctx.Err() == nil && !errors.Is(err, ErrDailyQuota) && isTransientSearchError(err) {
		urls, err = d.discoverOnce(ctx, place)
	}
	return urls, err
}

func isTransientSearchError(err error) bool {
	s := err.Error()
	return strings.Contains(s, "Parsing failed") || strings.Contains(s, "HTTP 5") || strings.Contains(s, "timeout")
}

func (d *GroqAreaDiscoverer) discoverOnce(ctx context.Context, place string) ([]string, error) {
	body, err := json.Marshal(browserSearchRequest{
		Model:       d.model,
		Messages:    []groqChatMessage{{Role: "user", Content: discoveryPrompt(place)}},
		Tools:       []map[string]any{{"type": "browser_search"}},
		ToolChoice:  "required",
		Temperature: 0,
	})
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, d.endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+d.apiKey)
	resp, err := d.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 500 {
		return nil, fmt.Errorf("browser search: HTTP %d", resp.StatusCode)
	}
	var errResp struct {
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if json.Unmarshal(raw, &errResp) == nil && errResp.Error != nil {
		err := fmt.Errorf("groq API error: %s", errResp.Error.Message)
		if isDailyQuota(err) {
			return nil, fmt.Errorf("%w: %v", ErrDailyQuota, err)
		}
		return nil, err
	}
	return ExtractDiscoveredURLs(raw), nil
}

var urlRe = regexp.MustCompile(`https?://[^\s<>"'\)\]】,]+`)

// ExtractDiscoveredURLs collects every URL in a browser_search response — from the answer text and
// from the tool's own search results (`executed_tools[].search_results.results[].url`) — walking
// the JSON generically so a changed response shape degrades to fewer URLs rather than an error.
// Exported for tests.
func ExtractDiscoveredURLs(raw []byte) []string {
	var doc any
	if err := json.Unmarshal(raw, &doc); err != nil {
		return nil
	}
	seen := map[string]bool{}
	var out []string
	add := func(u string) {
		u = strings.TrimRight(u, ".;:")
		if !seen[u] {
			seen[u] = true
			out = append(out, u)
		}
	}
	var walk func(v any, key string)
	walk = func(v any, key string) {
		switch t := v.(type) {
		case map[string]any:
			for k, child := range t {
				walk(child, k)
			}
		case []any:
			for _, child := range t {
				walk(child, key)
			}
		case string:
			if key == "url" {
				add(t)
				return
			}
			for _, u := range urlRe.FindAllString(t, -1) {
				add(u)
			}
		}
	}
	walk(doc, "")
	return out
}
