package domain

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

type ConnectionStatus string

const (
	ConnectionStatusConnected    ConnectionStatus = "connected"
	ConnectionStatusNotConnected ConnectionStatus = "not_connected"
)

// SystemConnection is one row in AccountingSync.Connections (e.g. "Tally ERP / Tally Prime",
// "GSTR-2B", "Zoho Books").
type SystemConnection struct {
	SystemName string           `json:"system_name"`
	Status     ConnectionStatus `json:"status"`
}

// AccountingSync (Screen 8.12) — "one ledger, not two versions of the truth." Every voucher
// pushed/pulled through a real sync would itself be a write through this same repository, so it
// gets the standard audit_log row for free (ADR-0002) — no special-casing needed for the "sync
// isn't exempt from the audit trail" requirement the screen states explicitly.
type AccountingSync struct {
	ID                       uuid.UUID
	ProjectID                uuid.UUID
	Connections              []SystemConnection
	LastSyncAt               *time.Time
	LastSyncVouchersPosted   *int
	LastSyncVouchersRejected *int
	CreatedAt                time.Time
	UpdatedAt                time.Time
}

func (s *AccountingSync) Validate() error {
	if s.ProjectID == uuid.Nil {
		return fmt.Errorf("project_id is required")
	}
	return nil
}
