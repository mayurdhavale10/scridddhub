package handler

import (
	"encoding/json"
	"net/http"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
	"github.com/scridddhub/backend/internal/middleware"
	"github.com/scridddhub/backend/internal/usecase"
)

// --- Tender ---

type TenderHandler struct {
	usecase *usecase.TenderUsecase
}

func NewTenderHandler(u *usecase.TenderUsecase) *TenderHandler {
	return &TenderHandler{usecase: u}
}

type createTenderRequest struct {
	TradePackage string `json:"trade_package"`
}

type tenderResponse struct {
	ID           uuid.UUID `json:"id"`
	ProjectID    uuid.UUID `json:"project_id"`
	TradePackage string    `json:"trade_package"`
	CreatedAt    string    `json:"created_at"`
	UpdatedAt    string    `json:"updated_at"`
}

func toTenderResponse(t *domain.Tender) tenderResponse {
	return tenderResponse{
		ID:           t.ID,
		ProjectID:    t.ProjectID,
		TradePackage: t.TradePackage,
		CreatedAt:    t.CreatedAt.Format(timeFormat),
		UpdatedAt:    t.UpdatedAt.Format(timeFormat),
	}
}

func (h *TenderHandler) Create(w http.ResponseWriter, r *http.Request) {
	projectID, err := uuid.Parse(r.PathValue("projectID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	var req createTenderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	t := &domain.Tender{ProjectID: projectID, TradePackage: req.TradePackage}
	actor := middleware.ActorFromContext(r.Context())
	if err := h.usecase.Create(r.Context(), actor, t); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusCreated, toTenderResponse(t))
}

func (h *TenderHandler) ListByProject(w http.ResponseWriter, r *http.Request) {
	projectID, err := uuid.Parse(r.PathValue("projectID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	tenders, err := h.usecase.ListByProject(r.Context(), projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	responses := make([]tenderResponse, 0, len(tenders))
	for _, t := range tenders {
		responses = append(responses, toTenderResponse(t))
	}
	writeJSON(w, http.StatusOK, responses)
}

// --- TenderBid ---

type TenderBidHandler struct {
	usecase *usecase.TenderBidUsecase
}

func NewTenderBidHandler(u *usecase.TenderBidUsecase) *TenderBidHandler {
	return &TenderBidHandler{usecase: u}
}

type createTenderBidRequest struct {
	ContractorName        string `json:"contractor_name"`
	PastJobsWithDeveloper int32  `json:"past_jobs_with_developer"`
	PastPerformanceNote   string `json:"past_performance_note"`
	TechnicalBidStatus    string `json:"technical_bid_status"`
	FinancialBidRupees    *int64 `json:"financial_bid_rupees"`
	Recommended           bool   `json:"recommended"`
}

type updateTenderBidRequest struct {
	TechnicalBidStatus string `json:"technical_bid_status"`
	FinancialBidRupees *int64 `json:"financial_bid_rupees"`
	Recommended        bool   `json:"recommended"`
}

type tenderBidResponse struct {
	ID                    uuid.UUID `json:"id"`
	TenderID              uuid.UUID `json:"tender_id"`
	ContractorName        string    `json:"contractor_name"`
	PastJobsWithDeveloper int32     `json:"past_jobs_with_developer"`
	PastPerformanceNote   string    `json:"past_performance_note"`
	TechnicalBidStatus    string    `json:"technical_bid_status"`
	FinancialBidRupees    *int64    `json:"financial_bid_rupees"`
	Recommended           bool      `json:"recommended"`
	CreatedAt             string    `json:"created_at"`
	UpdatedAt             string    `json:"updated_at"`
}

func toTenderBidResponse(b *domain.TenderBid) tenderBidResponse {
	return tenderBidResponse{
		ID:                    b.ID,
		TenderID:              b.TenderID,
		ContractorName:        b.ContractorName,
		PastJobsWithDeveloper: b.PastJobsWithDeveloper,
		PastPerformanceNote:   b.PastPerformanceNote,
		TechnicalBidStatus:    string(b.TechnicalBidStatus),
		FinancialBidRupees:    b.FinancialBidRupees,
		Recommended:           b.Recommended,
		CreatedAt:             b.CreatedAt.Format(timeFormat),
		UpdatedAt:             b.UpdatedAt.Format(timeFormat),
	}
}

func (h *TenderBidHandler) Create(w http.ResponseWriter, r *http.Request) {
	tenderID, err := uuid.Parse(r.PathValue("tenderID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	var req createTenderBidRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	b := &domain.TenderBid{
		TenderID:              tenderID,
		ContractorName:        req.ContractorName,
		PastJobsWithDeveloper: req.PastJobsWithDeveloper,
		PastPerformanceNote:   req.PastPerformanceNote,
		TechnicalBidStatus:    domain.TenderBidTechnicalStatus(req.TechnicalBidStatus),
		FinancialBidRupees:    req.FinancialBidRupees,
		Recommended:           req.Recommended,
	}
	actor := middleware.ActorFromContext(r.Context())
	if err := h.usecase.Create(r.Context(), actor, b); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusCreated, toTenderBidResponse(b))
}

func (h *TenderBidHandler) ListByTender(w http.ResponseWriter, r *http.Request) {
	tenderID, err := uuid.Parse(r.PathValue("tenderID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	bids, err := h.usecase.ListByTender(r.Context(), tenderID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	responses := make([]tenderBidResponse, 0, len(bids))
	for _, b := range bids {
		responses = append(responses, toTenderBidResponse(b))
	}
	writeJSON(w, http.StatusOK, responses)
}

func (h *TenderBidHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("bidID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	var req updateTenderBidRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	actor := middleware.ActorFromContext(r.Context())
	b, err := h.usecase.Update(r.Context(), actor, id, domain.TenderBidTechnicalStatus(req.TechnicalBidStatus), req.FinancialBidRupees, req.Recommended)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, toTenderBidResponse(b))
}
