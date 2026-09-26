package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/scridddhub/backend/internal/infrapipeline"
)

// GroqInfraExtractor implements infrapipeline.Extractor (stage 3 of the planned-infrastructure
// pipeline, PIPELINE_PLAN.md). It reads one official page and returns the projects it describes,
// each field paired with the verbatim sentence that states it. Its output is never trusted on its
// own: infrapipeline/verify drops any field whose quote isn't really on the page.
//
// Links to new project pages are found deterministically from the page's HTML (not by the LLM),
// so the model can't invent URLs.
type GroqInfraExtractor struct {
	apiKey   string
	model    string
	endpoint string
	client   *http.Client
}

var _ infrapipeline.Extractor = (*GroqInfraExtractor)(nil)

func NewGroqInfraExtractor(apiKey string) *GroqInfraExtractor {
	return &GroqInfraExtractor{
		apiKey:   apiKey,
		model:    "openai/gpt-oss-120b", // accuracy over speed: this runs offline in a batch pipeline
		endpoint: groqChatCompletionsURL,
		client:   &http.Client{Timeout: 60 * time.Second},
	}
}

// maxPageChars bounds the prompt. Project pages are short once navigation is stripped; anything
// beyond this is almost always boilerplate.
const maxPageChars = 24000

const infraExtractionSystemPrompt = `You extract facts about public infrastructure projects (metro
lines, rail, roads, highways, bridges, tunnels, airports) from ONE page of an official Indian
government agency website.

Rules — follow exactly:
- Use ONLY what the page text states. Never use outside knowledge. Never infer or estimate.
- For every value you return, copy the exact supporting sentence or phrase from the page into
  "evidence", character for character (you may shorten it, but never reword it). Evidence must be
  ONE continuous piece of the page — never join words from different parts of the page, never
  add or drop words in the middle. It must be at least 12 characters and contain the value.
- If the page does not state a value, return null for "value" and null for "evidence".
  In particular: if no completion/opening date is written on the page, expected_completion is null.
- "status" must be one of: planned, under_construction, partially_operational, operational — and
  only when the page says so or shows it plainly (e.g. construction progress percentages mean
  under_construction). Otherwise null.
- "kind" is one of: metro, suburban_rail, highway, road, airport, other.
- List stations only if the page names them as stations; list other named places the project
  passes through as localities. Each needs evidence containing that name.
- Ignore site navigation menus, footers, and lists of the agency's other projects.
- Only TRANSPORT infrastructure counts. If the page's project is not transport (e.g. waste
  processing, water supply, housing, landscaping, IT systems, studies, training institutes,
  memorials), return {"projects": []}.
- Only PHYSICAL projects with a place: a line, road, bridge, tunnel, station or airport. Skip
  programme items that aren't a place — procurement, rolling stock, power conversion, technical
  assistance, institutional strengthening, resettlement.
- If the page describes no specific project, return {"projects": []}.

Respond with ONLY this JSON, no other text:
{
  "projects": [
    {
      "name": string,
      "name_evidence": string,
      "kind": string,
      "status": {"value": string|null, "evidence": string|null},
      "expected_completion": {"value": string|null, "evidence": string|null},
      "length_km": {"value": number|null, "evidence": string|null},
      "stations": [{"name": string, "evidence": string}],
      "localities": [{"name": string, "evidence": string}]
    }
  ]
}`

type wireField[T any] struct {
	Value    *T      `json:"value"`
	Evidence *string `json:"evidence"`
}

type wirePlace struct {
	Name     string `json:"name"`
	Evidence string `json:"evidence"`
}

// UnmarshalJSON also accepts a bare string ("Navi Mumbai") — the model sometimes returns places
// that way (seen on MMRDA's Atal Setu page, 2026-09-27). With no quote, the verifier re-anchors
// the place to a real page sentence or rejects it.
func (p *wirePlace) UnmarshalJSON(b []byte) error {
	var s string
	if err := json.Unmarshal(b, &s); err == nil {
		p.Name, p.Evidence = s, ""
		return nil
	}
	type plain wirePlace
	return json.Unmarshal(b, (*plain)(p))
}

