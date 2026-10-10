package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/scridddhub/backend/internal/middleware"
	"github.com/scridddhub/backend/internal/usecase"
)

type RegisteredSaleEntryHandler struct {
	usecase *usecase.RegisteredSaleEntryUsecase
}

func NewRegisteredSaleEntryHandler(u *usecase.RegisteredSaleEntryUsecase) *RegisteredSaleEntryHandler {
	return &RegisteredSaleEntryHandler{usecase: u}
}

type manualSaleRequest struct {
	District              string  `json:"district"`
	Taluka                string  `json:"taluka"`
	Village               string  `json:"village"`
	SurveyNo              string  `json:"survey_no"`
	RegistrationDate      string  `json:"registration_date"` // YYYY-MM-DD
	DocumentNo            string  `json:"document_no"`
	OfficeName            string  `json:"office_name"`
	PropertyType          string  `json:"property_type"`
	AreaAcres             float64 `json:"area_acres"`
	SalePriceRupees       int64   `json:"sale_price_rupees"`
	GovernmentValueRupees *int64  `json:"government_value_rupees"`
	Comparable            bool    `json:"comparable"`
	ExclusionReason       string  `json:"exclusion_reason"`
	Notes                 string  `json:"notes"`
}

// Record handles POST /registered-transactions: one land sale typed from an Index-II copy.
func (h *RegisteredSaleEntryHandler) Record(w http.ResponseWriter, r *http.Request) {
	var req manualSaleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	date, err := time.Parse("2006-01-02", req.RegistrationDate)
	if err != nil {
		writeError(w, http.StatusBadRequest, errMissingQuery("registration_date as YYYY-MM-DD"))
		return
	}
	err = h.usecase.Record(r.Context(), middleware.ActorFromContext(r.Context()), usecase.ManualSale{
		District: req.District, Taluka: req.Taluka, Village: req.Village, SurveyNo: req.SurveyNo,
		RegistrationDate: date, DocumentNo: req.DocumentNo, OfficeName: req.OfficeName,
		PropertyType: req.PropertyType, AreaAcres: req.AreaAcres, SalePriceRupees: req.SalePriceRupees,
		GovernmentValueRupees: req.GovernmentValueRupees, Comparable: req.Comparable,
		ExclusionReason: req.ExclusionReason, Notes: req.Notes,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	w.WriteHeader(http.StatusCreated)
	w.Write([]byte(`{"status":"recorded"}`))
}
