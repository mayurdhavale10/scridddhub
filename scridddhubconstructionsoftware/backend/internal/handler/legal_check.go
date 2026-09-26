package handler

import (
	"encoding/json"
	"net/http"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
	"github.com/scridddhub/backend/internal/middleware"
	"github.com/scridddhub/backend/internal/usecase"
)

type LegalCheckHandler struct {
	usecase *usecase.LegalCheckUsecase
}

func NewLegalCheckHandler(u *usecase.LegalCheckUsecase) *LegalCheckHandler {
	return &LegalCheckHandler{usecase: u}
}

type upsertLegalCheckRequest struct {
	OwnershipRisk       domain.RiskLevel               `json:"ownership_risk"`
	OwnershipRiskNote   string                         `json:"ownership_risk_note"`
	LitigationRisk      domain.RiskLevel               `json:"litigation_risk"`
	LitigationRiskNote  string                         `json:"litigation_risk_note"`
	EncumbranceRisk     domain.RiskLevel               `json:"encumbrance_risk"`
	EncumbranceRiskNote string                         `json:"encumbrance_risk_note"`
	RegulatoryRisk      domain.RiskLevel               `json:"regulatory_risk"`
	RegulatoryRiskNote  string                         `json:"regulatory_risk_note"`
	OwnershipChain      []domain.OwnershipChainEntry   `json:"ownership_chain"`
	EncumbranceSearches []domain.EncumbranceSearchItem `json:"encumbrance_searches"`
	SearchSummaryNote   string                         `json:"search_summary_note"`
	RERAHistory         []domain.RERAHistoryEntry      `json:"rera_history"`
	RERAHistorySummary  string                         `json:"rera_history_summary_note"`
	Documents           []domain.LegalDocument         `json:"documents"`
	Status              domain.LegalCheckStatus        `json:"status"`
}

type legalCheckResponse struct {
	ID                  uuid.UUID                      `json:"id"`
	LandParcelID        uuid.UUID                      `json:"land_parcel_id"`
	OwnershipRisk       domain.RiskLevel               `json:"ownership_risk"`
	OwnershipRiskNote   string                         `json:"ownership_risk_note"`
	LitigationRisk      domain.RiskLevel               `json:"litigation_risk"`
	LitigationRiskNote  string                         `json:"litigation_risk_note"`
	EncumbranceRisk     domain.RiskLevel               `json:"encumbrance_risk"`
	EncumbranceRiskNote string                         `json:"encumbrance_risk_note"`
	RegulatoryRisk      domain.RiskLevel               `json:"regulatory_risk"`
	RegulatoryRiskNote  string                         `json:"regulatory_risk_note"`
	OwnershipChain      []domain.OwnershipChainEntry   `json:"ownership_chain"`
	EncumbranceSearches []domain.EncumbranceSearchItem `json:"encumbrance_searches"`
	SearchSummaryNote   string                         `json:"search_summary_note"`
	RERAHistory         []domain.RERAHistoryEntry      `json:"rera_history"`
	RERAHistorySummary  string                         `json:"rera_history_summary_note"`
	Documents           []domain.LegalDocument         `json:"documents"`
	Status              domain.LegalCheckStatus        `json:"status"`
	CreatedAt           string                         `json:"created_at"`
	UpdatedAt           string                         `json:"updated_at"`
}

func toLegalCheckResponse(c *domain.LegalCheck) legalCheckResponse {
	return legalCheckResponse{
		ID:                  c.ID,
		LandParcelID:        c.LandParcelID,
		OwnershipRisk:       c.OwnershipRisk,
		OwnershipRiskNote:   c.OwnershipRiskNote,
		LitigationRisk:      c.LitigationRisk,
		LitigationRiskNote:  c.LitigationRiskNote,
		EncumbranceRisk:     c.EncumbranceRisk,
		EncumbranceRiskNote: c.EncumbranceRiskNote,
		RegulatoryRisk:      c.RegulatoryRisk,
		RegulatoryRiskNote:  c.RegulatoryRiskNote,
		OwnershipChain:      c.OwnershipChain,
		EncumbranceSearches: c.EncumbranceSearches,
		SearchSummaryNote:   c.SearchSummaryNote,
		RERAHistory:         c.RERAHistory,
		RERAHistorySummary:  c.RERAHistorySummaryNote,
		Documents:           c.Documents,
		Status:              c.Status,
		CreatedAt:           c.CreatedAt.Format(timeFormat),
		UpdatedAt:           c.UpdatedAt.Format(timeFormat),
	}
}

func (h *LegalCheckHandler) Upsert(w http.ResponseWriter, r *http.Request) {
	landParcelID, err := uuid.Parse(r.PathValue("parcelID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	var req upsertLegalCheckRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	check := &domain.LegalCheck{
		LandParcelID:           landParcelID,
		OwnershipRisk:          req.OwnershipRisk,
		OwnershipRiskNote:      req.OwnershipRiskNote,
		LitigationRisk:         req.LitigationRisk,
		LitigationRiskNote:     req.LitigationRiskNote,
		EncumbranceRisk:        req.EncumbranceRisk,
		EncumbranceRiskNote:    req.EncumbranceRiskNote,
		RegulatoryRisk:         req.RegulatoryRisk,
		RegulatoryRiskNote:     req.RegulatoryRiskNote,
		OwnershipChain:         req.OwnershipChain,
		EncumbranceSearches:    req.EncumbranceSearches,
		SearchSummaryNote:      req.SearchSummaryNote,
		RERAHistory:            req.RERAHistory,
		RERAHistorySummaryNote: req.RERAHistorySummary,
		Documents:              req.Documents,
		Status:                 req.Status,
	}
	actor := middleware.ActorFromContext(r.Context())
	if err := h.usecase.Upsert(r.Context(), actor, check); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	writeJSON(w, http.StatusOK, toLegalCheckResponse(check))
}

func (h *LegalCheckHandler) Get(w http.ResponseWriter, r *http.Request) {
	landParcelID, err := uuid.Parse(r.PathValue("parcelID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	check, err := h.usecase.GetByLandParcel(r.Context(), landParcelID)
	if err != nil {
		writeNotFoundOrError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, toLegalCheckResponse(check))
}
