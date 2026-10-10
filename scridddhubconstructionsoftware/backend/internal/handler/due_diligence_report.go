package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
	"github.com/scridddhub/backend/internal/middleware"
	"github.com/scridddhub/backend/internal/reportpdf"
	"github.com/scridddhub/backend/internal/usecase"
)

type DueDiligenceReportHandler struct {
	usecase *usecase.DueDiligenceReportUsecase
}

func NewDueDiligenceReportHandler(u *usecase.DueDiligenceReportUsecase) *DueDiligenceReportHandler {
	return &DueDiligenceReportHandler{usecase: u}
}

type reportSummary struct {
	ID           uuid.UUID `json:"id"`
	LandParcelID uuid.UUID `json:"land_parcel_id"`
	Tier         string    `json:"tier"`
	Status       string    `json:"status"`
	OpenItems    []string  `json:"open_items"`
	Verdict      string    `json:"verdict,omitempty"`
	CreatedAt    string    `json:"created_at"`
	FinalisedAt  *string   `json:"finalised_at,omitempty"`
}

type reportDetail struct {
	reportSummary
	Sections *usecase.ReportSections `json:"sections"`
}

func toReportSummary(r *domain.DueDiligenceReport) reportSummary {
	s := reportSummary{ID: r.ID, LandParcelID: r.LandParcelID, Tier: r.Tier, Status: r.Status,
		OpenItems: r.OpenItems(), Verdict: r.Verdict, CreatedAt: r.CreatedAt.Format(timeFormat)}
	if s.OpenItems == nil || r.Final() {
		s.OpenItems = []string{}
	}
	if r.FinalisedAt != nil {
		f := r.FinalisedAt.Format(timeFormat)
		s.FinalisedAt = &f
	}
	return s
}

func writeReportError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, domain.ErrReportFinalised):
		writeError(w, http.StatusConflict, err)
	case errors.Is(err, domain.ErrReportNotReady):
		writeError(w, http.StatusUnprocessableEntity, err)
	default:
		writeNotFoundOrError(w, err)
	}
}

// Create handles POST /land-parcels/{parcelID}/reports with {"tier": "quick"|"full"}.
func (h *DueDiligenceReportHandler) Create(w http.ResponseWriter, r *http.Request) {
	parcelID, err := uuid.Parse(r.PathValue("parcelID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	var req struct {
		Tier string `json:"tier"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	rep, err := h.usecase.Create(r.Context(), middleware.ActorFromContext(r.Context()), parcelID, req.Tier)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) || errors.Is(err, domain.ErrReportNotReady) {
			writeReportError(w, err)
			return
		}
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusCreated, toReportSummary(rep))
}

// List handles GET /land-parcels/{parcelID}/reports, newest first.
func (h *DueDiligenceReportHandler) List(w http.ResponseWriter, r *http.Request) {
	parcelID, err := uuid.Parse(r.PathValue("parcelID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	list, err := h.usecase.List(r.Context(), parcelID)
	if err != nil {
		writeNotFoundOrError(w, err)
		return
	}
	out := make([]reportSummary, 0, len(list))
	for _, rep := range list {
		out = append(out, toReportSummary(rep))
	}
	writeJSON(w, http.StatusOK, out)
}

// Get handles GET /reports/{reportID}: the report with all its sections.
func (h *DueDiligenceReportHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("reportID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	rep, sections, err := h.usecase.Get(r.Context(), id)
	if err != nil {
		writeReportError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, reportDetail{reportSummary: toReportSummary(rep), Sections: sections})
}

type reportEditsRequest struct {
	OccupancyClass    string   `json:"occupancy_class"`
	NAStatus          string   `json:"na_status"`
	TenancyRemarks    string   `json:"tenancy_remarks"`
	CRZForestESZ      string   `json:"crz_forest_esz"`
	DPZone            string   `json:"dp_zone"`
	DPReservation     string   `json:"dp_reservation"`
	BaseFSI           *float64 `json:"base_fsi"`
	MaxFSI            *float64 `json:"max_fsi"`
	PlanningAuthority string   `json:"planning_authority"`
	RoadWidthM        *float64 `json:"road_width_m"`
	DevelopmentNote   string   `json:"development_note"`
	Verdict           string   `json:"verdict"`
	VerdictSummary    string   `json:"verdict_summary"`
	FixList           []string `json:"fix_list"`
}

// Update handles PUT /reports/{reportID}: saves sections D, E and H on a draft.
func (h *DueDiligenceReportHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("reportID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	var req reportEditsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	rep, err := h.usecase.Update(r.Context(), middleware.ActorFromContext(r.Context()), id, usecase.ReportEdits{
		OccupancyClass: req.OccupancyClass, NAStatus: req.NAStatus, TenancyRemarks: req.TenancyRemarks,
		CRZForestESZ: req.CRZForestESZ, DPZone: req.DPZone, DPReservation: req.DPReservation,
		BaseFSI: req.BaseFSI, MaxFSI: req.MaxFSI, DevelopmentNote: req.DevelopmentNote,
		PlanningAuthority: req.PlanningAuthority, RoadWidthM: req.RoadWidthM,
		Verdict: req.Verdict, VerdictSummary: req.VerdictSummary, FixList: req.FixList,
	})
	if err != nil {
		if errors.Is(err, domain.ErrReportFinalised) || errors.Is(err, domain.ErrNotFound) {
			writeReportError(w, err)
			return
		}
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, toReportSummary(rep))
}

// DraftVerdict handles POST /reports/{reportID}/draft-verdict: the AI drafts section H.
func (h *DueDiligenceReportHandler) DraftVerdict(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("reportID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	rep, err := h.usecase.DraftVerdict(r.Context(), middleware.ActorFromContext(r.Context()), id)
	if err != nil {
		writeReportError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toReportSummary(rep))
}

// Document handles GET /reports/{reportID}/pdf: the report as an A4 PDF a builder can forward
// (?format=html returns the same page as HTML). A draft is watermarked DRAFT and lists what's
// still open; a signed or issued report is printed from its frozen copy.
func (h *DueDiligenceReportHandler) Document(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("reportID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	rep, sections, err := h.usecase.Get(r.Context(), id)
	if err != nil {
		writeReportError(w, err)
		return
	}
	page, err := reportpdf.HTML(reportpdf.Document{
		ReportID: rep.ID.String()[:8], Tier: rep.Tier, Status: rep.Status, FinalisedAt: rep.FinalisedAt,
		OpenItems: rep.OpenItems(), Sections: sections, GeneratedAt: time.Now(),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	if r.URL.Query().Get("format") == "html" {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write(page)
		return
	}
	pdf, err := reportpdf.PDF(r.Context(), page)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	name := "due-diligence-" + strings.ReplaceAll(strings.ToLower(sections.ParcelName), " ", "-") + ".pdf"
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", `inline; filename="`+safeFilename(name)+`"`)
	w.Write(pdf)
}

// safeFilename keeps letters, digits, dots and dashes so the header can't be broken.
func safeFilename(s string) string {
	var b strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '.' || r == '-' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// Finalise handles POST /reports/{reportID}/finalise: signs a Full report (advocate name and
// enrolment required) or issues a Quick Screen, and freezes it.
func (h *DueDiligenceReportHandler) Finalise(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("reportID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	var req struct {
		AdvocateName      string `json:"advocate_name"`
		AdvocateEnrolment string `json:"advocate_enrolment"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	rep, err := h.usecase.Finalise(r.Context(), middleware.ActorFromContext(r.Context()), id, req.AdvocateName, req.AdvocateEnrolment)
	if err != nil {
		writeReportError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toReportSummary(rep))
}
