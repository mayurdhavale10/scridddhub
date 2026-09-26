package handler

import (
	"encoding/json"
	"net/http"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
	"github.com/scridddhub/backend/internal/middleware"
	"github.com/scridddhub/backend/internal/usecase"
)

type RiskRegisterEntryHandler struct {
	usecase *usecase.RiskRegisterEntryUsecase
}

func NewRiskRegisterEntryHandler(u *usecase.RiskRegisterEntryUsecase) *RiskRegisterEntryHandler {
	return &RiskRegisterEntryHandler{usecase: u}
}

type upsertRiskRegisterEntryRequest struct {
	Category string `json:"category"`
	Status   string `json:"status"`
	Headline string `json:"headline"`
	Detail   string `json:"detail"`
}

type riskRegisterEntryResponse struct {
	ID        uuid.UUID `json:"id"`
	ProjectID uuid.UUID `json:"project_id"`
	Category  string    `json:"category"`
	Status    string    `json:"status"`
	Headline  string    `json:"headline"`
	Detail    string    `json:"detail"`
	CreatedAt string    `json:"created_at"`
	UpdatedAt string    `json:"updated_at"`
}

func toRiskRegisterEntryResponse(e *domain.RiskRegisterEntry) riskRegisterEntryResponse {
	return riskRegisterEntryResponse{
		ID:        e.ID,
		ProjectID: e.ProjectID,
		Category:  string(e.Category),
		Status:    string(e.Status),
		Headline:  e.Headline,
		Detail:    e.Detail,
		CreatedAt: e.CreatedAt.Format(timeFormat),
		UpdatedAt: e.UpdatedAt.Format(timeFormat),
	}
}

func (h *RiskRegisterEntryHandler) Upsert(w http.ResponseWriter, r *http.Request) {
	projectID, err := uuid.Parse(r.PathValue("projectID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	var req upsertRiskRegisterEntryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	entry := &domain.RiskRegisterEntry{
		ProjectID: projectID,
		Category:  domain.RiskCategory(req.Category),
		Status:    domain.RiskStatus(req.Status),
		Headline:  req.Headline,
		Detail:    req.Detail,
	}
	actor := middleware.ActorFromContext(r.Context())
	if err := h.usecase.Upsert(r.Context(), actor, entry); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, toRiskRegisterEntryResponse(entry))
}

func (h *RiskRegisterEntryHandler) ListByProject(w http.ResponseWriter, r *http.Request) {
	projectID, err := uuid.Parse(r.PathValue("projectID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	entries, err := h.usecase.ListByProject(r.Context(), projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	responses := make([]riskRegisterEntryResponse, 0, len(entries))
	for _, e := range entries {
		responses = append(responses, toRiskRegisterEntryResponse(e))
	}
	writeJSON(w, http.StatusOK, responses)
}
