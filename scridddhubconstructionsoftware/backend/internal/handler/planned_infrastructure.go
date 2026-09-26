package handler

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
	"github.com/scridddhub/backend/internal/usecase"
)

type PlannedInfrastructureHandler struct {
	usecase *usecase.PlannedInfrastructureUsecase
}

func NewPlannedInfrastructureHandler(u *usecase.PlannedInfrastructureUsecase) *PlannedInfrastructureHandler {
	return &PlannedInfrastructureHandler{usecase: u}
}

type resolvedLocation struct {
	DisplayName  string  `json:"display_name"`
	MatchedQuery string  `json:"matched_query"`
	Latitude     float64 `json:"latitude"`
	Longitude    float64 `json:"longitude"`
}

type nearestPoint struct {
	Label       string `json:"label"`
	Kind        string `json:"kind"`
	CoordSource string `json:"coord_source"`
}

type plannedInfrastructureItem struct {
	ProjectID          string        `json:"project_id"`
	Name               string        `json:"name"`
	Kind               string        `json:"kind"`
	Status             string        `json:"status"`
	ExpectedCompletion string        `json:"expected_completion"`
	Description        string        `json:"description"`
	MatchBasis         string        `json:"match_basis"`
	DistanceKm         *float64      `json:"distance_km"`
	NearestPoint       *nearestPoint `json:"nearest_point"`
	AreaNote           string        `json:"area_note"`
	SourceName         string        `json:"source_name"`
	SourceURL          string        `json:"source_url"`
	VerifiedAt         string        `json:"verified_at"`
	VerifiedBy         string        `json:"verified_by"`
}

type plannedInfrastructureResponse struct {
	Location *resolvedLocation           `json:"location"`
	RadiusKm float64                     `json:"radius_km"`
	Items    []plannedInfrastructureItem `json:"items"`
}

func (h *PlannedInfrastructureHandler) ForParcel(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("parcelID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	res, err := h.usecase.ForParcel(r.Context(), id)
	if err != nil {
		writeNotFoundOrError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toPlannedInfrastructureResponse(res))
}

// ForLocation answers "what's planned near this location?" before any parcel exists — e.g. while
// someone is still deciding whether a property is worth adding.
func (h *PlannedInfrastructureHandler) ForLocation(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	place := domain.PropertyLocation{Text: q.Get("location")}
	if d, t := q.Get("district"), q.Get("taluka"); d != "" && t != "" {
		place.District, place.Taluka = &d, &t
	}
	if place.Text == "" {
		writeError(w, http.StatusBadRequest, errMissingQuery("location"))
		return
	}
	res, err := h.usecase.ForLocation(r.Context(), place)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, toPlannedInfrastructureResponse(res))
}

func toPlannedInfrastructureResponse(res *usecase.PlannedInfrastructureResult) plannedInfrastructureResponse {
	resp := plannedInfrastructureResponse{
		RadiusKm: res.RadiusKm,
		Items:    make([]plannedInfrastructureItem, 0, len(res.Matches)),
	}
	if res.Location != nil {
		resp.Location = &resolvedLocation{
			DisplayName:  res.Location.DisplayName,
			MatchedQuery: res.Location.MatchedQuery,
			Latitude:     res.Location.Point.Latitude,
			Longitude:    res.Location.Point.Longitude,
		}
	}
	for _, m := range res.Matches {
		p := m.Project
		item := plannedInfrastructureItem{
			ProjectID:          p.ID.String(),
			Name:               p.Name,
			Kind:               p.Kind,
			Status:             p.Status,
			ExpectedCompletion: p.ExpectedCompletion,
			Description:        p.Description,
			MatchBasis:         m.MatchBasis,
			DistanceKm:         m.DistanceKm,
			AreaNote:           m.AreaNote,
			SourceName:         p.SourceName,
			SourceURL:          p.SourceURL,
			VerifiedAt:         p.VerifiedAt.Format(timeFormat),
			VerifiedBy:         p.VerifiedBy,
		}
		if m.NearestPoint != nil {
			item.NearestPoint = &nearestPoint{Label: m.NearestPoint.Label, Kind: m.NearestPoint.Kind, CoordSource: m.NearestPoint.CoordSource}
		}
		resp.Items = append(resp.Items, item)
	}
	return resp
}
