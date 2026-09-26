// Package llm holds concrete AI-provider integrations. Nothing outside this package should
// import a provider SDK directly — usecase code depends only on the interfaces it defines
// itself (see internal/usecase/site_extractor.go), never on this package's types.
package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/scridddhub/backend/internal/usecase"
)

const groqChatCompletionsURL = "https://api.groq.com/openai/v1/chat/completions"

// GroqSiteExtractor implements usecase.SiteTextExtractor using Groq's OpenAI-compatible chat
// completions API. A cheap/fast model is the right tool here — this is narrow structured
// extraction, not open-ended reasoning (see the model-choice discussion this was built from).
type GroqSiteExtractor struct {
	apiKey string
	model  string
	client *http.Client
}

func NewGroqSiteExtractor(apiKey string) *GroqSiteExtractor {
	return &GroqSiteExtractor{
		apiKey: apiKey,
		model:  "openai/gpt-oss-20b",
		client: &http.Client{Timeout: 20 * time.Second},
	}
}

const extractionSystemPrompt = `You extract structured site characteristics from a developer's
free-text description of a construction project, for the sole purpose of determining which
government approvals apply (e.g. an Airport Authority Clearance only applies near an airport).
Do not infer or guess anything not stated or clearly implied by the text. Respond with ONLY a
JSON object matching exactly this shape, no other text:
{
  "near_airport": boolean,
  "coastal_site": boolean,
  "significant_tree_cover": boolean,
  "uses_groundwater": boolean,
  "unit_count": integer (0 if not mentioned)
}`

type groqChatRequest struct {
	Model          string             `json:"model"`
	Messages       []groqChatMessage  `json:"messages"`
	ResponseFormat groqResponseFormat `json:"response_format"`
	Temperature    float64            `json:"temperature"`
}

type groqChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type groqResponseFormat struct {
	Type string `json:"type"`
}

type groqChatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

type extractedFields struct {
	NearAirport          bool `json:"near_airport"`
	CoastalSite          bool `json:"coastal_site"`
	SignificantTreeCover bool `json:"significant_tree_cover"`
	UsesGroundwater      bool `json:"uses_groundwater"`
	UnitCount            int  `json:"unit_count"`
}

func (e *GroqSiteExtractor) Extract(ctx context.Context, freeText string) (usecase.SiteCharacteristics, error) {
	reqBody := groqChatRequest{
		Model: e.model,
		Messages: []groqChatMessage{
			{Role: "system", Content: extractionSystemPrompt},
			{Role: "user", Content: freeText},
		},
		ResponseFormat: groqResponseFormat{Type: "json_object"},
		Temperature:    0, // deterministic extraction, not creative generation
	}
	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return usecase.SiteCharacteristics{}, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, groqChatCompletionsURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return usecase.SiteCharacteristics{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+e.apiKey)

	resp, err := e.client.Do(req)
	if err != nil {
		return usecase.SiteCharacteristics{}, err
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return usecase.SiteCharacteristics{}, err
	}

	var chatResp groqChatResponse
	if err := json.Unmarshal(respBytes, &chatResp); err != nil {
		return usecase.SiteCharacteristics{}, fmt.Errorf("parsing groq response: %w (body: %s)", err, respBytes)
	}
	if chatResp.Error != nil {
		return usecase.SiteCharacteristics{}, fmt.Errorf("groq API error: %s", chatResp.Error.Message)
	}
	if len(chatResp.Choices) == 0 {
		return usecase.SiteCharacteristics{}, fmt.Errorf("groq returned no choices (body: %s)", respBytes)
	}

	var fields extractedFields
	if err := json.Unmarshal([]byte(chatResp.Choices[0].Message.Content), &fields); err != nil {
		return usecase.SiteCharacteristics{}, fmt.Errorf("parsing extracted fields: %w (content: %s)", err, chatResp.Choices[0].Message.Content)
	}

	return usecase.SiteCharacteristics{
		NearAirport:          fields.NearAirport,
		CoastalSite:          fields.CoastalSite,
		SignificantTreeCover: fields.SignificantTreeCover,
		UsesGroundwater:      fields.UsesGroundwater,
		UnitCount:            fields.UnitCount,
	}, nil
}
