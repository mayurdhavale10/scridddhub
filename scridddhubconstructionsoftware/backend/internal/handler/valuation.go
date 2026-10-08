package handler

import (
	"errors"
	"net/http"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
	"github.com/scridddhub/backend/internal/middleware"
	"github.com/scridddhub/backend/internal/usecase"
)

// ValuationHandler serves the Valuation Summary's "Assess" (services/valuationsummary/README.md).
// The result is the parcel's feasibility assessment, read back by the existing GET endpoint.
type ValuationHandler struct {
	usecase *usecase.ValuationUsecase
}

func NewValuationHandler(u *usecase.ValuationUsecase) *ValuationHandler {
	return &ValuationHandler{usecase: u}
}

// Assess: POST /land-parcels/{parcelID}/valuation — values any saved parcel and stores it.
// On demand only (each run is an AI call).
func (h *ValuationHandler) Assess(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("parcelID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	a, err := h.usecase.Assess(r.Context(), middleware.ActorFromContext(r.Context()), id)
	switch {
	case errors.Is(err, domain.ErrValuationNeedsArea):
		writeError(w, http.StatusUnprocessableEntity, err)
		return
	case err != nil:
		writeNotFoundOrError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toFeasibilityAssessmentResponse(a))
}
