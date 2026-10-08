package handler

import (
	"encoding/json"
	"net/http"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
	"github.com/scridddhub/backend/internal/middleware"
	"github.com/scridddhub/backend/internal/usecase"
)

type ParcelTenureHandler struct {
	usecase *usecase.ParcelTenureUsecase
}

func NewParcelTenureHandler(u *usecase.ParcelTenureUsecase) *ParcelTenureHandler {
	return &ParcelTenureHandler{usecase: u}
}

type parcelTenureBody struct {
	TenureType                 domain.TenureType `json:"tenure_type"`
	PurchasePriceRupees        *int64            `json:"purchase_price_rupees"`
	PurchaseStampDutyRupees    *int64            `json:"purchase_stamp_duty_rupees"`
	JDAModel                   string            `json:"jda_model"`
	DeveloperAreaSharePct      *float64          `json:"developer_area_share_pct"`
	LandownerRevenueSharePct   *float64          `json:"landowner_revenue_share_pct"`
	CashOnTopOfShare           *bool             `json:"cash_on_top_of_share"`
	SecurityDepositRupees      *int64            `json:"security_deposit_rupees"`
	DepositRefundable          *bool             `json:"deposit_refundable"`
	JDAStampDutyRupees         *int64            `json:"jda_stamp_duty_rupees"`
	GSTReverseChargeApplicable *bool             `json:"gst_reverse_charge_applicable"`
	LandownerIsCoPromoter      *bool             `json:"landowner_is_co_promoter"`
}

type parcelTenureResponse struct {
	ID           uuid.UUID `json:"id"`
	LandParcelID uuid.UUID `json:"land_parcel_id"`
	parcelTenureBody
	LandownerAreaSharePct *float64 `json:"landowner_area_share_pct"`
	UpdatedAt             string   `json:"updated_at"`
}

func toParcelTenureResponse(t *domain.ParcelTenure) parcelTenureResponse {
	return parcelTenureResponse{
		ID:           t.ID,
		LandParcelID: t.LandParcelID,
		parcelTenureBody: parcelTenureBody{
			TenureType:                 t.TenureType,
			PurchasePriceRupees:        t.PurchasePriceRupees,
			PurchaseStampDutyRupees:    t.PurchaseStampDutyRupees,
			JDAModel:                   t.JDAModel,
			DeveloperAreaSharePct:      t.DeveloperAreaSharePct,
			LandownerRevenueSharePct:   t.LandownerRevenueSharePct,
			CashOnTopOfShare:           t.CashOnTopOfShare,
			SecurityDepositRupees:      t.SecurityDepositRupees,
			DepositRefundable:          t.DepositRefundable,
			JDAStampDutyRupees:         t.JDAStampDutyRupees,
			GSTReverseChargeApplicable: t.GSTReverseChargeApplicable,
			LandownerIsCoPromoter:      t.LandownerIsCoPromoter,
		},
		LandownerAreaSharePct: t.LandownerAreaSharePct(),
		UpdatedAt:             t.UpdatedAt.Format(timeFormat),
	}
}

// Upsert handles PUT /land-parcels/{parcelID}/tenure.
func (h *ParcelTenureHandler) Upsert(w http.ResponseWriter, r *http.Request) {
	parcelID, err := uuid.Parse(r.PathValue("parcelID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	var b parcelTenureBody
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	t := &domain.ParcelTenure{
		LandParcelID:               parcelID,
		TenureType:                 b.TenureType,
		PurchasePriceRupees:        b.PurchasePriceRupees,
		PurchaseStampDutyRupees:    b.PurchaseStampDutyRupees,
		JDAModel:                   b.JDAModel,
		DeveloperAreaSharePct:      b.DeveloperAreaSharePct,
		LandownerRevenueSharePct:   b.LandownerRevenueSharePct,
		CashOnTopOfShare:           b.CashOnTopOfShare,
		SecurityDepositRupees:      b.SecurityDepositRupees,
		DepositRefundable:          b.DepositRefundable,
		JDAStampDutyRupees:         b.JDAStampDutyRupees,
		GSTReverseChargeApplicable: b.GSTReverseChargeApplicable,
		LandownerIsCoPromoter:      b.LandownerIsCoPromoter,
	}
	actor := middleware.ActorFromContext(r.Context())
	if err := h.usecase.Upsert(r.Context(), actor, t); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, toParcelTenureResponse(t))
}

// Get handles GET /land-parcels/{parcelID}/tenure; 404 until terms are recorded.
func (h *ParcelTenureHandler) Get(w http.ResponseWriter, r *http.Request) {
	parcelID, err := uuid.Parse(r.PathValue("parcelID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	t, err := h.usecase.Get(r.Context(), parcelID)
	if err != nil {
		writeNotFoundOrError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toParcelTenureResponse(t))
}
