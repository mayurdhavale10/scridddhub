package handler

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
	"github.com/scridddhub/backend/internal/middleware"
	"github.com/scridddhub/backend/internal/usecase"
)

type LandRecordHandler struct {
	usecase *usecase.LandRecordUsecase
}

func NewLandRecordHandler(u *usecase.LandRecordUsecase) *LandRecordHandler {
	return &LandRecordHandler{usecase: u}
}

type landRecordResponse struct {
	Data        domain.SevenTwelve       `json:"data"`
	Flags       []domain.SevenTwelveFlag `json:"flags"`
	ReadBy      string                   `json:"read_by,omitempty"`
	ConfirmedBy string                   `json:"confirmed_by"`
	ConfirmedAt string                   `json:"confirmed_at"`
}

// Read handles POST /land-parcels/{id}/seven-twelve/read: the body is the photo itself
// (Content-Type image/jpeg, image/png or image/webp). Returns a draft; nothing is saved.
func (h *LandRecordHandler) Read(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	image, err := io.ReadAll(io.LimitReader(r.Body, usecase.MaxSevenTwelveImageBytes+1))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	draft, err := h.usecase.Read(r.Context(), id, image, r.Header.Get("Content-Type"))
	if err != nil {
		switch {
		case errors.Is(err, domain.ErrNotFound):
			writeNotFoundOrError(w, err)
		case errors.Is(err, usecase.ErrReaderUnavailable):
			writeError(w, http.StatusServiceUnavailable, err)
		default:
			writeError(w, http.StatusUnprocessableEntity, err)
		}
		return
	}
	writeJSON(w, http.StatusOK, draft)
}

type confirmLandRecordRequest struct {
	Data   domain.SevenTwelve `json:"data"`
	ReadBy string             `json:"read_by"`
}

// Confirm handles PUT /land-parcels/{id}/seven-twelve: saves the 7/12 a person has checked.
func (h *LandRecordHandler) Confirm(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	var req confirmLandRecordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	rec, err := h.usecase.Confirm(r.Context(), middleware.ActorFromContext(r.Context()), id, req.Data, req.ReadBy)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeNotFoundOrError(w, err)
			return
		}
		writeError(w, http.StatusBadRequest, err)
		return
	}
	h.respond(w, r, rec.LandParcelID)
}

// Get handles GET /land-parcels/{id}/seven-twelve; 404 until one is confirmed.
func (h *LandRecordHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	h.respond(w, r, id)
}

// ReadFerfar handles POST /land-parcels/{id}/ferfar/read: the body is one photo of mutation
// entries. Returns a draft; nothing is saved.
func (h *LandRecordHandler) ReadFerfar(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	image, err := io.ReadAll(io.LimitReader(r.Body, usecase.MaxSevenTwelveImageBytes+1))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	draft, err := h.usecase.ReadFerfar(r.Context(), id, image, r.Header.Get("Content-Type"))
	if err != nil {
		switch {
		case errors.Is(err, domain.ErrNotFound):
			writeNotFoundOrError(w, err)
		case errors.Is(err, usecase.ErrReaderUnavailable):
			writeError(w, http.StatusServiceUnavailable, err)
		default:
			writeError(w, http.StatusUnprocessableEntity, err)
		}
		return
	}
	writeJSON(w, http.StatusOK, draft)
}

type ferfarResponse struct {
	Data         domain.MutationRegister  `json:"data"`
	Flags        []domain.SevenTwelveFlag `json:"flags"`
	YearsCovered int                      `json:"years_covered"`
	ReadBy       string                   `json:"read_by,omitempty"`
	ConfirmedBy  string                   `json:"confirmed_by"`
	ConfirmedAt  string                   `json:"confirmed_at"`
}

type confirmFerfarRequest struct {
	Data   domain.MutationRegister `json:"data"`
	ReadBy string                  `json:"read_by"`
}

// ConfirmFerfar handles PUT /land-parcels/{id}/ferfar; GetFerfar handles GET (404 until confirmed).
func (h *LandRecordHandler) ConfirmFerfar(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	var req confirmFerfarRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if _, err := h.usecase.ConfirmFerfar(r.Context(), middleware.ActorFromContext(r.Context()), id, req.Data, req.ReadBy); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeNotFoundOrError(w, err)
			return
		}
		writeError(w, http.StatusBadRequest, err)
		return
	}
	h.GetFerfar(w, r)
}

func (h *LandRecordHandler) GetFerfar(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	m, flags, err := h.usecase.GetFerfar(r.Context(), id)
	if err != nil {
		writeNotFoundOrError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, ferfarResponse{
		Data: m.Data, Flags: flags, YearsCovered: m.Data.YearsCovered(time.Now()), ReadBy: m.ReadBy,
		ConfirmedBy: m.ConfirmedBy, ConfirmedAt: m.ConfirmedAt.Format(timeFormat),
	})
}

func (h *LandRecordHandler) respond(w http.ResponseWriter, r *http.Request, parcelID uuid.UUID) {
	rec, flags, err := h.usecase.Get(r.Context(), parcelID)
	if err != nil {
		writeNotFoundOrError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, landRecordResponse{
		Data: rec.Data, Flags: flags, ReadBy: rec.ReadBy,
		ConfirmedBy: rec.ConfirmedBy, ConfirmedAt: rec.ConfirmedAt.Format(timeFormat),
	})
}
