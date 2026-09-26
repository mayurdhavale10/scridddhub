package handler

import (
	"net/http"
	"strconv"

	"github.com/scridddhub/backend/internal/usecase"
)

// AILandEstimateHandler serves the LLM-based estimate. When the caller passes a real
// district/taluka/village, the usecase grounds the model in that village's Ready Reckoner rate
// (if one is on file); otherwise it works from location, area, source and notes alone (see
// ReadyReckonerRateHandler for the government-data-only path). Every response is unverified by construction; the
// handler doesn't add caveats itself because the usecase/domain type already carries them
// (Confidence, Reasoning) for the caller to render honestly.
type AILandEstimateHandler struct {
	usecase *usecase.AILandEstimateUsecase
}

func NewAILandEstimateHandler(u *usecase.AILandEstimateUsecase) *AILandEstimateHandler {
	return &AILandEstimateHandler{usecase: u}
}

type aiLandEstimateResponse struct {
	Location                   string  `json:"location"`
	AreaAcres                  float64 `json:"area_acres"`
	EstimatedRatePerAcreRupees int64   `json:"estimated_rate_per_acre_rupees"`
	EstimatedTotalValueRupees  int64   `json:"estimated_total_value_rupees"`
	Reasoning                  string  `json:"reasoning"`
	Confidence                 string  `json:"confidence"`
	Model                      string  `json:"model"`
	GeneratedAt                string  `json:"generated_at"`
	UsedReadyReckonerRate      bool    `json:"used_ready_reckoner_rate"`
}

func (h *AILandEstimateHandler) Estimate(w http.ResponseWriter, r *http.Request) {
	location := r.URL.Query().Get("location")
	if location == "" {
		writeError(w, http.StatusBadRequest, errMissingQuery("location"))
		return
	}
	areaStr := r.URL.Query().Get("area_acres")
	areaAcres, err := strconv.ParseFloat(areaStr, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, errMissingQuery("area_acres"))
		return
	}

	q := r.URL.Query()
	estimate, err := h.usecase.Estimate(r.Context(), usecase.AILandEstimateInput{
		Location:  location,
		AreaAcres: areaAcres,
		Source:    q.Get("source"),
		Notes:     q.Get("notes"),
		District:  q.Get("district"),
		Taluka:    q.Get("taluka"),
		Village:   q.Get("village"),
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	writeJSON(w, http.StatusOK, aiLandEstimateResponse{
		Location:                   estimate.Location,
		AreaAcres:                  estimate.AreaAcres,
		EstimatedRatePerAcreRupees: estimate.EstimatedRatePerAcre,
		EstimatedTotalValueRupees:  estimate.EstimatedTotalValueRupees,
		Reasoning:                  estimate.Reasoning,
		Confidence:                 estimate.Confidence,
		Model:                      estimate.Model,
		GeneratedAt:                estimate.GeneratedAt.Format("2006-01-02T15:04:05Z07:00"),
		UsedReadyReckonerRate:      estimate.UsedReadyReckonerRate,
	})
}
