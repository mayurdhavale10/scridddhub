package handler

import (
	"encoding/json"
	"net/http"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
	"github.com/scridddhub/backend/internal/middleware"
	"github.com/scridddhub/backend/internal/usecase"
)

type FeasibilityAssessmentHandler struct {
	usecase *usecase.FeasibilityAssessmentUsecase
}

func NewFeasibilityAssessmentHandler(u *usecase.FeasibilityAssessmentUsecase) *FeasibilityAssessmentHandler {
	return &FeasibilityAssessmentHandler{usecase: u}
}

type upsertFeasibilityAssessmentRequest struct {
	CurrentValuationRupees int64      `json:"current_valuation_rupees"`
	FutureValuationRupees  int64      `json:"future_valuation_rupees"`
	FutureValuationYear    int16      `json:"future_valuation_year"`
	Verdict                string     `json:"verdict"`
	ComparedParcelID       *uuid.UUID `json:"compared_parcel_id"`
	MarginPct              *float64   `json:"margin_pct"`
	InfrastructureNote     string     `json:"infrastructure_note"`
	ComparableSalesNote    string     `json:"comparable_sales_note"`
}

type feasibilityAssessmentResponse struct {
	ID                     uuid.UUID  `json:"id"`
	LandParcelID           uuid.UUID  `json:"land_parcel_id"`
	CurrentValuationRupees int64      `json:"current_valuation_rupees"`
	FutureValuationRupees  int64      `json:"future_valuation_rupees"`
	FutureValuationYear    int16      `json:"future_valuation_year"`
	Verdict                string     `json:"verdict"`
	ComparedParcelID       *uuid.UUID `json:"compared_parcel_id"`
	MarginPct              *float64   `json:"margin_pct"`
	InfrastructureNote     string     `json:"infrastructure_note"`
	ComparableSalesNote    string     `json:"comparable_sales_note"`
	CreatedAt              string     `json:"created_at"`
	UpdatedAt              string     `json:"updated_at"`
}

func toFeasibilityAssessmentResponse(a *domain.FeasibilityAssessment) feasibilityAssessmentResponse {
	return feasibilityAssessmentResponse{
		ID:                     a.ID,
		LandParcelID:           a.LandParcelID,
		CurrentValuationRupees: a.CurrentValuationRupees,
		FutureValuationRupees:  a.FutureValuationRupees,
		FutureValuationYear:    a.FutureValuationYear,
		Verdict:                a.Verdict,
		ComparedParcelID:       a.ComparedParcelID,
		MarginPct:              a.MarginPct,
		InfrastructureNote:     a.InfrastructureNote,
		ComparableSalesNote:    a.ComparableSalesNote,
		CreatedAt:              a.CreatedAt.Format(timeFormat),
		UpdatedAt:              a.UpdatedAt.Format(timeFormat),
	}
}

func (h *FeasibilityAssessmentHandler) Upsert(w http.ResponseWriter, r *http.Request) {
	landParcelID, err := uuid.Parse(r.PathValue("parcelID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	var req upsertFeasibilityAssessmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	assessment := &domain.FeasibilityAssessment{
		LandParcelID:           landParcelID,
		CurrentValuationRupees: req.CurrentValuationRupees,
		FutureValuationRupees:  req.FutureValuationRupees,
		FutureValuationYear:    req.FutureValuationYear,
		Verdict:                req.Verdict,
		ComparedParcelID:       req.ComparedParcelID,
		MarginPct:              req.MarginPct,
		InfrastructureNote:     req.InfrastructureNote,
		ComparableSalesNote:    req.ComparableSalesNote,
	}
	actor := middleware.ActorFromContext(r.Context())
	if err := h.usecase.Upsert(r.Context(), actor, assessment); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	writeJSON(w, http.StatusOK, toFeasibilityAssessmentResponse(assessment))
}

func (h *FeasibilityAssessmentHandler) Get(w http.ResponseWriter, r *http.Request) {
	landParcelID, err := uuid.Parse(r.PathValue("parcelID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	assessment, err := h.usecase.GetByLandParcel(r.Context(), landParcelID)
	if err != nil {
		writeNotFoundOrError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, toFeasibilityAssessmentResponse(assessment))
}
