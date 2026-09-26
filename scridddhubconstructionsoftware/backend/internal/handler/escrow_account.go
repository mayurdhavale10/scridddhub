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

type EscrowAccountHandler struct {
	usecase *usecase.EscrowAccountUsecase
}

func NewEscrowAccountHandler(u *usecase.EscrowAccountUsecase) *EscrowAccountHandler {
	return &EscrowAccountHandler{usecase: u}
}

type updateDeveloperLedgerRequest struct {
	BalanceRupees int64 `json:"balance_rupees"`
}

type updateBankFeedRequest struct {
	BalanceRupees int64  `json:"balance_rupees"`
	SourceName    string `json:"source_name"`
}

type escrowAccountResponse struct {
	ID                           uuid.UUID  `json:"id"`
	ProjectID                    uuid.UUID  `json:"project_id"`
	BankBalanceRupees            *int64     `json:"bank_balance_rupees"`
	BankSourceName               string     `json:"bank_source_name"`
	BankSyncedAt                 *time.Time `json:"bank_synced_at"`
	DeveloperLedgerBalanceRupees *int64     `json:"developer_ledger_balance_rupees"`
	Mismatch                     bool       `json:"mismatch"`
	CreatedAt                    string     `json:"created_at"`
	UpdatedAt                    string     `json:"updated_at"`
}

func toEscrowAccountResponse(e *domain.EscrowAccount) escrowAccountResponse {
	return escrowAccountResponse{
		ID:                           e.ID,
		ProjectID:                    e.ProjectID,
		BankBalanceRupees:            e.BankBalanceRupees,
		BankSourceName:               e.BankSourceName,
		BankSyncedAt:                 e.BankSyncedAt,
		DeveloperLedgerBalanceRupees: e.DeveloperLedgerBalanceRupees,
		Mismatch:                     e.Mismatch(),
		CreatedAt:                    e.CreatedAt.Format(timeFormat),
		UpdatedAt:                    e.UpdatedAt.Format(timeFormat),
	}
}

// UpdateDeveloperLedger is the only escrow write reachable from the mobile app — the developer's
// own self-reported figure. See migration 000011's comment for why this is a separate endpoint
// from the bank feed, not a general-purpose PUT.
func (h *EscrowAccountHandler) UpdateDeveloperLedger(w http.ResponseWriter, r *http.Request) {
	projectID, err := uuid.Parse(r.PathValue("projectID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	var req updateDeveloperLedgerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	actor := middleware.ActorFromContext(r.Context())
	account, err := h.usecase.UpdateDeveloperLedger(r.Context(), actor, projectID, req.BalanceRupees)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	writeJSON(w, http.StatusOK, toEscrowAccountResponse(account))
}

// UpdateBankFeed exists for a real bank statement-fetch integration to call (a scheduled job or
// webhook) — deliberately NOT wired to any mobile-app UI action. Exposed as a real HTTP endpoint
// now (rather than left unbuilt) so the write path and its distinct "bank-integration" audit
// actor exist before the actual bank integration does.
func (h *EscrowAccountHandler) UpdateBankFeed(w http.ResponseWriter, r *http.Request) {
	projectID, err := uuid.Parse(r.PathValue("projectID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	var req updateBankFeedRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	account, err := h.usecase.UpdateBankFeed(r.Context(), projectID, req.BalanceRupees, req.SourceName, time.Now())
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	writeJSON(w, http.StatusOK, toEscrowAccountResponse(account))
}

func (h *EscrowAccountHandler) Get(w http.ResponseWriter, r *http.Request) {
	projectID, err := uuid.Parse(r.PathValue("projectID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	account, err := h.usecase.GetByProject(r.Context(), projectID)
	if err != nil {
		writeNotFoundOrError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, toEscrowAccountResponse(account))
}
