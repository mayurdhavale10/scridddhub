package handler

import (
	"encoding/json"
	"net/http"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
	"github.com/scridddhub/backend/internal/middleware"
	"github.com/scridddhub/backend/internal/usecase"
)

type ProjectHandler struct {
	usecase *usecase.ProjectUsecase
}

func NewProjectHandler(u *usecase.ProjectUsecase) *ProjectHandler {
	return &ProjectHandler{usecase: u}
}

type createProjectRequest struct {
	OrgID uuid.UUID `json:"org_id"`
	Name  string    `json:"name"`
	City  string    `json:"city"`
}

type projectResponse struct {
	ID        uuid.UUID `json:"id"`
	OrgID     uuid.UUID `json:"org_id"`
	Name      string    `json:"name"`
	City      string    `json:"city"`
	CreatedAt string    `json:"created_at"`
	UpdatedAt string    `json:"updated_at"`
}

func toProjectResponse(p *domain.Project) projectResponse {
	return projectResponse{
		ID:        p.ID,
		OrgID:     p.OrgID,
		Name:      p.Name,
		City:      p.City,
		CreatedAt: p.CreatedAt.Format(timeFormat),
		UpdatedAt: p.UpdatedAt.Format(timeFormat),
	}
}

func (h *ProjectHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req createProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	project := &domain.Project{OrgID: req.OrgID, Name: req.Name, City: req.City}
	actor := middleware.ActorFromContext(r.Context())
	if err := h.usecase.Create(r.Context(), actor, project); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	writeJSON(w, http.StatusCreated, toProjectResponse(project))
}

func (h *ProjectHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	project, err := h.usecase.Get(r.Context(), id)
	if err != nil {
		writeNotFoundOrError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, toProjectResponse(project))
}
