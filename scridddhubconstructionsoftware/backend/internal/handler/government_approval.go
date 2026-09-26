package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
	"github.com/scridddhub/backend/internal/middleware"
	"github.com/scridddhub/backend/internal/usecase"
)

type GovernmentApprovalHandler struct {
	usecase *usecase.GovernmentApprovalUsecase
}

func NewGovernmentApprovalHandler(u *usecase.GovernmentApprovalUsecase) *GovernmentApprovalHandler {
	return &GovernmentApprovalHandler{usecase: u}
}

type analyzeProjectRequest struct {
	FreeText string `json:"free_text"`
}

type updateApprovalStatusRequest struct {
	Status      domain.ApprovalStatus `json:"status"`
	SubmittedAt *time.Time            `json:"submitted_at"`
}

type approvalResponse struct {
	ID                     uuid.UUID             `json:"id"`
	LandParcelID           uuid.UUID             `json:"land_parcel_id"`
	ApprovalPlaybookID     uuid.UUID             `json:"approval_playbook_id"`
	Status                 domain.ApprovalStatus `json:"status"`
	SubmittedAt            *time.Time            `json:"submitted_at"`
	SequenceOrder          int16                 `json:"sequence_order"`
	ApprovalName           string                `json:"approval_name"`
	Description            string                `json:"description"`
	ApplicabilityCondition string                `json:"applicability_condition"`
	CreatedAt              string                `json:"created_at"`
	UpdatedAt              string                `json:"updated_at"`
}

func toApprovalResponse(a *domain.LandParcelApproval) approvalResponse {
	return approvalResponse{
		ID:                     a.ID,
		LandParcelID:           a.LandParcelID,
		ApprovalPlaybookID:     a.ApprovalPlaybookID,
		Status:                 a.Status,
		SubmittedAt:            a.SubmittedAt,
		SequenceOrder:          a.SequenceOrder,
		ApprovalName:           a.ApprovalName,
		Description:            a.Description,
		ApplicabilityCondition: a.ApplicabilityCondition,
		CreatedAt:              a.CreatedAt.Format(timeFormat),
		UpdatedAt:              a.UpdatedAt.Format(timeFormat),
	}
}

func (h *GovernmentApprovalHandler) Analyze(w http.ResponseWriter, r *http.Request) {
	landParcelID, err := uuid.Parse(r.PathValue("parcelID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	var req analyzeProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	actor := middleware.ActorFromContext(r.Context())
	approvals, err := h.usecase.AnalyzeProject(r.Context(), actor, landParcelID, req.FreeText)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	responses := make([]approvalResponse, 0, len(approvals))
	for _, a := range approvals {
		responses = append(responses, toApprovalResponse(a))
	}
	writeJSON(w, http.StatusOK, responses)
}

type siteSummaryResponse struct {
	LandParcelID         uuid.UUID `json:"land_parcel_id"`
	State                string    `json:"state"`
	FreeText             string    `json:"free_text"`
	NearAirport          bool      `json:"near_airport"`
	CoastalSite          bool      `json:"coastal_site"`
	SignificantTreeCover bool      `json:"significant_tree_cover"`
	UsesGroundwater      bool      `json:"uses_groundwater"`
	UnitCount            int       `json:"unit_count"`
}

func (h *GovernmentApprovalHandler) GetSiteSummary(w http.ResponseWriter, r *http.Request) {
	landParcelID, err := uuid.Parse(r.PathValue("parcelID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	summary, err := h.usecase.GetSiteSummary(r.Context(), landParcelID)
	if err != nil {
		writeNotFoundOrError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, siteSummaryResponse{
		LandParcelID:         summary.LandParcelID,
		State:                summary.State,
		FreeText:             summary.FreeText,
		NearAirport:          summary.Characteristics.NearAirport,
		CoastalSite:          summary.Characteristics.CoastalSite,
		SignificantTreeCover: summary.Characteristics.SignificantTreeCover,
		UsesGroundwater:      summary.Characteristics.UsesGroundwater,
		UnitCount:            summary.Characteristics.UnitCount,
	})
}

func (h *GovernmentApprovalHandler) List(w http.ResponseWriter, r *http.Request) {
	landParcelID, err := uuid.Parse(r.PathValue("parcelID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	approvals, err := h.usecase.ListApprovals(r.Context(), landParcelID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}

	responses := make([]approvalResponse, 0, len(approvals))
	for _, a := range approvals {
		responses = append(responses, toApprovalResponse(a))
	}
	writeJSON(w, http.StatusOK, responses)
}

func (h *GovernmentApprovalHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	approvalID, err := uuid.Parse(r.PathValue("approvalID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	var req updateApprovalStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	actor := middleware.ActorFromContext(r.Context())
	approval, err := h.usecase.UpdateApprovalStatus(r.Context(), actor, approvalID, req.Status, req.SubmittedAt)
	if err != nil {
		writeNotFoundOrError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, toApprovalResponse(approval))
}
