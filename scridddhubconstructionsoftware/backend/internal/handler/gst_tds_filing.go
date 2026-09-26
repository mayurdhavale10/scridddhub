package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
	"github.com/scridddhub/backend/internal/middleware"
	"github.com/scridddhub/backend/internal/usecase"
)

// --- GST filing ---

type GSTFilingHandler struct {
	usecase *usecase.GSTFilingUsecase
}

func NewGSTFilingHandler(u *usecase.GSTFilingUsecase) *GSTFilingHandler {
	return &GSTFilingHandler{usecase: u}
}

type upsertGSTFilingRequest struct {
	PeriodYear              int16      `json:"period_year"`
	PeriodQuarter           int16      `json:"period_quarter"`
	GSTR1Status             string     `json:"gstr1_status"`
	GSTR1FiledLate          *bool      `json:"gstr1_filed_late"`
	GSTR3BStatus            string     `json:"gstr3b_status"`
	GSTR3BDueAt             *time.Time `json:"gstr3b_due_at"`
	ITCClaimedRupees        int64      `json:"itc_claimed_rupees"`
	ExemptTurnoverRatioPct  *float64   `json:"exempt_turnover_ratio_pct"`
	CommonITCReversalRupees *int64     `json:"common_itc_reversal_rupees"`
}

type gstFilingResponse struct {
	ID                      uuid.UUID  `json:"id"`
	ProjectID               uuid.UUID  `json:"project_id"`
	PeriodYear              int16      `json:"period_year"`
	PeriodQuarter           int16      `json:"period_quarter"`
	GSTR1Status             string     `json:"gstr1_status"`
	GSTR1FiledLate          *bool      `json:"gstr1_filed_late"`
	GSTR3BStatus            string     `json:"gstr3b_status"`
	GSTR3BDueAt             *time.Time `json:"gstr3b_due_at"`
	ITCClaimedRupees        int64      `json:"itc_claimed_rupees"`
	ExemptTurnoverRatioPct  *float64   `json:"exempt_turnover_ratio_pct"`
	CommonITCReversalRupees *int64     `json:"common_itc_reversal_rupees"`
	CreatedAt               string     `json:"created_at"`
	UpdatedAt               string     `json:"updated_at"`
}

func toGSTFilingResponse(f *domain.GSTFiling) gstFilingResponse {
	return gstFilingResponse{
		ID:                      f.ID,
		ProjectID:               f.ProjectID,
		PeriodYear:              f.PeriodYear,
		PeriodQuarter:           f.PeriodQuarter,
		GSTR1Status:             string(f.GSTR1Status),
		GSTR1FiledLate:          f.GSTR1FiledLate,
		GSTR3BStatus:            string(f.GSTR3BStatus),
		GSTR3BDueAt:             f.GSTR3BDueAt,
		ITCClaimedRupees:        f.ITCClaimedRupees,
		ExemptTurnoverRatioPct:  f.ExemptTurnoverRatioPct,
		CommonITCReversalRupees: f.CommonITCReversalRupees,
		CreatedAt:               f.CreatedAt.Format(timeFormat),
		UpdatedAt:               f.UpdatedAt.Format(timeFormat),
	}
}

func (h *GSTFilingHandler) Upsert(w http.ResponseWriter, r *http.Request) {
	projectID, err := uuid.Parse(r.PathValue("projectID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	var req upsertGSTFilingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	filing := &domain.GSTFiling{
		ProjectID:               projectID,
		PeriodYear:              req.PeriodYear,
		PeriodQuarter:           req.PeriodQuarter,
		GSTR1Status:             domain.FilingStatus(req.GSTR1Status),
		GSTR1FiledLate:          req.GSTR1FiledLate,
		GSTR3BStatus:            domain.FilingStatus(req.GSTR3BStatus),
		GSTR3BDueAt:             req.GSTR3BDueAt,
		ITCClaimedRupees:        req.ITCClaimedRupees,
		ExemptTurnoverRatioPct:  req.ExemptTurnoverRatioPct,
		CommonITCReversalRupees: req.CommonITCReversalRupees,
	}
	actor := middleware.ActorFromContext(r.Context())
	if err := h.usecase.Upsert(r.Context(), actor, filing); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, toGSTFilingResponse(filing))
}

