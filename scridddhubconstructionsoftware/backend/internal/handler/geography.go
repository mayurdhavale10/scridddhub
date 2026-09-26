package handler

import (
	"net/http"

	"github.com/scridddhub/backend/internal/usecase"
)

// GeographyHandler serves Maharashtra's real, complete administrative geography (docs/adr/0006)
// — all 36 districts, 358 talukas, 44,918 villages, sourced from the government's own Common
// Village Master API. Deliberately decoupled from ReadyReckonerRateHandler: which villages exist
// is a different question from which villages have a rate on file, and conflating the two (the
// old design) meant the picker only ever showed the handful of villages we'd manually seeded.
type GeographyHandler struct {
	usecase *usecase.GeographyUsecase
}

func NewGeographyHandler(u *usecase.GeographyUsecase) *GeographyHandler {
	return &GeographyHandler{usecase: u}
}

func (h *GeographyHandler) ListDistricts(w http.ResponseWriter, r *http.Request) {
	values, err := h.usecase.ListDistricts(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, stringListResponse{Values: values})
}

func (h *GeographyHandler) ListTalukas(w http.ResponseWriter, r *http.Request) {
	district := r.URL.Query().Get("district")
	if district == "" {
		writeError(w, http.StatusBadRequest, errMissingQuery("district"))
		return
	}
	values, err := h.usecase.ListTalukas(r.Context(), district)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, stringListResponse{Values: values})
}

func (h *GeographyHandler) ListVillages(w http.ResponseWriter, r *http.Request) {
	district := r.URL.Query().Get("district")
	taluka := r.URL.Query().Get("taluka")
	if district == "" || taluka == "" {
		writeError(w, http.StatusBadRequest, errMissingQuery("district and taluka"))
		return
	}
	values, err := h.usecase.ListVillages(r.Context(), district, taluka)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, stringListResponse{Values: values})
}

type villageMatchResponse struct {
	District string `json:"district"`
	Taluka   string `json:"taluka"`
	Village  string `json:"village"`
}

// SearchVillages powers free-text location entry on Screen 4.2 — a single search field instead of
// three cascading district/taluka/village pickers (see docs/adr/0006 follow-up: nobody entering a
// parcel wants to pick administrative units they may not even know).
func (h *GeographyHandler) SearchVillages(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		writeError(w, http.StatusBadRequest, errMissingQuery("q"))
		return
	}
	matches, err := h.usecase.SearchVillages(r.Context(), query)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	results := make([]villageMatchResponse, len(matches))
	for i, m := range matches {
		results[i] = villageMatchResponse{District: m.District, Taluka: m.Taluka, Village: m.Village}
	}
	writeJSON(w, http.StatusOK, struct {
		Results []villageMatchResponse `json:"results"`
	}{Results: results})
}
