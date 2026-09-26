package handler

import (
	"encoding/json"
	"net/http"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
	"github.com/scridddhub/backend/internal/middleware"
	"github.com/scridddhub/backend/internal/usecase"
)

type LandTenureHandler struct {
	usecase *usecase.LandTenureUsecase
}

func NewLandTenureHandler(u *usecase.LandTenureUsecase) *LandTenureHandler {
	return &LandTenureHandler{usecase: u}
}

type upsertLandTenureRequest struct {
	TenureType                      domain.TenureType `json:"tenure_type"`
	JDAModel                        string            `json:"jda_model"`
	DeveloperAreaSharePct           *float64          `json:"developer_area_share_pct"`
	CashOnTopOfShare                *bool             `json:"cash_on_top_of_share"`
	RefundableSecurityDepositRupees *int64            `json:"refundable_security_deposit_rupees"`
	JDAStampDutyRupees              *int64            `json:"jda_stamp_duty_rupees"`
	GSTReverseChargeApplicable      *bool             `json:"gst_reverse_charge_applicable"`
	LandownerIsCoPromoter           *bool             `json:"landowner_is_co_promoter"`
}

type landTenureResponse struct {
	ID                              uuid.UUID         `json:"id"`
	ProjectID                       uuid.UUID         `json:"project_id"`
	TenureType                      domain.TenureType `json:"tenure_type"`
	JDAModel                        string            `json:"jda_model"`
	DeveloperAreaSharePct           *float64          `json:"developer_area_share_pct"`
	LandownerAreaSharePct           *float64          `json:"landowner_area_share_pct"`
	CashOnTopOfShare                *bool             `json:"cash_on_top_of_share"`
	RefundableSecurityDepositRupees *int64            `json:"refundable_security_deposit_rupees"`
	JDAStampDutyRupees              *int64            `json:"jda_stamp_duty_rupees"`
	GSTReverseChargeApplicable      *bool             `json:"gst_reverse_charge_applicable"`
	LandownerIsCoPromoter           *bool             `json:"landowner_is_co_promoter"`
	CreatedAt                       string            `json:"created_at"`
	UpdatedAt                       string            `json:"updated_at"`
}

func toLandTenureResponse(t *domain.LandTenure) landTenureResponse {
	return landTenureResponse{
		ID:                              t.ID,
		ProjectID:                       t.ProjectID,
		TenureType:                      t.TenureType,
		JDAModel:                        t.JDAModel,
		DeveloperAreaSharePct:           t.DeveloperAreaSharePct,
		LandownerAreaSharePct:           t.LandownerAreaSharePct(),
		CashOnTopOfShare:                t.CashOnTopOfShare,
		RefundableSecurityDepositRupees: t.RefundableSecurityDepositRupees,
		JDAStampDutyRupees:              t.JDAStampDutyRupees,
		GSTReverseChargeApplicable:      t.GSTReverseChargeApplicable,
		LandownerIsCoPromoter:           t.LandownerIsCoPromoter,
		CreatedAt:                       t.CreatedAt.Format(timeFormat),
		UpdatedAt:                       t.UpdatedAt.Format(timeFormat),
	}
}

func (h *LandTenureHandler) Upsert(w http.ResponseWriter, r *http.Request) {
	projectID, err := uuid.Parse(r.PathValue("projectID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	var req upsertLandTenureRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	tenure := &domain.LandTenure{
		ProjectID:                       projectID,
		TenureType:                      req.TenureType,
		JDAModel:                        req.JDAModel,
		DeveloperAreaSharePct:           req.DeveloperAreaSharePct,
		CashOnTopOfShare:                req.CashOnTopOfShare,
		RefundableSecurityDepositRupees: req.RefundableSecurityDepositRupees,
		JDAStampDutyRupees:              req.JDAStampDutyRupees,
		GSTReverseChargeApplicable:      req.GSTReverseChargeApplicable,
		LandownerIsCoPromoter:           req.LandownerIsCoPromoter,
	}
	actor := middleware.ActorFromContext(r.Context())
	if err := h.usecase.Upsert(r.Context(), actor, tenure); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	writeJSON(w, http.StatusOK, toLandTenureResponse(tenure))
}

func (h *LandTenureHandler) Get(w http.ResponseWriter, r *http.Request) {
	projectID, err := uuid.Parse(r.PathValue("projectID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	tenure, err := h.usecase.GetByProject(r.Context(), projectID)
	if err != nil {
		writeNotFoundOrError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, toLandTenureResponse(tenure))
}
