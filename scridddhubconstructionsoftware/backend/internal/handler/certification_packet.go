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

type CertificationPacketHandler struct {
	usecase *usecase.CertificationPacketUsecase
}

func NewCertificationPacketHandler(u *usecase.CertificationPacketUsecase) *CertificationPacketHandler {
	return &CertificationPacketHandler{usecase: u}
}

type createPacketRequest struct {
	PeriodYear    int16 `json:"period_year"`
	PeriodQuarter int16 `json:"period_quarter"`
}

type engineerDraftResponse struct {
	ID                          uuid.UUID          `json:"id"`
	CostByTower                 []domain.TowerCost `json:"cost_by_tower"`
	TotalIncurredRupees         int64              `json:"total_incurred_rupees"`
	CommittedNotReflectedRupees *int64             `json:"committed_not_reflected_rupees"`
	SourceNote                  string             `json:"source_note"`
	Status                      domain.DraftStatus `json:"status"`
	SignedBy                    string             `json:"signed_by"`
	SignedAt                    *time.Time         `json:"signed_at"`
}

type architectCertificateResponse struct {
	ID                   uuid.UUID                         `json:"id"`
	CompletionPct        *float64                          `json:"completion_pct"`
	SiteVisitScheduledAt *time.Time                        `json:"site_visit_scheduled_at"`
	SiteVisitCompletedAt *time.Time                        `json:"site_visit_completed_at"`
	Status               domain.ArchitectCertificateStatus `json:"status"`
	SignedBy             string                            `json:"signed_by"`
	SignedAt             *time.Time                        `json:"signed_at"`
}

type caDraftResponse struct {
	ID                           uuid.UUID          `json:"id"`
	CollectedFromBuyersRupees    int64              `json:"collected_from_buyers_rupees"`
	RequiredEscrowPct            float64            `json:"required_escrow_pct"`
	RequiredToEscrowRupees       int64              `json:"required_to_escrow_rupees"`
	ActuallyRoutedToEscrowRupees int64              `json:"actually_routed_to_escrow_rupees"`
	RoutingCompliant             bool               `json:"routing_compliant"`
	SourceNote                   string             `json:"source_note"`
	Status                       domain.DraftStatus `json:"status"`
	SignedBy                     string             `json:"signed_by"`
	SignedAt                     *time.Time         `json:"signed_at"`
}

type certificationPacketResponse struct {
	ID                    uuid.UUID                    `json:"id"`
	ProjectID             uuid.UUID                    `json:"project_id"`
	PeriodYear            int16                        `json:"period_year"`
	PeriodQuarter         int16                        `json:"period_quarter"`
	SentToProfessionalsAt *time.Time                   `json:"sent_to_professionals_at"`
	EngineerDraft         engineerDraftResponse        `json:"engineer_draft"`
	ArchitectCertificate  architectCertificateResponse `json:"architect_certificate"`
	CADraft               caDraftResponse              `json:"ca_draft"`
	WithdrawalEligible    bool                         `json:"withdrawal_eligible"`
}

