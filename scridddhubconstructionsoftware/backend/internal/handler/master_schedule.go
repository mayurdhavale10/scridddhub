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

type MasterScheduleHandler struct {
	usecase *usecase.MasterScheduleUsecase
}

func NewMasterScheduleHandler(u *usecase.MasterScheduleUsecase) *MasterScheduleHandler {
	return &MasterScheduleHandler{usecase: u}
}

// dateOnlyFormat matches the wireframe's month-precision dates ("Mar 2026") stored as the
// first of that month — plain "YYYY-MM-DD", not RFC3339, since there is no time-of-day here.
const dateOnlyFormat = "2006-01-02"

type createMilestoneRequest struct {
	MilestoneType string `json:"milestone_type"`
	Status        string `json:"status"`
	TargetDate    string `json:"target_date"`
}

type createMasterScheduleRequest struct {
	Milestones []createMilestoneRequest `json:"milestones"`
}

type updateMilestoneRequest struct {
	Status     string `json:"status"`
	TargetDate string `json:"target_date"`
}

type milestoneResponse struct {
	ID            uuid.UUID `json:"id"`
	MilestoneType string    `json:"milestone_type"`
	Status        string    `json:"status"`
	TargetDate    string    `json:"target_date"`
}

func toMilestoneResponse(m *domain.MasterScheduleMilestone) milestoneResponse {
	return milestoneResponse{
		ID:            m.ID,
		MilestoneType: string(m.MilestoneType),
		Status:        string(m.Status),
		TargetDate:    m.TargetDate.Format("2006-01-02"),
	}
}

type masterScheduleResponse struct {
	ID          uuid.UUID           `json:"id"`
	ProjectID   uuid.UUID           `json:"project_id"`
	ConfirmedAt *time.Time          `json:"confirmed_at"`
	Milestones  []milestoneResponse `json:"milestones"`
}

func (h *MasterScheduleHandler) Create(w http.ResponseWriter, r *http.Request) {
	projectID, err := uuid.Parse(r.PathValue("projectID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	var req createMasterScheduleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	schedule := &domain.MasterSchedule{ProjectID: projectID}
	milestones := make([]*domain.MasterScheduleMilestone, 0, len(req.Milestones))
	for _, m := range req.Milestones {
		targetDate, err := time.Parse(dateOnlyFormat, m.TargetDate)
		if err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}
		milestones = append(milestones, &domain.MasterScheduleMilestone{
			MilestoneType: domain.MasterScheduleMilestoneType(m.MilestoneType),
			Status:        domain.MasterScheduleMilestoneStatus(m.Status),
			TargetDate:    targetDate,
		})
	}
	actor := middleware.ActorFromContext(r.Context())
	if err := h.usecase.Create(r.Context(), actor, schedule, milestones); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	h.writeFullSchedule(w, r, schedule)
}

func (h *MasterScheduleHandler) GetByProject(w http.ResponseWriter, r *http.Request) {
	projectID, err := uuid.Parse(r.PathValue("projectID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	schedule, err := h.usecase.GetByProject(r.Context(), projectID)
	if err != nil {
		writeNotFoundOrError(w, err)
		return
	}
	h.writeFullSchedule(w, r, schedule)
}

func (h *MasterScheduleHandler) UpdateMilestone(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("milestoneID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	var req updateMilestoneRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	targetDate, err := time.Parse(dateOnlyFormat, req.TargetDate)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	actor := middleware.ActorFromContext(r.Context())
	m, err := h.usecase.UpdateMilestone(r.Context(), actor, id, domain.MasterScheduleMilestoneStatus(req.Status), targetDate)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, toMilestoneResponse(m))
}

func (h *MasterScheduleHandler) Confirm(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("scheduleID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	actor := middleware.ActorFromContext(r.Context())
	schedule, err := h.usecase.ConfirmSchedule(r.Context(), actor, id)
	if err != nil {
		writeNotFoundOrError(w, err)
		return
	}
	h.writeFullSchedule(w, r, schedule)
}

// writeFullSchedule assembles the schedule + all 5 fixed milestones into one response —
// Screen 11 always shows the whole timeline together.
func (h *MasterScheduleHandler) writeFullSchedule(w http.ResponseWriter, r *http.Request, schedule *domain.MasterSchedule) {
	milestones, err := h.usecase.ListMilestones(r.Context(), schedule.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	milestoneResponses := make([]milestoneResponse, 0, len(milestones))
	for _, m := range milestones {
		milestoneResponses = append(milestoneResponses, toMilestoneResponse(m))
	}
	writeJSON(w, http.StatusOK, masterScheduleResponse{
		ID:          schedule.ID,
		ProjectID:   schedule.ProjectID,
		ConfirmedAt: schedule.ConfirmedAt,
		Milestones:  milestoneResponses,
	})
}
