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

type readTextRequest struct {
	Text      string `json:"text"`
	SourceURL string `json:"source_url"`
}

// ReadText handles POST /land-parcels/{id}/seven-twelve/read-text: the text of a 7/12 page the
// person opened on Bhulekh in the app after typing the captcha. Returns a draft; nothing is saved.
func (h *LandRecordHandler) ReadText(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	var req readTextRequest
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	draft, err := h.usecase.ReadText(r.Context(), id, req.Text, req.SourceURL)
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

// ReadPDF handles POST /land-parcels/{id}/seven-twelve/read-pdf?filename=…: the body is the
// signed 7/12 PDF from Digital Satbara (Content-Type application/pdf). The file name it was
// downloaded under carries the exact survey number. Returns a draft; nothing is saved.
func (h *LandRecordHandler) ReadPDF(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	pdf, err := io.ReadAll(io.LimitReader(r.Body, usecase.MaxSignedPDFBytes+1))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	draft, err := h.usecase.ReadSignedPDF(r.Context(), id, pdf, r.URL.Query().Get("filename"))
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

// Confirm handles PUT /land-parcels/{id}/seven-twelve: saves the 7/12 a person has checked, for
// the survey number it shows. Returns the parcel's full set of 7/12s.
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

// Get handles GET /land-parcels/{id}/seven-twelve: every confirmed 7/12 of the parcel (records is
// empty until one is confirmed; 404 only if the parcel doesn't exist).
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

// sevenTwelveSetResponse is the parcel's 7/12s, one per survey number, with the warnings read
// across all of them.
type sevenTwelveSetResponse struct {
	Records        []landRecordResponse     `json:"records"`
	Flags          []domain.SevenTwelveFlag `json:"flags"`
	TotalAreaSqm   float64                  `json:"total_area_sqm"`
	Missing        []string                 `json:"missing"`
	Extra          []string                 `json:"extra"`
	CurrentHolders []string                 `json:"current_holders"`
}

// Delete handles DELETE /land-parcels/{id}/seven-twelve?survey=42/3: removes the 7/12 saved for
// that survey number.
func (h *LandRecordHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	survey := r.URL.Query().Get("survey")
	if survey == "" {
		writeError(w, http.StatusBadRequest, errors.New("survey is required"))
		return
	}
	if err := h.usecase.Delete(r.Context(), middleware.ActorFromContext(r.Context()), id, survey); err != nil {
		writeNotFoundOrError(w, err)
		return
	}
	h.respond(w, r, id)
}

func (h *LandRecordHandler) respond(w http.ResponseWriter, r *http.Request, parcelID uuid.UUID) {
	set, err := h.usecase.Get(r.Context(), parcelID)
	if err != nil {
		writeNotFoundOrError(w, err)
		return
	}
	resp := sevenTwelveSetResponse{
		Records: make([]landRecordResponse, 0, len(set.Records)), Flags: set.Flags, TotalAreaSqm: set.TotalAreaSqm,
		Missing: set.Missing, Extra: set.Extra, CurrentHolders: set.CurrentHolders,
	}
	for _, rec := range set.Records {
		resp.Records = append(resp.Records, landRecordResponse{
			Data: rec.Data, Flags: rec.Data.Flags(nil), ReadBy: rec.ReadBy,
			ConfirmedBy: rec.ConfirmedBy, ConfirmedAt: rec.ConfirmedAt.Format(timeFormat),
		})
	}
	writeJSON(w, http.StatusOK, resp)
}
