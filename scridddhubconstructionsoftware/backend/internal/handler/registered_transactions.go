package handler

import (
	"fmt"
	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
	"github.com/scridddhub/backend/internal/usecase"
	"math"
	"net/http"
	"strconv"
	"strings"
)

type RegisteredTransactionsHandler struct {
	uc *usecase.RegisteredTransactionsUsecase
}

func NewRegisteredTransactionsHandler(u *usecase.RegisteredTransactionsUsecase) *RegisteredTransactionsHandler {
	return &RegisteredTransactionsHandler{uc: u}
}
func (h *RegisteredTransactionsHandler) ForParcel(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("parcelID"))
	if err != nil {
		writeError(w, 400, err)
		return
	}
	result, err := h.uc.ForParcel(r.Context(), id)
	if err != nil {
		writeNotFoundOrError(w, err)
		return
	}
	writeJSON(w, 200, result)
}
func (h *RegisteredTransactionsHandler) ForLocation(w http.ResponseWriter, r *http.Request) {
	values := r.URL.Query()
	q := domain.TransactionQuery{District: strings.TrimSpace(values.Get("district")), Taluka: strings.TrimSpace(values.Get("taluka")), Village: strings.TrimSpace(values.Get("village"))}
	if values.Has("latitude") || values.Has("longitude") {
		lat, e1 := strconv.ParseFloat(values.Get("latitude"), 64)
		lng, e2 := strconv.ParseFloat(values.Get("longitude"), 64)
		if e1 != nil || e2 != nil || math.IsNaN(lat) || math.IsNaN(lng) || lat < 15 || lat > 23 || lng < 72 || lng > 81 {
			writeError(w, 400, fmt.Errorf("valid Maharashtra latitude and longitude are required together"))
			return
		}
		q.Latitude, q.Longitude = &lat, &lng
	}
	if q.Latitude == nil && (q.District == "" || q.Taluka == "" || q.Village == "") {
		writeError(w, 400, fmt.Errorf("provide a pin or district, taluka and village"))
		return
	}
	result, err := h.uc.ForLocation(r.Context(), q)
	if err != nil {
		writeError(w, 500, err)
		return
	}
	writeJSON(w, 200, result)
}