type wireProject struct {
	Name               string             `json:"name"`
	NameEvidence       string             `json:"name_evidence"`
	Kind               string             `json:"kind"`
	Status             wireField[string]  `json:"status"`
	ExpectedCompletion wireField[string]  `json:"expected_completion"`
	LengthKm           wireField[float64] `json:"length_km"`
	Stations           []wirePlace        `json:"stations"`
	Localities         []wirePlace        `json:"localities"`
}

type wireExtraction struct {
	Projects []wireProject `json:"projects"`
}

func (e *GroqInfraExtractor) Extract(ctx context.Context, src infrapipeline.Source, page infrapipeline.FetchResult) (infrapipeline.ExtractResult, error) {
	var result infrapipeline.ExtractResult
	if src.Kind == infrapipeline.SourceProjectIndex {
		result.Discovered = DiscoverProjectLinks(page.FinalURL, page.Raw)
	}
	if strings.TrimSpace(page.Text) == "" {
		return result, nil
	}

	text := page.Text
	if len(text) > maxPageChars {
		text = text[:maxPageChars]
	}
	user := fmt.Sprintf("Agency: %s\nPage URL: %s\n\nPage text:\n<<<\n%s\n>>>", src.Agency, page.FinalURL, text)

	content, err := e.complete(ctx, user)
	if err != nil {
		return result, err
	}
	projects, err := ParseInfraExtraction(content)
	if err != nil {
		return result, err
	}
	result.Projects = projects
	return result, nil
}

// maxRateLimitRetries: Groq's on-demand tier caps tokens per minute and says how long to wait
// ("Please try again in 4.14s"). A batch pipeline should wait as told, not fail the page.
const maxRateLimitRetries = 4

var retryAfterRe = regexp.MustCompile(`try again in ([0-9.]+)s`)

func (e *GroqInfraExtractor) complete(ctx context.Context, user string) (string, error) {
	for attempt := 0; ; attempt++ {
		content, err := e.completeOnce(ctx, user)
		wait, limited := rateLimitWait(err)
		if !limited || attempt >= maxRateLimitRetries {
			return content, err
		}
		t := time.NewTimer(wait)
		select {
		case <-ctx.Done():
			t.Stop()
			return "", ctx.Err()
		case <-t.C:
		}
	}
}

// rateLimitWait reports whether err is a Groq rate-limit error and how long to wait before retrying.
func rateLimitWait(err error) (time.Duration, bool) {
	if err == nil || !strings.Contains(err.Error(), "Rate limit reached") {
		return 0, false
	}
	wait := 10 * time.Second
	if m := retryAfterRe.FindStringSubmatch(err.Error()); m != nil {
		if secs, perr := strconv.ParseFloat(m[1], 64); perr == nil {
			wait = time.Duration(secs*float64(time.Second)) + 500*time.Millisecond
		}
	}
	return wait, true
}

func (e *GroqInfraExtractor) completeOnce(ctx context.Context, user string) (string, error) {
	body, err := json.Marshal(groqChatRequest{
		Model: e.model,
		Messages: []groqChatMessage{
			{Role: "system", Content: infraExtractionSystemPrompt},
			{Role: "user", Content: user},
		},
		ResponseFormat: groqResponseFormat{Type: "json_object"},
		Temperature:    0, // extraction, not generation
	})
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, e.endpoint, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+e.apiKey)

	resp, err := e.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	var chat groqChatResponse
	if err := json.Unmarshal(raw, &chat); err != nil {
		return "", fmt.Errorf("parsing groq response: %w (HTTP %d)", err, resp.StatusCode)
	}
	if chat.Error != nil {
		return "", fmt.Errorf("groq API error: %s", chat.Error.Message)
	}
	if len(chat.Choices) == 0 {
		return "", fmt.Errorf("groq returned no choices (HTTP %d)", resp.StatusCode)
	}
	return chat.Choices[0].Message.Content, nil
}

