package handler

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/scridddhub/backend/internal/domain"
	"github.com/scridddhub/backend/internal/usecase"
)

func errMissingQuery(fields string) error {
	return fmt.Errorf("%s query parameter(s) required", fields)
}

type ReadyReckonerRateHandler struct {
	usecase *usecase.EstimateParcelValueUsecase
}

func NewReadyReckonerRateHandler(u *usecase.EstimateParcelValueUsecase) *ReadyReckonerRateHandler {
	return &ReadyReckonerRateHandler{usecase: u}
}

type stringListResponse struct {
	Values []string `json:"values"`
}

// ListDistricts/ListTalukas/ListVillages were removed from here 2026-09-20 per docs/adr/0006 —
// see GeographyHandler (geography.go) for their replacement, backed by the real, complete
// Maharashtra village directory instead of just villages with a rate on file.

type locationValueEstimateResponse struct {
	District             string `json:"district"`
	Taluka               string `json:"taluka"`
	Village              string `json:"village"`
	ZoneNo               string `json:"zone_no"`
	RatePerSqmRupees     int64  `json:"rate_per_sqm_rupees"`
	EffectiveYear        string `json:"effective_year"`
	SourceURL            string `json:"source_url"`
	VerifiedAt           string `json:"verified_at"`
	AreaSqm              float64 `json:"area_sqm"`
	EstimatedValueRupees int64  `json:"estimated_value_rupees"`
}

func toLocationValueEstimateResponse(e *domain.LocationValueEstimate) locationValueEstimateResponse {
	return locationValueEstimateResponse{
		District:             e.District,
		Taluka:               e.Taluka,
		Village:              e.Village,
		ZoneNo:               e.ZoneNo,
		RatePerSqmRupees:     e.RatePerSqmRupees,
		EffectiveYear:        e.EffectiveYear,
		SourceURL:            e.SourceURL,
		VerifiedAt:           e.VerifiedAt.Format(timeFormat),
		AreaSqm:              e.AreaSqm,
		EstimatedValueRupees: e.EstimatedValueRupees,
	}
}

// Estimate is on-demand only (a person taps "Estimate Value" because they don't have a price
// yet) — standalone valuation from this location's own government-published rate, never a
// comparison against other parcels in this app. See docs/adr/0004.
func (h *ReadyReckonerRateHandler) Estimate(w http.ResponseWriter, r *http.Request) {
	district := r.URL.Query().Get("district")
	taluka := r.URL.Query().Get("taluka")
	village := r.URL.Query().Get("village")
	if district == "" || taluka == "" || village == "" {
		writeError(w, http.StatusBadRequest, errMissingQuery("district, taluka, and village"))
		return
	}
	areaAcres, err := strconv.ParseFloat(r.URL.Query().Get("area_acres"), 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	estimate, err := h.usecase.Estimate(r.Context(), district, taluka, village, areaAcres)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, fmt.Errorf(
				"no Ready Reckoner rate on file yet for %s, %s, %s", village, taluka, district))
			return
		}
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, toLocationValueEstimateResponse(estimate))
}
