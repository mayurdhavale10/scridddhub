package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/scridddhub/backend/internal/domain"
	"github.com/scridddhub/backend/internal/usecase"
)

type AuditLogHandler struct {
	usecase *usecase.AuditLogUsecase
}

func NewAuditLogHandler(u *usecase.AuditLogUsecase) *AuditLogHandler {
	return &AuditLogHandler{usecase: u}
}

type auditLogEntryResponse struct {
	ID        int64           `json:"id"`
	TableName string          `json:"table_name"`
	RowID     string          `json:"row_id"`
	Action    string          `json:"action"`
	Actor     string          `json:"actor"`
	OldData   json.RawMessage `json:"old_data"`
	NewData   json.RawMessage `json:"new_data"`
	ChangedAt string          `json:"changed_at"`
}

func toAuditLogEntryResponse(e *domain.AuditLogEntry) auditLogEntryResponse {
	return auditLogEntryResponse{
		ID:        e.ID,
		TableName: e.TableName,
		RowID:     e.RowID.String(),
		Action:    e.Action,
		Actor:     e.Actor,
		OldData:   e.OldData,
		NewData:   e.NewData,
		ChangedAt: e.ChangedAt.Format(timeFormat),
	}
}

func (h *AuditLogHandler) ListRecent(w http.ResponseWriter, r *http.Request) {
	limit := 0
	if v := r.URL.Query().Get("limit"); v != "" {
		parsed, err := strconv.Atoi(v)
		if err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}
		limit = parsed
	}
	entries, err := h.usecase.ListRecent(r.Context(), limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	responses := make([]auditLogEntryResponse, 0, len(entries))
	for _, e := range entries {
		responses = append(responses, toAuditLogEntryResponse(e))
	}
	writeJSON(w, http.StatusOK, responses)
}
