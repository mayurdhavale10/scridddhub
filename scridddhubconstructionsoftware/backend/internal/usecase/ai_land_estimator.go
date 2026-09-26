package usecase

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/scridddhub/backend/internal/domain"
)

// AILandValueEstimate is a rough, UNVERIFIED land-value guess from an LLM. Never present this as
// equivalent to the government-data-backed path (EstimateParcelValueUsecase): it carries no
// government source, no verification, and Confidence is always "low" by construction — even when
// a real Ready Reckoner rate was given to the model as context (UsedReadyReckonerRate).
type AILandValueEstimate struct {
	Location                  string
	AreaAcres                 float64
	EstimatedRatePerAcre      int64
	EstimatedTotalValueRupees int64
	Reasoning                 string
	Confidence                string
	Model                     string
	GeneratedAt               time.Time
	UsedReadyReckonerRate     bool
}

// LandValueEstimateRequest is everything the model is given. ReadyReckoner is set only when the
// user picked a real village AND a government rate is on file for it — looked up server-side, never
// taken from the client, so the model can't be fed a forged "government" number.
type LandValueEstimateRequest struct {
	Location      string
	AreaAcres     float64
	Source        string
	Notes         string
	ReadyReckoner *domain.ReadyReckonerRate
	AsOf          time.Time
}

// LandValueEstimator is defined by this usecase (the consumer), implemented by internal/llm —
// swap the LLM provider without touching usecase logic (same pattern as SiteTextExtractor).
type LandValueEstimator interface {
	Estimate(ctx context.Context, req LandValueEstimateRequest) (AILandValueEstimate, error)
}

// AILandEstimateInput is what the caller supplies. District/Taluka/Village are optional and only
// meaningful together — present when the user picked a real village from the search.
type AILandEstimateInput struct {
	Location  string
	AreaAcres float64
	Source    string
	Notes     string
	District  string
	Taluka    string
	Village   string
}

// maxNotesLen bounds free-text notes sent to the model — enough for real context (road access,
// zoning, what a broker said), not an unbounded prompt.
const maxNotesLen = 1000

type AILandEstimateUsecase struct {
	estimator LandValueEstimator
	rates     ReadyReckonerRateRepository
}

func NewAILandEstimateUsecase(estimator LandValueEstimator, rates ReadyReckonerRateRepository) *AILandEstimateUsecase {
	return &AILandEstimateUsecase{estimator: estimator, rates: rates}
}

// Estimate always asks the LLM. For a real village it first checks the database for a Ready
// Reckoner rate and, if one exists, gives it to the model as a grounding floor; for a location
// that isn't in the geography data (or a village with no rate seeded yet — the common case) the
// model works from location, area, source and notes alone. Deliberately not accuracy-checked yet
// (docs/adr/0006); the point is a usable number while real market data is gathered separately.
func (u *AILandEstimateUsecase) Estimate(ctx context.Context, in AILandEstimateInput) (*AILandValueEstimate, error) {
	if in.Location == "" {
		return nil, fmt.Errorf("location is required")
	}
	if in.AreaAcres <= 0 {
		return nil, fmt.Errorf("area_acres must be positive")
	}
	notes := in.Notes
	if r := []rune(notes); len(r) > maxNotesLen {
		notes = string(r[:maxNotesLen])
	}

	req := LandValueEstimateRequest{
		Location:  in.Location,
		AreaAcres: in.AreaAcres,
		Source:    in.Source,
		Notes:     notes,
		AsOf:      time.Now(),
	}
	if in.District != "" && in.Taluka != "" && in.Village != "" {
		rate, err := u.rates.Get(ctx, in.District, in.Taluka, in.Village)
		switch {
		case err == nil:
			req.ReadyReckoner = rate
		case errors.Is(err, domain.ErrNotFound):
			// Real village, no rate seeded yet — estimate without one.
		default:
			return nil, fmt.Errorf("looking up ready reckoner rate: %w", err)
		}
	}

	estimate, err := u.estimator.Estimate(ctx, req)
	if err != nil {
		return nil, err
	}
	return &estimate, nil
}
