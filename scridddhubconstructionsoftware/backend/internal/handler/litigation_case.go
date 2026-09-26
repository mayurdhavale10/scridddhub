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

type LitigationCaseHandler struct {
	usecase *usecase.LitigationCaseUsecase
}

func NewLitigationCaseHandler(u *usecase.LitigationCaseUsecase) *LitigationCaseHandler {
	return &LitigationCaseHandler{usecase: u}
}

type createLitigationCaseRequest struct {
	ProjectID           *uuid.UUID `json:"project_id"`
	CaseType            string     `json:"case_type"`
	CounterpartyType    string     `json:"counterparty_type"`
	CounterpartyName    *string    `json:"counterparty_name"`
	Forum               string     `json:"forum"`
	Subject             string     `json:"subject"`
	NextHearingAt       *time.Time `json:"next_hearing_at"`
	ClaimedAmountRupees *int64     `json:"claimed_amount_rupees"`
}

type updateLitigationCaseStatusRequest struct {
	Status         string  `json:"status"`
	ResolutionNote *string `json:"resolution_note"`
}

type litigationCaseResponse struct {
	ID                  uuid.UUID  `json:"id"`
	OrgID               uuid.UUID  `json:"org_id"`
	ProjectID           *uuid.UUID `json:"project_id"`
	CaseType            string     `json:"case_type"`
	CounterpartyType    string     `json:"counterparty_type"`
	CounterpartyName    *string    `json:"counterparty_name"`
	Forum               string     `json:"forum"`
	Subject             string     `json:"subject"`
	Status              string     `json:"status"`
	NextHearingAt       *time.Time `json:"next_hearing_at"`
	ClaimedAmountRupees *int64     `json:"claimed_amount_rupees"`
	ResolutionNote      *string    `json:"resolution_note"`
	CreatedAt           string     `json:"created_at"`
	UpdatedAt           string     `json:"updated_at"`
}

func toLitigationCaseResponse(c *domain.LitigationCase) litigationCaseResponse {
	return litigationCaseResponse{
		ID:                  c.ID,
		OrgID:               c.OrgID,
		ProjectID:           c.ProjectID,
		CaseType:            string(c.CaseType),
		CounterpartyType:    string(c.CounterpartyType),
		CounterpartyName:    c.CounterpartyName,
		Forum:               c.Forum,
		Subject:             c.Subject,
		Status:              string(c.Status),
		NextHearingAt:       c.NextHearingAt,
		ClaimedAmountRupees: c.ClaimedAmountRupees,
		ResolutionNote:      c.ResolutionNote,
		CreatedAt:           c.CreatedAt.Format(timeFormat),
		UpdatedAt:           c.UpdatedAt.Format(timeFormat),
	}
}

func (h *LitigationCaseHandler) Create(w http.ResponseWriter, r *http.Request) {
	orgID, err := uuid.Parse(r.PathValue("orgID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	var req createLitigationCaseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	c := &domain.LitigationCase{
		OrgID:               orgID,
		ProjectID:           req.ProjectID,
		CaseType:            domain.LitigationCaseType(req.CaseType),
		CounterpartyType:    domain.LitigationCounterpartyType(req.CounterpartyType),
		CounterpartyName:    req.CounterpartyName,
		Forum:               req.Forum,
		Subject:             req.Subject,
		NextHearingAt:       req.NextHearingAt,
		ClaimedAmountRupees: req.ClaimedAmountRupees,
	}
	actor := middleware.ActorFromContext(r.Context())
	if err := h.usecase.Create(r.Context(), actor, c); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusCreated, toLitigationCaseResponse(c))
}

func (h *LitigationCaseHandler) ListByOrg(w http.ResponseWriter, r *http.Request) {
	orgID, err := uuid.Parse(r.PathValue("orgID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	cases, err := h.usecase.ListByOrg(r.Context(), orgID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	responses := make([]litigationCaseResponse, 0, len(cases))
	for _, c := range cases {
		responses = append(responses, toLitigationCaseResponse(c))
	}
	writeJSON(w, http.StatusOK, responses)
}

func (h *LitigationCaseHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("caseID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	var req updateLitigationCaseStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	actor := middleware.ActorFromContext(r.Context())
	c, err := h.usecase.UpdateStatus(r.Context(), actor, id, domain.LitigationCaseStatus(req.Status), req.ResolutionNote)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, toLitigationCaseResponse(c))
}
