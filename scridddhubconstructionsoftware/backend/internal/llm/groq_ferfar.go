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

// GroqFerfarReader implements usecase.FerfarReader: it reads a photo of mutation register entries
// (फेरफार, village form 6) into a draft for a person to check entry by entry. Labels are from the
// research note on the 7/12 and Ferfar formats; they still need checking against a real register.
type GroqFerfarReader struct {
	apiKey string
	client *http.Client
}

func NewGroqFerfarReader(apiKey string) *GroqFerfarReader {
	return &GroqFerfarReader{apiKey: apiKey, client: &http.Client{Timeout: 90 * time.Second}}
}

var _ usecase.FerfarReader = (*GroqFerfarReader)(nil)

const ferfarSystemPrompt = `You read a photo of Maharashtra mutation register entries (फेरफार नोंदवही,
गाव नमुना सहा). Copy what is written; never guess. If something can't be read, leave it empty and say
so in "notes". Names stay in the script they're written in (usually Marathi).

For each entry:
- "raw_text": the nature-of-right column (संपादन केलेल्या अधिकाराचे स्वरूप) copied EXACTLY, word for word,
  in Marathi. This matters most: the entry's type is decided from these words.
- "number": फेरफार क्रमांक (entry number).
- "date": दिनांक, as dd/mm/yyyy.
- "type": the nature of the right acquired (संपादन केलेल्या अधिकाराचे स्वरूप), one of:
  "sale" (खरेदी), "inheritance" (वारस), "gift" (बक्षीस), "partition" (वाटप),
  "charge" (बोजा / कर्ज, a bank loan on the land), "charge_released" (बोजा कमी / कर्ज फेड),
  "na" (बिनशेती / NA order), "court_order" (न्यायालय आदेश), "acquisition" (भूसंपादन), "other".
- "from": whose right ended (seller, giver, the DECEASED holder for an inheritance, the borrower).
  "to": whose right began (buyer, receiver, the HEIRS for an inheritance, the bank for a charge).
  Never put a deceased person (मयत) in "to". Several names: separate with commas.
- "survey_numbers": the survey/gat numbers affected (परिणाम झालेले भूमापन क्रमांक).
- "status": "certified" (प्रमाणित / मंजूर), "pending" (प्रलंबित), "rejected" (नामंजूर / रद्द), or "".
- "remarks": the order's short wording if useful.

Respond with ONLY this JSON:
{"entries": [{"raw_text": "", "number": "", "date": "", "type": "", "from": "", "to": "",
 "survey_numbers": "", "status": "", "remarks": ""}], "notes": ""}`

func (g *GroqFerfarReader) ReadFerfar(ctx context.Context, image []byte, mimeType string) (*domain.MutationRegister, string, error) {
	content, err := groqVisionJSON(ctx, g.client, g.apiKey, ferfarSystemPrompt, "Read these mutation entries.", image, mimeType)
	if err != nil {
		return nil, "", err
	}
	var m domain.MutationRegister
	if err := json.Unmarshal([]byte(content), &m); err != nil {
		return nil, "", fmt.Errorf("parsing mutation entries: %w", err)
	}
	kept := m.Entries[:0]
	for _, e := range m.Entries {
		if strings.TrimSpace(e.Number) == "" && strings.TrimSpace(e.To) == "" {
			continue
		}
		// The written words decide the type; the model's own guess is kept only when no known
		// word appears.
		if kind, ok := domain.ClassifyMutationText(e.RawText); ok {
			e.Type = kind
		} else if domain.MutationTypeLabel(e.Type) == "Other" && e.Type != domain.MutationOther {
			e.Type = domain.MutationOther
		}
		kept = append(kept, e)
	}
	m.Entries = kept
	return &m, groqVisionModel, nil
}
