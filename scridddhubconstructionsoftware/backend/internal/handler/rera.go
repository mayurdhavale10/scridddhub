package handler

import (
	"errors"
	"net/http"
	"strings"

	"github.com/scridddhub/backend/internal/domain"
	"github.com/scridddhub/backend/internal/usecase"
)

type RERAHandler struct {
	usecase *usecase.RERAUsecase
}

func NewRERAHandler(u *usecase.RERAUsecase) *RERAHandler {
	return &RERAHandler{usecase: u}
}

type reraPromoterMatchResponse struct {
	PromoterName string `json:"promoter_name"`
	Projects     int    `json:"projects"`
}

type reraProjectResponse struct {
	RegistrationNumber string  `json:"registration_number"`
	ProjectName        string  `json:"project_name"`
	Location           string  `json:"location"`
	District           string  `json:"district"`
	Pincode            string  `json:"pincode"`
	LastModified       *string `json:"last_modified"`
	HasExtension       bool    `json:"has_extension"`
	DetailsURL         string  `json:"details_url"`
}

type reraHistoryResponse struct {
	PromoterName   string                `json:"promoter_name"`
	Projects       []reraProjectResponse `json:"projects"`
	WithExtension  int                   `json:"with_extension"`
	ProjectsTotal  bool                  `json:"projects_complete"`
	Complaints     *int                  `json:"complaints"`
	ProjectsAsOf   *string               `json:"projects_as_of"`
	ComplaintsAsOf *string               `json:"complaints_as_of"`
}

// SearchPromoters handles GET /rera/promoters?q=: promoter names in collected MahaRERA records.
func (h *RERAHandler) SearchPromoters(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if len([]rune(q)) < 3 {
		writeJSON(w, http.StatusOK, []reraPromoterMatchResponse{})
		return
	}
	matches, err := h.usecase.SearchPromoters(r.Context(), q)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	out := make([]reraPromoterMatchResponse, 0, len(matches))
	for _, m := range matches {
		out = append(out, reraPromoterMatchResponse{PromoterName: m.PromoterName, Projects: m.Projects})
	}
	writeJSON(w, http.StatusOK, out)
}

// History handles GET /rera/promoters/history?name=: the promoter's projects and complaints.
func (h *RERAHandler) History(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimSpace(r.URL.Query().Get("name"))
	if name == "" {
		writeError(w, http.StatusBadRequest, errors.New("name is required"))
		return
	}
	hist, err := h.usecase.History(r.Context(), name)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, toRERAHistoryResponse(hist))
}

func dateString(t interface{ Format(string) string }) *string {
	s := t.Format("2006-01-02")
	return &s
}

func toRERAHistoryResponse(h *domain.RERASellerHistory) reraHistoryResponse {
	resp := reraHistoryResponse{
		PromoterName:  h.PromoterName,
		Projects:      make([]reraProjectResponse, 0, len(h.Projects)),
		WithExtension: h.WithExtension,
		ProjectsTotal: h.ProjectsComplete,
		Complaints:    h.Complaints,
	}
	if h.ProjectsAsOf != nil {
		resp.ProjectsAsOf = dateString(h.ProjectsAsOf)
	}
	if h.ComplaintsAsOf != nil {
		resp.ComplaintsAsOf = dateString(h.ComplaintsAsOf)
	}
	for _, p := range h.Projects {
		pr := reraProjectResponse{
			RegistrationNumber: p.RegistrationNumber,
			ProjectName:        p.ProjectName,
			Location:           p.Location,
			District:           p.District,
			Pincode:            p.Pincode,
			HasExtension:       p.HasExtension,
			DetailsURL:         p.DetailsURL,
		}
		if p.LastModified != nil {
			pr.LastModified = dateString(p.LastModified)
		}
		resp.Projects = append(resp.Projects, pr)
	}
	return resp
}
