package handler

import (
	"context"
	"net/http"

	"github.com/scridddhub/backend/internal/usecase"
)

// ParcelLocationHandler serves the pin screen (docs/design/parcel-location-first-principles.md):
// where to start the pin, and reading coordinates out of a pasted Google Maps link.
type ParcelLocationHandler struct {
	guesser     *usecase.PlannedInfrastructureUsecase
	resolveLink func(ctx context.Context, link string) (float64, float64, error)
}

func NewParcelLocationHandler(g *usecase.PlannedInfrastructureUsecase, resolveLink func(context.Context, string) (float64, float64, error)) *ParcelLocationHandler {
	return &ParcelLocationHandler{guesser: g, resolveLink: resolveLink}
}

type pointResponse struct {
	Found     bool     `json:"found"`
	Latitude  *float64 `json:"latitude"`
	Longitude *float64 `json:"longitude"`
}

// Guess: GET /reference/location-guess?location=... — the starting point for the pin. found=false
// when nothing matched (the app then starts from the village or the state's centre).
func (h *ParcelLocationHandler) Guess(w http.ResponseWriter, r *http.Request) {
	text := r.URL.Query().Get("location")
	if text == "" {
		writeError(w, http.StatusBadRequest, errMissingQuery("location"))
		return
	}
	loc, err := h.guesser.GuessLocation(r.Context(), text)
	if err != nil {
		writeError(w, http.StatusBadGateway, err)
		return
	}
	if loc == nil {
		writeJSON(w, http.StatusOK, pointResponse{Found: false})
		return
	}
	lat, lng := loc.Point.Latitude, loc.Point.Longitude
	writeJSON(w, http.StatusOK, pointResponse{Found: true, Latitude: &lat, Longitude: &lng})
}

// MapLink: GET /reference/map-link?url=... — coordinates from a pasted Google Maps link.
func (h *ParcelLocationHandler) MapLink(w http.ResponseWriter, r *http.Request) {
	link := r.URL.Query().Get("url")
	if link == "" {
		writeError(w, http.StatusBadRequest, errMissingQuery("url"))
		return
	}
	lat, lng, err := h.resolveLink(r.Context(), link)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, err)
		return
	}
	writeJSON(w, http.StatusOK, pointResponse{Found: true, Latitude: &lat, Longitude: &lng})
}
