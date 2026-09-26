package handler

import (
	"net/http"

	"github.com/scridddhub/backend/internal/usecase"
)

type PricingPoolHandler struct {
	usecase *usecase.PricingPoolUsecase
}

func NewPricingPoolHandler(u *usecase.PricingPoolUsecase) *PricingPoolHandler {
	return &PricingPoolHandler{usecase: u}
}

type closedTransactionResponse struct {
	AreaAcres         float64 `json:"area_acres"`
	ClosedPriceRupees int64   `json:"closed_price_rupees"`
	ClosedAt          string  `json:"closed_at"`
}

type listClosedTransactionsResponse struct {
	Count        int                         `json:"count"`
	Transactions []closedTransactionResponse `json:"transactions"`
}

// ListClosedTransactions is real, tested infrastructure for a future pricing model (docs/adr/0005)
// — deliberately not wired to any mobile UI yet, same pattern as EscrowAccount's bank-feed
// endpoint (migration 000011): built for a future consumer (a model-training job), not for a
// person tapping a button today. Pools across every project/org in the database — no project_id
// parameter exists on this endpoint at all, by design.
func (h *PricingPoolHandler) ListClosedTransactions(w http.ResponseWriter, r *http.Request) {
	district := r.URL.Query().Get("district")
	taluka := r.URL.Query().Get("taluka")
	village := r.URL.Query().Get("village")
	if district == "" || taluka == "" || village == "" {
		writeError(w, http.StatusBadRequest, errMissingQuery("district, taluka, and village"))
		return
	}

	transactions, err := h.usecase.ListClosedTransactions(r.Context(), district, taluka, village)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}

	responses := make([]closedTransactionResponse, 0, len(transactions))
	for _, t := range transactions {
		responses = append(responses, closedTransactionResponse{
			AreaAcres:         t.AreaAcres,
			ClosedPriceRupees: t.ClosedPriceRupees,
			ClosedAt:          t.ClosedAt.Format(timeFormat),
		})
	}
	writeJSON(w, http.StatusOK, listClosedTransactionsResponse{
		Count:        len(responses),
		Transactions: responses,
	})
}
