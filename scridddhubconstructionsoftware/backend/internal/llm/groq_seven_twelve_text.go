package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/scridddhub/backend/internal/domain"
	"github.com/scridddhub/backend/internal/usecase"
)

// GroqSevenTwelveTextReader implements usecase.SevenTwelveTextReader: it reads the TEXT of a 7/12
// page the user opened on Bhulekh inside the app (they type the captcha themselves; the app only
// takes the page's text once the record is on screen). Text is far more reliable than a photo.
type GroqSevenTwelveTextReader struct {
	apiKey string
	model  string
	client *http.Client
}

func NewGroqSevenTwelveTextReader(apiKey string) *GroqSevenTwelveTextReader {
	return &GroqSevenTwelveTextReader{apiKey: apiKey, model: "openai/gpt-oss-120b", client: &http.Client{Timeout: 60 * time.Second}}
}

var _ usecase.SevenTwelveTextReader = (*GroqSevenTwelveTextReader)(nil)

func (g *GroqSevenTwelveTextReader) ReadSevenTwelveText(ctx context.Context, text string) (*domain.SevenTwelve, string, error) {
	system := strings.Replace(sevenTwelveSystemPrompt,
		"You read a photo of a Maharashtra 7/12 extract",
		"You read the text of a Maharashtra 7/12 extract copied from the Bhulekh website (the page's words, possibly with menu text around them; ignore the menus)", 1)
	body, err := json.Marshal(groqEstimateRequest{
		Model: g.model,
		Messages: []groqChatMessage{
			{Role: "system", Content: system},
			{Role: "user", Content: text},
		},
		ResponseFormat: groqResponseFormat{Type: "json_object"},
		Temperature:    0,
	})
	if err != nil {
		return nil, "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, groqChatCompletionsURL, bytes.NewReader(body))
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+g.apiKey)
	resp, err := g.client.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", err
	}
	var chat groqChatResponse
	if err := json.Unmarshal(raw, &chat); err != nil {
		return nil, "", fmt.Errorf("parsing groq response: %w", err)
	}
	if chat.Error != nil {
		return nil, "", fmt.Errorf("groq API error: %s", chat.Error.Message)
	}
	if len(chat.Choices) == 0 {
		return nil, "", fmt.Errorf("groq returned no choices")
	}
	var s domain.SevenTwelve
	if err := json.Unmarshal([]byte(chat.Choices[0].Message.Content), &s); err != nil {
		return nil, "", fmt.Errorf("parsing 7/12 fields: %w", err)
	}
	s.OtherRights = nonEmpty(s.OtherRights)
	s.PendingMutations = nonEmpty(s.PendingMutations)
	// A Bhulekh view is never the signed copy; the site itself says it isn't for legal use.
	s.DigitallySigned = false
	return &s, g.model, nil
}