func (h *CertificationPacketHandler) Create(w http.ResponseWriter, r *http.Request) {
	projectID, err := uuid.Parse(r.PathValue("projectID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	var req createPacketRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	packet := &domain.CertificationPacket{ProjectID: projectID, PeriodYear: req.PeriodYear, PeriodQuarter: req.PeriodQuarter}
	actor := middleware.ActorFromContext(r.Context())
	if err := h.usecase.CreatePacket(r.Context(), actor, packet); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	h.writeFullPacket(w, r, packet.ID)
}

func (h *CertificationPacketHandler) Get(w http.ResponseWriter, r *http.Request) {
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

	packet, err := h.usecase.GetPacket(r.Context(), projectID, int16(year), int16(quarter))
	if err != nil {
		writeNotFoundOrError(w, err)
		return
	}

	h.writeFullPacket(w, r, packet.ID)
}

func (h *CertificationPacketHandler) SendToProfessionals(w http.ResponseWriter, r *http.Request) {
	packetID, err := uuid.Parse(r.PathValue("packetID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	actor := middleware.ActorFromContext(r.Context())
	if _, err := h.usecase.SendToProfessionals(r.Context(), actor, packetID); err != nil {
		writeNotFoundOrError(w, err)
		return
	}
	h.writeFullPacket(w, r, packetID)
}

type upsertEngineerDraftRequest struct {
	CostByTower                 []domain.TowerCost `json:"cost_by_tower"`
	CommittedNotReflectedRupees *int64             `json:"committed_not_reflected_rupees"`
	SourceNote                  string             `json:"source_note"`
}

func (h *CertificationPacketHandler) UpsertEngineerDraft(w http.ResponseWriter, r *http.Request) {
	packetID, err := uuid.Parse(r.PathValue("packetID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	var req upsertEngineerDraftRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	actor := middleware.ActorFromContext(r.Context())
	draft := &domain.EngineerDraft{
		CertificationPacketID:       packetID,
		CostByTower:                 req.CostByTower,
		CommittedNotReflectedRupees: req.CommittedNotReflectedRupees,
		SourceNote:                  req.SourceNote,
	}
	if err := h.usecase.UpsertEngineerDraft(r.Context(), actor, draft); err != nil {
		writeNotFoundOrError(w, err)
		return
	}
	h.writeFullPacket(w, r, packetID)
}

type signRequest struct {
	SignedBy string `json:"signed_by"`
}

func (h *CertificationPacketHandler) SignEngineerDraft(w http.ResponseWriter, r *http.Request) {
	packetID, err := uuid.Parse(r.PathValue("packetID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	var req signRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	actor := middleware.ActorFromContext(r.Context())
	if _, err := h.usecase.SignEngineerDraft(r.Context(), actor, packetID, req.SignedBy); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	h.writeFullPacket(w, r, packetID)
}

func (h *CertificationPacketHandler) ScheduleSiteVisit(w http.ResponseWriter, r *http.Request) {
	packetID, err := uuid.Parse(r.PathValue("packetID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	actor := middleware.ActorFromContext(r.Context())
	if _, err := h.usecase.ScheduleSiteVisit(r.Context(), actor, packetID, time.Now()); err != nil {
		writeNotFoundOrError(w, err)
		return
	}
	h.writeFullPacket(w, r, packetID)
}

func (h *CertificationPacketHandler) CompleteSiteVisit(w http.ResponseWriter, r *http.Request) {
	packetID, err := uuid.Parse(r.PathValue("packetID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	actor := middleware.ActorFromContext(r.Context())
	if _, err := h.usecase.CompleteSiteVisit(r.Context(), actor, packetID, time.Now()); err != nil {
		writeNotFoundOrError(w, err)
		return
	}
	h.writeFullPacket(w, r, packetID)
}

type certifyArchitectRequest struct {
	CompletionPct float64 `json:"completion_pct"`
	SignedBy      string  `json:"signed_by"`
}

func (h *CertificationPacketHandler) CertifyArchitect(w http.ResponseWriter, r *http.Request) {
	packetID, err := uuid.Parse(r.PathValue("packetID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	var req certifyArchitectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	actor := middleware.ActorFromContext(r.Context())
	if _, err := h.usecase.CertifyArchitect(r.Context(), actor, packetID, req.CompletionPct, req.SignedBy); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	h.writeFullPacket(w, r, packetID)
}

type upsertCADraftRequest struct {
	CollectedFromBuyersRupees    int64   `json:"collected_from_buyers_rupees"`
	RequiredEscrowPct            float64 `json:"required_escrow_pct"`
	ActuallyRoutedToEscrowRupees int64   `json:"actually_routed_to_escrow_rupees"`
	SourceNote                   string  `json:"source_note"`
}

func (h *CertificationPacketHandler) UpsertCADraft(w http.ResponseWriter, r *http.Request) {
	packetID, err := uuid.Parse(r.PathValue("packetID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	var req upsertCADraftRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	actor := middleware.ActorFromContext(r.Context())
	draft := &domain.CADraft{
		CertificationPacketID:        packetID,
		CollectedFromBuyersRupees:    req.CollectedFromBuyersRupees,
		RequiredEscrowPct:            req.RequiredEscrowPct,
		ActuallyRoutedToEscrowRupees: req.ActuallyRoutedToEscrowRupees,
		SourceNote:                   req.SourceNote,
	}
	if err := h.usecase.UpsertCADraft(r.Context(), actor, draft); err != nil {
		writeNotFoundOrError(w, err)
		return
	}
	h.writeFullPacket(w, r, packetID)
}

func (h *CertificationPacketHandler) SignCADraft(w http.ResponseWriter, r *http.Request) {
	packetID, err := uuid.Parse(r.PathValue("packetID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	var req signRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	actor := middleware.ActorFromContext(r.Context())
	if _, err := h.usecase.SignCADraft(r.Context(), actor, packetID, req.SignedBy); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	h.writeFullPacket(w, r, packetID)
}

// writeFullPacket assembles the packet + all 3 sub-drafts + computed cross-entity values into
// one response — Screen 8.4 always shows all of them together.
func (h *CertificationPacketHandler) writeFullPacket(w http.ResponseWriter, r *http.Request, packetID uuid.UUID) {
	packet, err := h.usecase.GetPacketByID(r.Context(), packetID)
	if err != nil {
		writeNotFoundOrError(w, err)
		return
	}
	eng, err := h.usecase.GetEngineerDraft(r.Context(), packetID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	arch, err := h.usecase.GetArchitectCertificate(r.Context(), packetID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	ca, err := h.usecase.GetCADraft(r.Context(), packetID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}

	writeJSON(w, http.StatusOK, certificationPacketResponse{
		ID:                    packet.ID,
		ProjectID:             packet.ProjectID,
		PeriodYear:            packet.PeriodYear,
		PeriodQuarter:         packet.PeriodQuarter,
		SentToProfessionalsAt: packet.SentToProfessionalsAt,
		EngineerDraft: engineerDraftResponse{
			ID:                          eng.ID,
			CostByTower:                 eng.CostByTower,
			TotalIncurredRupees:         eng.TotalIncurredRupees(),
			CommittedNotReflectedRupees: eng.CommittedNotReflectedRupees,
			SourceNote:                  eng.SourceNote,
			Status:                      eng.Status,
			SignedBy:                    eng.SignedBy,
			SignedAt:                    eng.SignedAt,
		},
		ArchitectCertificate: architectCertificateResponse{
			ID:                   arch.ID,
			CompletionPct:        arch.CompletionPct,
			SiteVisitScheduledAt: arch.SiteVisitScheduledAt,
			SiteVisitCompletedAt: arch.SiteVisitCompletedAt,
			Status:               arch.Status,
			SignedBy:             arch.SignedBy,
			SignedAt:             arch.SignedAt,
		},
		CADraft: caDraftResponse{
			ID:                           ca.ID,
			CollectedFromBuyersRupees:    ca.CollectedFromBuyersRupees,
			RequiredEscrowPct:            ca.RequiredEscrowPct,
			RequiredToEscrowRupees:       ca.RequiredToEscrowRupees(),
			ActuallyRoutedToEscrowRupees: ca.ActuallyRoutedToEscrowRupees,
			RoutingCompliant:             ca.RoutingCompliant(),
			SourceNote:                   ca.SourceNote,
			Status:                       ca.Status,
			SignedBy:                     ca.SignedBy,
			SignedAt:                     ca.SignedAt,
		},
		WithdrawalEligible: usecase.WithdrawalEligible(arch),
	})
}
