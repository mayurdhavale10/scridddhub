package llm

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// groqVisionModel is the only vision model on our Groq key (checked 2026-10-08). It's in Preview,
// so it can be withdrawn; the research's fallbacks are Gemini Flash-Lite and Sarvam Vision.
const groqVisionModel = "qwen/qwen3.8-27b"

// groqVisionJSON sends one image with a system prompt and returns the model's JSON object text.
func groqVisionJSON(ctx context.Context, client *http.Client, apiKey, system, userText string, image []byte, mimeType string) (string, error) {
	dataURL := "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(image)
	body, err := json.Marshal(visionRequest{
		Model: groqVisionModel,
		Messages: []visionMessage{
			{Role: "system", Content: system},
			{Role: "user", Content: []visionContent{
				{Type: "text", Text: userText},
				{Type: "image_url", ImageURL: &visionImageURL{URL: dataURL}},
			}},
		},
		ResponseFormat: groqResponseFormat{Type: "json_object"},
		Temperature:    0,
	})
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, groqChatCompletionsURL, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)
	resp, err := client.Do(req)
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
		return "", fmt.Errorf("parsing groq response: %w", err)
	}
	if chat.Error != nil {
		return "", fmt.Errorf("groq API error: %s", chat.Error.Message)
	}
	if len(chat.Choices) == 0 {
		return "", fmt.Errorf("groq returned no choices")
	}
	content := strings.TrimSpace(chat.Choices[0].Message.Content)
	// Reasoning models sometimes wrap the JSON; keep the outermost object.
	if i, j := strings.Index(content, "{"), strings.LastIndex(content, "}"); i >= 0 && j > i {
		content = content[i : j+1]
	}
	return content, nil
}
