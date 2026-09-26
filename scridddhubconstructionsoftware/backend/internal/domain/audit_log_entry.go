package domain

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// AuditLogEntry (Screen 8.11) — a read-only projection of the append-only audit_log table
// written by writeAudit (ADR-0002). No new table: "the record buyers, auditors and tribunals
// can actually trust" is the existing log, not a new domain concept.
//
// The "cannot be disabled" guarantee this screen advertises is a real architecture commitment —
// append-only storage, no admin delete path, no UPDATE/DELETE grant on the table at the DB role
// level — not something this read-only screen enforces by itself.
type AuditLogEntry struct {
	ID        int64
	TableName string
	RowID     uuid.UUID
	Action    string
	Actor     string
	OldData   json.RawMessage
	NewData   json.RawMessage
	ChangedAt time.Time
}
