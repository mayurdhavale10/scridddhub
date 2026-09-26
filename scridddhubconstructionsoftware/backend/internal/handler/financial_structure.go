package handler

import (
	"encoding/json"
	"net/http"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
	"github.com/scridddhub/backend/internal/middleware"
	"github.com/scridddhub/backend/internal/usecase"
)

type FinancialStructureHandler struct {
	usecase *usecase.FinancialStructureUsecase
}

func NewFinancialStructureHandler(u *usecase.FinancialStructureUsecase) *FinancialStructureHandler {
	return &FinancialStructureHandler{usecase: u}
}

type upsertFinancialStructureRequest struct {
	BuyerCollectionsRupees    int64 `json:"buyer_collections_rupees"`
	PromoterEquityRupees      int64 `json:"promoter_equity_rupees"`
	ConstructionFinanceRupees int64 `json:"construction_finance_rupees"`
	ConstructionUseRupees     int64 `json:"construction_use_rupees"`
	LandUseRupees             int64 `json:"land_use_rupees"`
	ApprovalsUseRupees        int64 `json:"approvals_use_rupees"`
	MarketingUseRupees        int64 `json:"marketing_use_rupees"`
	WorkingCapitalUseRupees   int64 `json:"working_capital_use_rupees"`
}

type financialStructureResponse struct {
	ID                        uuid.UUID `json:"id"`
	ProjectID                 uuid.UUID `json:"project_id"`
	BuyerCollectionsRupees    int64     `json:"buyer_collections_rupees"`
	PromoterEquityRupees      int64     `json:"promoter_equity_rupees"`
	ConstructionFinanceRupees int64     `json:"construction_finance_rupees"`
	ConstructionUseRupees     int64     `json:"construction_use_rupees"`
	LandUseRupees             int64     `json:"land_use_rupees"`
	ApprovalsUseRupees        int64     `json:"approvals_use_rupees"`
	MarketingUseRupees        int64     `json:"marketing_use_rupees"`
	WorkingCapitalUseRupees   int64     `json:"working_capital_use_rupees"`
	TotalSourcesRupees        int64     `json:"total_sources_rupees"`
	TotalUsesRupees           int64     `json:"total_uses_rupees"`
	Balanced                  bool      `json:"balanced"`
	CreatedAt                 string    `json:"created_at"`
	UpdatedAt                 string    `json:"updated_at"`
}

func toFinancialStructureResponse(f *domain.FinancialStructure) financialStructureResponse {
	return financialStructureResponse{
		ID:                        f.ID,
		ProjectID:                 f.ProjectID,
		BuyerCollectionsRupees:    f.BuyerCollectionsRupees,
		PromoterEquityRupees:      f.PromoterEquityRupees,
		ConstructionFinanceRupees: f.ConstructionFinanceRupees,
		ConstructionUseRupees:     f.ConstructionUseRupees,
		LandUseRupees:             f.LandUseRupees,
		ApprovalsUseRupees:        f.ApprovalsUseRupees,
		MarketingUseRupees:        f.MarketingUseRupees,
		WorkingCapitalUseRupees:   f.WorkingCapitalUseRupees,
		TotalSourcesRupees:        f.TotalSourcesRupees(),
		TotalUsesRupees:           f.TotalUsesRupees(),
		Balanced:                  f.Balanced(),
		CreatedAt:                 f.CreatedAt.Format(timeFormat),
		UpdatedAt:                 f.UpdatedAt.Format(timeFormat),
	}
}

func (h *FinancialStructureHandler) Upsert(w http.ResponseWriter, r *http.Request) {
	projectID, err := uuid.Parse(r.PathValue("projectID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	var req upsertFinancialStructureRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	structure := &domain.FinancialStructure{
		ProjectID:                 projectID,
		BuyerCollectionsRupees:    req.BuyerCollectionsRupees,
		PromoterEquityRupees:      req.PromoterEquityRupees,
		ConstructionFinanceRupees: req.ConstructionFinanceRupees,
		ConstructionUseRupees:     req.ConstructionUseRupees,
		LandUseRupees:             req.LandUseRupees,
		ApprovalsUseRupees:        req.ApprovalsUseRupees,
		MarketingUseRupees:        req.MarketingUseRupees,
		WorkingCapitalUseRupees:   req.WorkingCapitalUseRupees,
	}
	actor := middleware.ActorFromContext(r.Context())
	if err := h.usecase.Upsert(r.Context(), actor, structure); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	writeJSON(w, http.StatusOK, toFinancialStructureResponse(structure))
}

func (h *FinancialStructureHandler) Get(w http.ResponseWriter, r *http.Request) {
	projectID, err := uuid.Parse(r.PathValue("projectID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	structure, err := h.usecase.GetByProject(r.Context(), projectID)
	if err != nil {
		writeNotFoundOrError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, toFinancialStructureResponse(structure))
}
