package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
	"github.com/scridddhub/backend/internal/middleware"
	"github.com/scridddhub/backend/internal/usecase"
)

type TPAReportHandler struct {
	usecase *usecase.TPAReportUsecase
}

func NewTPAReportHandler(u *usecase.TPAReportUsecase) *TPAReportHandler {
	return &TPAReportHandler{usecase: u}
}

type upsertTPAReportRequest struct {
	LenderName          string  `json:"lender_name"`
	TemplateVersion     string  `json:"template_version"`
	PeriodYear          int16   `json:"period_year"`
	PeriodQuarter       int16   `json:"period_quarter"`
	PhysicalProgressPct float64 `json:"physical_progress_pct"`
	CostIncurredRupees  int64   `json:"cost_incurred_rupees"`
	DSCR                float64 `json:"dscr"`
	SecurityCoverRatio  float64 `json:"security_cover_ratio"`
	UnitsSold           int32   `json:"units_sold"`
	UnitsTotal          int32   `json:"units_total"`
}

type tpaReportResponse struct {
	ID                  uuid.UUID `json:"id"`
	ProjectID           uuid.UUID `json:"project_id"`
	LenderName          string    `json:"lender_name"`
	TemplateVersion     string    `json:"template_version"`
	PeriodYear          int16     `json:"period_year"`
	PeriodQuarter       int16     `json:"period_quarter"`
	PhysicalProgressPct float64   `json:"physical_progress_pct"`
	CostIncurredRupees  int64     `json:"cost_incurred_rupees"`
	DSCR                float64   `json:"dscr"`
	SecurityCoverRatio  float64   `json:"security_cover_ratio"`
	UnitsSold           int32     `json:"units_sold"`
	UnitsTotal          int32     `json:"units_total"`
	SalesVelocityPct    float64   `json:"sales_velocity_pct"`
	Status              string    `json:"status"`
	SubmittedAt         *string   `json:"submitted_at"`
	CreatedAt           string    `json:"created_at"`
	UpdatedAt           string    `json:"updated_at"`
}

func toTPAReportResponse(r *domain.TPAReport) tpaReportResponse {
	var submittedAt *string
	if r.SubmittedAt != nil {
		s := r.SubmittedAt.Format(timeFormat)
		submittedAt = &s
	}
	return tpaReportResponse{
		ID:                  r.ID,
		ProjectID:           r.ProjectID,
		LenderName:          r.LenderName,
		TemplateVersion:     r.TemplateVersion,
		PeriodYear:          r.PeriodYear,
		PeriodQuarter:       r.PeriodQuarter,
		PhysicalProgressPct: r.PhysicalProgressPct,
		CostIncurredRupees:  r.CostIncurredRupees,
		DSCR:                r.DSCR,
		SecurityCoverRatio:  r.SecurityCoverRatio,
		UnitsSold:           r.UnitsSold,
		UnitsTotal:          r.UnitsTotal,
		SalesVelocityPct:    r.SalesVelocityPct(),
		Status:              string(r.Status),
		SubmittedAt:         submittedAt,
		CreatedAt:           r.CreatedAt.Format(timeFormat),
		UpdatedAt:           r.UpdatedAt.Format(timeFormat),
	}
}

func (h *TPAReportHandler) Upsert(w http.ResponseWriter, r *http.Request) {
	projectID, err := uuid.Parse(r.PathValue("projectID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	var req upsertTPAReportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	report := &domain.TPAReport{
		ProjectID:           projectID,
		LenderName:          req.LenderName,
		TemplateVersion:     req.TemplateVersion,
		PeriodYear:          req.PeriodYear,
		PeriodQuarter:       req.PeriodQuarter,
		PhysicalProgressPct: req.PhysicalProgressPct,
		CostIncurredRupees:  req.CostIncurredRupees,
		DSCR:                req.DSCR,
		SecurityCoverRatio:  req.SecurityCoverRatio,
		UnitsSold:           req.UnitsSold,
		UnitsTotal:          req.UnitsTotal,
	}
	actor := middleware.ActorFromContext(r.Context())
	if err := h.usecase.Upsert(r.Context(), actor, report); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, toTPAReportResponse(report))
}

func (h *TPAReportHandler) Get(w http.ResponseWriter, r *http.Request) {
	projectID, err := uuid.Parse(r.PathValue("projectID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	lenderName := r.PathValue("lenderName")
	year, err1 := strconv.Atoi(r.PathValue("year"))
	quarter, err2 := strconv.Atoi(r.PathValue("quarter"))
	if err1 != nil || err2 != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	report, err := h.usecase.GetByLenderPeriod(r.Context(), projectID, lenderName, int16(year), int16(quarter))
	if err != nil {
		writeNotFoundOrError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toTPAReportResponse(report))
}

func (h *TPAReportHandler) MarkSubmitted(w http.ResponseWriter, r *http.Request) {
	reportID, err := uuid.Parse(r.PathValue("reportID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	actor := middleware.ActorFromContext(r.Context())
	report, err := h.usecase.MarkSubmitted(r.Context(), actor, reportID)
	if err != nil {
		writeNotFoundOrError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toTPAReportResponse(report))
}
