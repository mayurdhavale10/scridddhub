package handler

import (
	"encoding/base64"
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

type RecordQueueHandler struct {
	usecase *usecase.RecordQueueUsecase
}

func NewRecordQueueHandler(u *usecase.RecordQueueUsecase) *RecordQueueHandler {
	return &RecordQueueHandler{usecase: u}
}

type recordRequestResponse struct {
	ID           string `json:"id"`
	District     string `json:"district"`
	Taluka       string `json:"taluka"`
	Village      string `json:"village"`
	SurveyNumber string `json:"survey_number"`
	Status       string `json:"status"`
	Note         string `json:"note,omitempty"`
	DistrictMR   string `json:"district_mr"`
	TalukaMR     string `json:"taluka_mr"`
	VillageMR    string `json:"village_mr"`
	LandParcelID string `json:"land_parcel_id,omitempty"`
}

// List handles GET /record-requests?status=queued&district=&taluka=
func (h *RecordQueueHandler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	list, counts, err := h.usecase.Queue(r.Context(), q.Get("status"), q.Get("district"), q.Get("taluka"))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	items := make([]recordRequestResponse, 0, len(list))
	for _, x := range list {
		resp := recordRequestResponse{ID: x.ID.String(), District: x.District, Taluka: x.Taluka, Village: x.Village,
			SurveyNumber: x.SurveyNumber, Status: x.Status, Note: x.Note,
			DistrictMR: x.DistrictMR, TalukaMR: x.TalukaMR, VillageMR: x.VillageMR}
		if x.LandParcelID != nil {
			resp.LandParcelID = x.LandParcelID.String()
		}
		items = append(items, resp)
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "counts": counts})
}

type enqueueRequest struct {
	Items []struct {
		District     string `json:"district"`
		Taluka       string `json:"taluka"`
		Village      string `json:"village"`
		SurveyNumber string `json:"survey_number"`
	} `json:"items"`
}

// Enqueue handles POST /record-requests: survey numbers to fetch.
func (h *RecordQueueHandler) Enqueue(w http.ResponseWriter, r *http.Request) {
	var req enqueueRequest
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	lands := make([]usecase.LandToFetch, 0, len(req.Items))
	for _, it := range req.Items {
		lands = append(lands, usecase.LandToFetch{District: it.District, Taluka: it.Taluka, Village: it.Village, SurveyNumber: it.SurveyNumber})
	}
	added, err := h.usecase.Enqueue(r.Context(), middleware.ActorFromContext(r.Context()), lands)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]int{"added": added})
}

type saveResultRequest struct {
	Text      string `json:"text"`
	SourceURL string `json:"source_url"`
	// The 7/12 as an image (base64, no data: prefix), when the site shows it as a picture.
	ImageBase64 string `json:"image_base64"`
	MimeType    string `json:"mime_type"`
}

// SaveResult handles POST /record-requests/{id}/result: the fetched 7/12 page, as text or as an
// image.
func (h *RecordQueueHandler) SaveResult(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	var req saveResultRequest
	if err := json.NewDecoder(io.LimitReader(r.Body, 12<<20)).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	actor := middleware.ActorFromContext(r.Context())
	var c *domain.CachedRecord
	if req.ImageBase64 != "" {
		img, decErr := base64.StdEncoding.DecodeString(req.ImageBase64)
		if decErr != nil {
			writeError(w, http.StatusBadRequest, decErr)
			return
		}
		c, err = h.usecase.SaveImageResult(r.Context(), actor, id, img, req.MimeType, req.SourceURL)
	} else {
		c, err = h.usecase.SaveResult(r.Context(), actor, id, req.Text, req.SourceURL)
	}
	if err != nil {
		switch {
		case errors.Is(err, domain.ErrNotFound):
			writeNotFoundOrError(w, err)
		default:
			writeError(w, http.StatusUnprocessableEntity, err)
		}
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"survey_number": c.Parsed.SurveyNumber, "owners": len(c.Parsed.Owners), "fetched_at": c.FetchedAt.Format(timeFormat)})
}

type setStatusRequest struct {
	Status string `json:"status"`
	Note   string `json:"note"`
}

// SetStatus handles POST /record-requests/{id}/status: not_found, skipped, or back to queued.
func (h *RecordQueueHandler) SetStatus(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	var req setStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if err := h.usecase.Skip(r.Context(), id, req.Status, req.Note); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeNotFoundOrError(w, err)
			return
		}
		writeError(w, http.StatusBadRequest, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Cached handles GET /land-parcels/{id}/seven-twelve/cached?survey=: the cached 7/12 for one of the parcel's survey numbers (default the first)
// land, as a draft to check and confirm; 404 when none.
func (h *RecordQueueHandler) Cached(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	c, draft, err := h.usecase.CachedForParcel(r.Context(), id, r.URL.Query().Get("survey"))
	if err != nil {
		writeNotFoundOrError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"draft": draft, "fetched_at": c.FetchedAt.Format(timeFormat), "fetched_by": c.FetchedBy,
		"fresh": c.Fresh(time.Now()),
	})
}