// ParseInfraExtraction converts the model's JSON into pipeline types. Exported for tests and for
// re-parsing stored responses.
func ParseInfraExtraction(content string) ([]infrapipeline.ExtractedProject, error) {
	var w wireExtraction
	if err := json.Unmarshal([]byte(content), &w); err != nil {
		return nil, fmt.Errorf("parsing infra extraction: %w", err)
	}
	out := make([]infrapipeline.ExtractedProject, 0, len(w.Projects))
	for _, p := range w.Projects {
		status := toField(p.Status, normalizeStatus)
		if status.Value != nil && *status.Value == "" {
			status = infrapipeline.Field[string]{} // label outside the allowed set: treat as not stated
		}
		out = append(out, infrapipeline.ExtractedProject{
			Name:               strings.TrimSpace(p.Name),
			NameEvidence:       p.NameEvidence,
			Kind:               normalizeKind(p.Kind),
			Status:             status,
			ExpectedCompletion: toField(p.ExpectedCompletion, strings.TrimSpace),
			LengthKm:           toField(p.LengthKm, func(v float64) float64 { return v }),
			Stations:           toPlaces(p.Stations),
			Localities:         toPlaces(p.Localities),
		})
	}
	return out, nil
}

func toField[T any](w wireField[T], clean func(T) T) infrapipeline.Field[T] {
	if w.Value == nil || w.Evidence == nil {
		return infrapipeline.Field[T]{} // a value without evidence is treated as not stated
	}
	v := clean(*w.Value)
	return infrapipeline.Field[T]{Value: &v, Evidence: *w.Evidence}
}

func toPlaces(ws []wirePlace) []infrapipeline.NamedPlace {
	out := make([]infrapipeline.NamedPlace, 0, len(ws))
	for _, w := range ws {
		if strings.TrimSpace(w.Name) != "" {
			out = append(out, infrapipeline.NamedPlace{Name: strings.TrimSpace(w.Name), Evidence: w.Evidence})
		}
	}
	return out
}

func normalizeKind(k string) string {
	switch k = strings.ToLower(strings.TrimSpace(k)); k {
	case "metro", "suburban_rail", "highway", "road", "airport":
		return k
	}
	return "other"
}

func normalizeStatus(s string) string {
	switch s = strings.ToLower(strings.TrimSpace(s)); s {
	case "planned", "under_construction", "partially_operational", "operational":
		return s
	}
	return "" // unknown label: ParseInfraExtraction treats "" as not stated
}

var hrefRe = regexp.MustCompile(`(?i)<a\s[^>]*href\s*=\s*["']([^"']+)["']`)

// projectPathHint marks same-site links that look like individual project pages (e.g. MMRDA's
// /en/projects/transport/metro-line-12/overview). Tuned per agency as sources are added.
var projectPathHint = regexp.MustCompile(`(?i)/projects?/`)

// DiscoverProjectLinks returns same-host links on an index page that look like project pages,
// de-duplicated, as project_page sources. Deterministic: parsed from HTML, never from the LLM.
func DiscoverProjectLinks(pageURL string, raw []byte) []infrapipeline.DiscoveredSource {
	base, err := url.Parse(pageURL)
	if err != nil || len(raw) == 0 {
		return nil
	}
	seen := map[string]bool{}
	var out []infrapipeline.DiscoveredSource
	for _, m := range hrefRe.FindAllSubmatch(raw, -1) {
		ref, err := url.Parse(strings.TrimSpace(string(m[1])))
		if err != nil {
			continue
		}
		abs := base.ResolveReference(ref)
		abs.RawQuery, abs.Fragment = "", ""
		if abs.Host != base.Host || !projectPathHint.MatchString(abs.Path) {
			continue
		}
		u := abs.String()
		if u == base.String() || seen[u] {
			continue
		}
		seen[u] = true
		out = append(out, infrapipeline.DiscoveredSource{URL: u, Kind: infrapipeline.SourceProjectPage})
	}
	return out
}
