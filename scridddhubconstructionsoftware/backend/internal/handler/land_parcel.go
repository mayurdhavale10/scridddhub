package handler

import (
	"encoding/json"
	"net/http"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
	"github.com/scridddhub/backend/internal/middleware"
	"github.com/scridddhub/backend/internal/usecase"
)

type LandParcelHandler struct {
	usecase *usecase.LandParcelUsecase
}

func NewLandParcelHandler(u *usecase.LandParcelUsecase) *LandParcelHandler {
	return &LandParcelHandler{usecase: u}
}

type createLandParcelRequest struct {
	ProjectID  uuid.UUID `json:"project_id"`
	Name       string    `json:"name"`
	Location   string    `json:"location"`
	AreaAcres  *float64  `json:"area_acres"`
	CostRupees *int64    `json:"cost_rupees"`
	FSI        *float64  `json:"fsi"`
	Source     *string   `json:"source"`
	SourceURL  *string   `json:"source_url"`
	District   *string   `json:"district"`
	Taluka     *string   `json:"taluka"`
	Village    *string   `json:"village"`
	Notes      string    `json:"notes"`
}

type recordClosedPriceRequest struct {
	ClosedPriceRupees int64 `json:"closed_price_rupees"`
}

type updateStageRequest struct {
	Stage domain.LandParcelStage `json:"stage"`
}

type landParcelResponse struct {
	ID                uuid.UUID `json:"id"`
	ProjectID         uuid.UUID `json:"project_id"`
	Name              string    `json:"name"`
	Location          string    `json:"location"`
	AreaAcres         *float64  `json:"area_acres"`
	CostRupees        *int64    `json:"cost_rupees"`
	FSI               *float64  `json:"fsi"`
	Source            *string   `json:"source"`
	SourceURL         *string   `json:"source_url"`
	SourceVerifiedAt  *string   `json:"source_verified_at"`
	District          *string   `json:"district"`
	Taluka            *string   `json:"taluka"`
	Village           *string   `json:"village"`
	ClosedPriceRupees *int64    `json:"closed_price_rupees"`
	ClosedAt          *string   `json:"closed_at"`
	Stage             string    `json:"stage"`
	Notes             string    `json:"notes"`
	CreatedAt         string    `json:"created_at"`
	UpdatedAt         string    `json:"updated_at"`
}

func toLandParcelResponse(p *domain.LandParcel) landParcelResponse {
	var verifiedAt *string
	if p.SourceVerifiedAt != nil {
		formatted := p.SourceVerifiedAt.Format(timeFormat)
		verifiedAt = &formatted
	}
	var closedAt *string
	if p.ClosedAt != nil {
		formatted := p.ClosedAt.Format(timeFormat)
		closedAt = &formatted
	}
	return landParcelResponse{
		ID:                p.ID,
		ProjectID:         p.ProjectID,
		Name:              p.Name,
		Location:          p.Location,
		AreaAcres:         p.AreaAcres,
		CostRupees:        p.CostRupees,
		FSI:               p.FSI,
		Source:            p.Source,
		SourceURL:         p.SourceURL,
		SourceVerifiedAt:  verifiedAt,
		District:          p.District,
		Taluka:            p.Taluka,
		Village:           p.Village,
		ClosedPriceRupees: p.ClosedPriceRupees,
		ClosedAt:          closedAt,
		Stage:             string(p.Stage),
		Notes:             p.Notes,
		CreatedAt:         p.CreatedAt.Format(timeFormat),
		UpdatedAt:         p.UpdatedAt.Format(timeFormat),
	}
}

func (h *LandParcelHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req createLandParcelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	parcel := &domain.LandParcel{
		ProjectID:  req.ProjectID,
		Name:       req.Name,
		Location:   req.Location,
		AreaAcres:  req.AreaAcres,
		CostRupees: req.CostRupees,
		FSI:        req.FSI,
		Source:     req.Source,
		SourceURL:  req.SourceURL,
		District:   req.District,
		Taluka:     req.Taluka,
		Village:    req.Village,
		Notes:      req.Notes,
	}
	actor := middleware.ActorFromContext(r.Context())
	if err := h.usecase.Create(r.Context(), actor, parcel); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	writeJSON(w, http.StatusCreated, toLandParcelResponse(parcel))
}

func (h *LandParcelHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	parcel, err := h.usecase.Get(r.Context(), id)
	if err != nil {
		writeNotFoundOrError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, toLandParcelResponse(parcel))
}

func (h *LandParcelHandler) ListByProject(w http.ResponseWriter, r *http.Request) {
	projectID, err := uuid.Parse(r.PathValue("projectID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	parcels, err := h.usecase.ListByProject(r.Context(), projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}

	responses := make([]landParcelResponse, 0, len(parcels))
	for _, p := range parcels {
		responses = append(responses, toLandParcelResponse(p))
	}
	writeJSON(w, http.StatusOK, responses)
}

// The old comparable-based EstimatePrice handler was removed 2026-09-19 per docs/adr/0004 — see
// handler.ReadyReckonerRateHandler.Estimate for its replacement (ready_reckoner_rate.go).

type verifySourceResponse struct {
	Reachable  bool                `json:"reachable"`
	StatusCode int                 `json:"status_code"`
	Parcel     *landParcelResponse `json:"parcel"`
}

// VerifySource is on-demand only (a person taps "Verify"), never triggered automatically. A real
// HTTP reachability check against the parcel's own recorded source_url — never a content scrape.
func (h *LandParcelHandler) VerifySource(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	actor := middleware.ActorFromContext(r.Context())
	parcel, result, err := h.usecase.VerifySource(r.Context(), actor, id)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	resp := toLandParcelResponse(parcel)
	writeJSON(w, http.StatusOK, verifySourceResponse{
		Reachable:  result.Reachable,
		StatusCode: result.StatusCode,
		Parcel:     &resp,
	})
}

// RecordClosedPrice sets the real, final transacted price once a deal actually closes — see
// usecase.LandParcelUsecase.RecordClosedPrice and docs/adr/0005 for why this is a separate action
// from the parcel's original asking price, not an edit to it.
func (h *LandParcelHandler) RecordClosedPrice(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	var req recordClosedPriceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	actor := middleware.ActorFromContext(r.Context())
	parcel, err := h.usecase.RecordClosedPrice(r.Context(), actor, id, req.ClosedPriceRupees)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	writeJSON(w, http.StatusOK, toLandParcelResponse(parcel))
}

func (h *LandParcelHandler) UpdateStage(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	var req updateStageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	actor := middleware.ActorFromContext(r.Context())
	parcel, err := h.usecase.UpdateStage(r.Context(), actor, id, req.Stage)
	if err != nil {
		if err == domain.ErrInvalidStage {
			writeError(w, http.StatusBadRequest, err)
			return
		}
		writeNotFoundOrError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, toLandParcelResponse(parcel))
}
