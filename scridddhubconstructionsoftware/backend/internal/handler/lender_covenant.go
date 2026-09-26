package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
	"github.com/scridddhub/backend/internal/middleware"
	"github.com/scridddhub/backend/internal/usecase"
)

type LenderCovenantHandler struct {
	usecase *usecase.LenderCovenantUsecase
}

func NewLenderCovenantHandler(u *usecase.LenderCovenantUsecase) *LenderCovenantHandler {
	return &LenderCovenantHandler{usecase: u}
}

type upsertLenderCovenantRequest struct {
	DSCR                     float64   `json:"dscr"`
	DSCRCovenantMin          float64   `json:"dscr_covenant_min"`
	SecurityCoverRatio       float64   `json:"security_cover_ratio"`
	SecurityCoverCovenantMin float64   `json:"security_cover_covenant_min"`
	NextTPAReportDueAt       time.Time `json:"next_tpa_report_due_at"`
}

type lenderCovenantResponse struct {
	ID                       uuid.UUID `json:"id"`
	ProjectID                uuid.UUID `json:"project_id"`
	DSCR                     float64   `json:"dscr"`
	DSCRCovenantMin          float64   `json:"dscr_covenant_min"`
	DSCRBreached             bool      `json:"dscr_breached"`
	SecurityCoverRatio       float64   `json:"security_cover_ratio"`
	SecurityCoverCovenantMin float64   `json:"security_cover_covenant_min"`
	SecurityCoverBreached    bool      `json:"security_cover_breached"`
	AnyBreach                bool      `json:"any_breach"`
	NextTPAReportDueAt       time.Time `json:"next_tpa_report_due_at"`
	CreatedAt                string    `json:"created_at"`
	UpdatedAt                string    `json:"updated_at"`
}

func toLenderCovenantResponse(c *domain.LenderCovenant) lenderCovenantResponse {
	return lenderCovenantResponse{
		ID:                       c.ID,
		ProjectID:                c.ProjectID,
		DSCR:                     c.DSCR,
		DSCRCovenantMin:          c.DSCRCovenantMin,
		DSCRBreached:             c.DSCRBreached(),
		SecurityCoverRatio:       c.SecurityCoverRatio,
		SecurityCoverCovenantMin: c.SecurityCoverCovenantMin,
		SecurityCoverBreached:    c.SecurityCoverBreached(),
		AnyBreach:                c.AnyBreach(),
		NextTPAReportDueAt:       c.NextTPAReportDueAt,
		CreatedAt:                c.CreatedAt.Format(timeFormat),
		UpdatedAt:                c.UpdatedAt.Format(timeFormat),
	}
}

func (h *LenderCovenantHandler) Upsert(w http.ResponseWriter, r *http.Request) {
	projectID, err := uuid.Parse(r.PathValue("projectID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	var req upsertLenderCovenantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	covenant := &domain.LenderCovenant{
		ProjectID:                projectID,
		DSCR:                     req.DSCR,
		DSCRCovenantMin:          req.DSCRCovenantMin,
		SecurityCoverRatio:       req.SecurityCoverRatio,
		SecurityCoverCovenantMin: req.SecurityCoverCovenantMin,
		NextTPAReportDueAt:       req.NextTPAReportDueAt,
	}
	actor := middleware.ActorFromContext(r.Context())
	if err := h.usecase.Upsert(r.Context(), actor, covenant); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	writeJSON(w, http.StatusOK, toLenderCovenantResponse(covenant))
}

func (h *LenderCovenantHandler) Get(w http.ResponseWriter, r *http.Request) {
	projectID, err := uuid.Parse(r.PathValue("projectID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	covenant, err := h.usecase.GetByProject(r.Context(), projectID)
	if err != nil {
		writeNotFoundOrError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, toLenderCovenantResponse(covenant))
}
