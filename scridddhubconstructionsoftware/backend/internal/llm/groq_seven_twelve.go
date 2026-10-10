package llm

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/scridddhub/backend/internal/domain"
	"github.com/scridddhub/backend/internal/usecase"
)

// GroqSevenTwelveReader implements usecase.SevenTwelveReader: it reads a photo of a Maharashtra
// 7/12 extract with a vision model and returns a draft for a person to check field by field.
// Field labels and traps come from the 2020 GR on the 7/12 format (services/duediligencereport/
// README.md). Areas are returned as written and parsed in Go, never converted by the model.
type GroqSevenTwelveReader struct {
	apiKey string
	model  string
	client *http.Client
}

func NewGroqSevenTwelveReader(apiKey string) *GroqSevenTwelveReader {
	return &GroqSevenTwelveReader{apiKey: apiKey, client: &http.Client{Timeout: 90 * time.Second}}
}

var _ usecase.SevenTwelveReader = (*GroqSevenTwelveReader)(nil)

const sevenTwelveSystemPrompt = `You read a photo of a Maharashtra 7/12 extract (सातबारा उतारा, गाव नमुना
सात व बारा). Copy what is written; never guess. If a field can't be read, leave it empty and say
so in "notes". Names stay in the script they're written in (usually Marathi).

Where things are:
- Header: गाव (village), तालुका (taluka), जिल्हा (district).
- भूमापन क्रमांक / गट क्रमांक and उपविभाग / पोट हिस्सा: survey or gat number with hissa, e.g. "45/2/अ".
- भूधारणा पद्धती: tenure. भोगवटादार वर्ग-1 = "class_1", भोगवटादार वर्ग-2 = "class_2",
  शासकीय पट्टेदार = "govt_lease". Empty if not readable.
- Area (लागवड योग्य क्षेत्र, एकूण) in हे.आर.चौ.मी. Copy it exactly, e.g. "1.23.45". Do NOT convert it.
- पोट खराबा: uncultivable area, copied as written.
- भोगवटादाराचे नाव: holders. For each, the name, their area if shown, and the mutation (फेरफार)
  number next to the name (often in a circle or brackets).
- A name inside brackets (कंस) and/or struck through is a FORMER holder: set "former": true.
- Names listed under प्रलंबित फेरफार are pending, not holders: put them in pending_mutations.
- कुळाचे नाव / खंड: tenant. Copy it into "tenants" if anything is written.
- इतर हक्क: other rights. Each entry separately (bank charge बोजा, acquisition संपादन, restrictions,
  wells, tenancy).
- शेवटचा फेरफार क्रमांक व दिनांक: last mutation number and date.
- If form 12 is replaced by a note that it isn't needed (गाव नमुना नंबर-12ची आवश्यकता नाही), the land
  is NA: set "is_na": true.
- "digitally_signed": true only if you see a QR code or a 16-digit verification number.

Respond with ONLY this JSON:
{"district": "", "taluka": "", "village": "", "survey_number": "", "tenure": "",
 "total_area_hr": "", "pot_kharaba": "",
 "owners": [{"name": "", "area_hr": "", "mutation_no": "", "former": false}],
 "tenants": "", "other_rights": [""], "pending_mutations": [""], "last_mutation": "",
 "is_na": false, "digitally_signed": false, "notes": ""}`

type visionContent struct {
	Type     string          `json:"type"`
	Text     string          `json:"text,omitempty"`
	ImageURL *visionImageURL `json:"image_url,omitempty"`
}

type visionImageURL struct {
	URL string `json:"url"`
}

type visionMessage struct {
	Role    string `json:"role"`
	Content any    `json:"content"`
}

type visionRequest struct {
	Model          string             `json:"model"`
	Messages       []visionMessage    `json:"messages"`
	ResponseFormat groqResponseFormat `json:"response_format"`
	Temperature    float64            `json:"temperature"`
}

func (g *GroqSevenTwelveReader) ReadSevenTwelve(ctx context.Context, image []byte, mimeType string) (*domain.SevenTwelve, string, error) {
	content, err := groqVisionJSON(ctx, g.client, g.apiKey, sevenTwelveSystemPrompt, "Read this 7/12 extract.", image, mimeType)
	if err != nil {
		return nil, "", err
	}
	var s domain.SevenTwelve
	if err := json.Unmarshal([]byte(content), &s); err != nil {
		return nil, "", fmt.Errorf("parsing 7/12 fields: %w", err)
	}
	s.OtherRights = nonEmpty(s.OtherRights)
	s.PendingMutations = nonEmpty(s.PendingMutations)
	return &s, groqVisionModel, nil
}

func nonEmpty(in []string) []string {
	out := []string{}
	for _, v := range in {
		if strings.TrimSpace(v) != "" {
			out = append(out, strings.TrimSpace(v))
		}
	}
	return out
}
