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

type AccountingSyncHandler struct {
	usecase *usecase.AccountingSyncUsecase
}

func NewAccountingSyncHandler(u *usecase.AccountingSyncUsecase) *AccountingSyncHandler {
	return &AccountingSyncHandler{usecase: u}
}

type upsertAccountingSyncRequest struct {
	Connections              []domain.SystemConnection `json:"connections"`
	LastSyncAt               *time.Time                `json:"last_sync_at"`
	LastSyncVouchersPosted   *int                      `json:"last_sync_vouchers_posted"`
	LastSyncVouchersRejected *int                      `json:"last_sync_vouchers_rejected"`
}

type accountingSyncResponse struct {
	ID                       uuid.UUID                 `json:"id"`
	ProjectID                uuid.UUID                 `json:"project_id"`
	Connections              []domain.SystemConnection `json:"connections"`
	LastSyncAt               *time.Time                `json:"last_sync_at"`
	LastSyncVouchersPosted   *int                      `json:"last_sync_vouchers_posted"`
	LastSyncVouchersRejected *int                      `json:"last_sync_vouchers_rejected"`
	CreatedAt                string                    `json:"created_at"`
	UpdatedAt                string                    `json:"updated_at"`
}

func toAccountingSyncResponse(s *domain.AccountingSync) accountingSyncResponse {
	return accountingSyncResponse{
		ID:                       s.ID,
		ProjectID:                s.ProjectID,
		Connections:              s.Connections,
		LastSyncAt:               s.LastSyncAt,
		LastSyncVouchersPosted:   s.LastSyncVouchersPosted,
		LastSyncVouchersRejected: s.LastSyncVouchersRejected,
		CreatedAt:                s.CreatedAt.Format(timeFormat),
		UpdatedAt:                s.UpdatedAt.Format(timeFormat),
	}
}

func (h *AccountingSyncHandler) Upsert(w http.ResponseWriter, r *http.Request) {
	projectID, err := uuid.Parse(r.PathValue("projectID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	var req upsertAccountingSyncRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	sync := &domain.AccountingSync{
		ProjectID:                projectID,
		Connections:              req.Connections,
		LastSyncAt:               req.LastSyncAt,
		LastSyncVouchersPosted:   req.LastSyncVouchersPosted,
		LastSyncVouchersRejected: req.LastSyncVouchersRejected,
	}
	actor := middleware.ActorFromContext(r.Context())
	if err := h.usecase.Upsert(r.Context(), actor, sync); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	writeJSON(w, http.StatusOK, toAccountingSyncResponse(sync))
}

func (h *AccountingSyncHandler) Get(w http.ResponseWriter, r *http.Request) {
	projectID, err := uuid.Parse(r.PathValue("projectID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	sync, err := h.usecase.GetByProject(r.Context(), projectID)
	if err != nil {
		writeNotFoundOrError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, toAccountingSyncResponse(sync))
}
