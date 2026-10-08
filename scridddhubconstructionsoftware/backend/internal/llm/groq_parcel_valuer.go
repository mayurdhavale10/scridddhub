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

// GroqParcelValuer implements usecase.ParcelValuer for the Valuation Summary. Same model as the
// Estimate Value estimator (GroqLandEstimator), but it is given the parcel's nearby planned
// projects, existing places and registered sales, and answers with per-acre RANGES today and in
// a fixed horizon. Totals, the comparison with the asking price and the verdict are computed in
// code (domain.BuildValuation); the model never sees the asking price.
type GroqParcelValuer struct {
	apiKey string
	model  string
	client *http.Client
}

func NewGroqParcelValuer(apiKey string) *GroqParcelValuer {
	return &GroqParcelValuer{apiKey: apiKey, model: "openai/gpt-oss-120b", client: &http.Client{Timeout: 45 * time.Second}}
}

var _ usecase.ParcelValuer = (*GroqParcelValuer)(nil)

const parcelValuationSystemPrompt = `You estimate the market value of a plot of land in Maharashtra,
India, for a land-buying product: a per-acre rate RANGE today, and a per-acre rate RANGE after the
given number of years. This is an estimate, not a formal valuation.

You are given some or all of:
- Location (free text), and the village/taluka/district when known.
- Area in acres.
- Government Ready Reckoner rate: the legal floor value for stamp duty, not a market price. Market
  rates in developing areas are often several times higher. Today's low estimate should normally
  not be below it.
- Registered sales nearby: count, period and median rate per acre of real recorded land sales. When
  present, this is the strongest evidence of today's value — stay close to it unless you explain
  why not.
- Nearby infrastructure: planned projects (with status, expected completion, distance) and places
  already there (stations, highways, schools, hospitals, industrial areas, and hazards such as
  landfills, sewage plants and power lines). Hazards lower value; operational access raises today's
  value; projects completing within the horizon justify future growth.

Rules:
- Use only the facts given plus general knowledge of the region. Do not invent projects.
- "uplift_drivers": up to 3 short phrases, each naming one GIVEN planned project exactly as given
  (for example "Metro Line 12 (7.1 km, in progress)"). Empty if no given project drives growth.
- Ranges must be honest: wider when evidence is thin (no sales, no Ready Reckoner rate).
- Future rates include general appreciation plus project effects; they may equal today's rates.
- "reasoning": 2-4 sentences on what drove the numbers, mentioning which inputs were available.

Respond with ONLY this JSON, numbers in Indian Rupees per acre:
{
  "current_rate_per_acre": {"low": number, "likely": number, "high": number},
  "future_rate_per_acre": {"low": number, "likely": number, "high": number},
  "uplift_drivers": [string],
  "reasoning": string
}`

type valuationRange struct {
	Low    float64 `json:"low"`
	Likely float64 `json:"likely"`
	High   float64 `json:"high"`
}

type valuationFields struct {
	Current       valuationRange `json:"current_rate_per_acre"`
	Future        valuationRange `json:"future_rate_per_acre"`
	UpliftDrivers []string       `json:"uplift_drivers"`
	Reasoning     string         `json:"reasoning"`
}

func valuationUserMessage(in usecase.ParcelValuationRequest) string {
	var b strings.Builder
	fmt.Fprintf(&b, "Location: %s\n", in.Location)
	if in.Village != "" {
		fmt.Fprintf(&b, "Village: %s, %s taluka, %s district\n", in.Village, in.Taluka, in.District)
	}
	fmt.Fprintf(&b, "Area: %.2f acres\nCurrent date: %s\nHorizon: %d years (estimate value in %d)\n",
		in.AreaAcres, in.AsOf.Format("2006-01-02"), in.HorizonYears, in.AsOf.Year()+in.HorizonYears)
	if rr := in.ReadyReckoner; rr != nil {
		fmt.Fprintf(&b, "Government Ready Reckoner rate: Rs %d per sq m (about Rs %d per acre), effective %s\n",
			rr.RatePerSqmRupees, int64(float64(rr.RatePerSqmRupees)*domain.SqmPerAcre), rr.EffectiveYear)
	} else {
		b.WriteString("Government Ready Reckoner rate: not on file\n")
	}
	if in.SalesCount > 0 && in.SalesMedian != nil {
		fmt.Fprintf(&b, "Registered sales nearby: %d in the last %d months, median Rs %.0f per acre\n",
			in.SalesCount, in.SalesMonths, *in.SalesMedian)
	} else {
		b.WriteString("Registered sales nearby: none on record\n")
	}
	if len(in.Infrastructure) == 0 {
		b.WriteString("Nearby infrastructure: none known\n")
	} else {
		b.WriteString("Nearby infrastructure:\n")
		for _, x := range in.Infrastructure {
			dist := "distance unknown (serves the area)"
			if x.DistanceKm != nil {
				dist = fmt.Sprintf("%.1f km", *x.DistanceKm)
			}
			if x.Planned {
				status := x.Status
				if x.Completion != "" {
					status += ", expected " + x.Completion
				}
				fmt.Fprintf(&b, "- PLANNED %s (%s, %s): %s, %s\n", x.Name, x.Kind, x.Category, status, dist)
			} else {
				fmt.Fprintf(&b, "- EXISTING %s (%s, %s): %s\n", x.Name, x.Kind, x.Category, dist)
			}
		}
	}
	return b.String()
}

func (v *GroqParcelValuer) Value(ctx context.Context, in usecase.ParcelValuationRequest) (domain.ValuationDraft, string, error) {
	body, err := json.Marshal(groqEstimateRequest{
		Model: v.model,
		Messages: []groqChatMessage{
			{Role: "system", Content: parcelValuationSystemPrompt},
			{Role: "user", Content: valuationUserMessage(in)},
		},
		ResponseFormat: groqResponseFormat{Type: "json_object"},
		Temperature:    0.2,
	})
	if err != nil {
		return domain.ValuationDraft{}, "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, groqChatCompletionsURL, bytes.NewReader(body))
	if err != nil {
		return domain.ValuationDraft{}, "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+v.apiKey)
	resp, err := v.client.Do(req)
	if err != nil {
		return domain.ValuationDraft{}, "", err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return domain.ValuationDraft{}, "", err
	}
	var chat groqChatResponse
	if err := json.Unmarshal(raw, &chat); err != nil {
		return domain.ValuationDraft{}, "", fmt.Errorf("parsing groq response: %w", err)
	}
	if chat.Error != nil {
		return domain.ValuationDraft{}, "", fmt.Errorf("groq API error: %s", chat.Error.Message)
	}
	if len(chat.Choices) == 0 {
		return domain.ValuationDraft{}, "", fmt.Errorf("groq returned no choices")
	}
	var f valuationFields
	if err := json.Unmarshal([]byte(chat.Choices[0].Message.Content), &f); err != nil {
		return domain.ValuationDraft{}, "", fmt.Errorf("parsing valuation: %w", err)
	}
	return domain.ValuationDraft{
		CurrentLowPerAcre: f.Current.Low, CurrentLikelyPerAcre: f.Current.Likely, CurrentHighPerAcre: f.Current.High,
		FutureLowPerAcre: f.Future.Low, FutureLikelyPerAcre: f.Future.Likely, FutureHighPerAcre: f.Future.High,
		UpliftDrivers: f.UpliftDrivers, Reasoning: f.Reasoning,
	}, v.model, nil
}