func (h *GSTFilingHandler) Get(w http.ResponseWriter, r *http.Request) {
	projectID, err := uuid.Parse(r.PathValue("projectID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	year, err1 := strconv.Atoi(r.PathValue("year"))
	quarter, err2 := strconv.Atoi(r.PathValue("quarter"))
	if err1 != nil || err2 != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	filing, err := h.usecase.GetByPeriod(r.Context(), projectID, int16(year), int16(quarter))
	if err != nil {
		writeNotFoundOrError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toGSTFilingResponse(filing))
}

// --- TDS filing ---

type TDSFilingHandler struct {
	usecase *usecase.TDSFilingUsecase
}

func NewTDSFilingHandler(u *usecase.TDSFilingUsecase) *TDSFilingHandler {
	return &TDSFilingHandler{usecase: u}
}

type upsertTDSFilingRequest struct {
	PeriodYear                int16                             `json:"period_year"`
	PeriodQuarter             int16                             `json:"period_quarter"`
	Form26QStatus             string                            `json:"form26q_status"`
	Form26QDueAt              *time.Time                        `json:"form26q_due_at"`
	Section194CDeductedRupees int64                             `json:"section194c_deducted_rupees"`
	Section194JDeductedRupees int64                             `json:"section194j_deducted_rupees"`
	Section194JByProfessional []domain.TDSProfessionalDeduction `json:"section194j_by_professional"`
}

type tdsFilingResponse struct {
	ID                        uuid.UUID                         `json:"id"`
	ProjectID                 uuid.UUID                         `json:"project_id"`
	PeriodYear                int16                             `json:"period_year"`
	PeriodQuarter             int16                             `json:"period_quarter"`
	Form26QStatus             string                            `json:"form26q_status"`
	Form26QDueAt              *time.Time                        `json:"form26q_due_at"`
	Section194CDeductedRupees int64                             `json:"section194c_deducted_rupees"`
	Section194JDeductedRupees int64                             `json:"section194j_deducted_rupees"`
	Section194JByProfessional []domain.TDSProfessionalDeduction `json:"section194j_by_professional"`
	CreatedAt                 string                            `json:"created_at"`
	UpdatedAt                 string                            `json:"updated_at"`
}

func toTDSFilingResponse(f *domain.TDSFiling) tdsFilingResponse {
	return tdsFilingResponse{
		ID:                        f.ID,
		ProjectID:                 f.ProjectID,
		PeriodYear:                f.PeriodYear,
		PeriodQuarter:             f.PeriodQuarter,
		Form26QStatus:             string(f.Form26QStatus),
		Form26QDueAt:              f.Form26QDueAt,
		Section194CDeductedRupees: f.Section194CDeductedRupees,
		Section194JDeductedRupees: f.Section194JDeductedRupees,
		Section194JByProfessional: f.Section194JByProfessional,
		CreatedAt:                 f.CreatedAt.Format(timeFormat),
		UpdatedAt:                 f.UpdatedAt.Format(timeFormat),
	}
}

func (h *TDSFilingHandler) Upsert(w http.ResponseWriter, r *http.Request) {
	projectID, err := uuid.Parse(r.PathValue("projectID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	var req upsertTDSFilingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	filing := &domain.TDSFiling{
		ProjectID:                 projectID,
		PeriodYear:                req.PeriodYear,
		PeriodQuarter:             req.PeriodQuarter,
		Form26QStatus:             domain.FilingStatus(req.Form26QStatus),
		Form26QDueAt:              req.Form26QDueAt,
		Section194CDeductedRupees: req.Section194CDeductedRupees,
		Section194JDeductedRupees: req.Section194JDeductedRupees,
		Section194JByProfessional: req.Section194JByProfessional,
	}
	actor := middleware.ActorFromContext(r.Context())
	if err := h.usecase.Upsert(r.Context(), actor, filing); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, toTDSFilingResponse(filing))
}

func (h *TDSFilingHandler) Get(w http.ResponseWriter, r *http.Request) {
	projectID, err := uuid.Parse(r.PathValue("projectID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	year, err1 := strconv.Atoi(r.PathValue("year"))
	quarter, err2 := strconv.Atoi(r.PathValue("quarter"))
	if err1 != nil || err2 != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	filing, err := h.usecase.GetByPeriod(r.Context(), projectID, int16(year), int16(quarter))
	if err != nil {
		writeNotFoundOrError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toTDSFilingResponse(filing))
}
