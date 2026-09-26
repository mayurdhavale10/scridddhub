package domain

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

// EscrowAccount deliberately has two independently-written balances — see migration
// 000011's comment. BankBalanceRupees must never be set from a request that only carries the
// developer's own claim (non-negotiable constraint, docs/domain-model.md).
type EscrowAccount struct {
	ID        uuid.UUID
	ProjectID uuid.UUID

	BankBalanceRupees *int64
	BankSourceName    string
	BankSyncedAt      *time.Time

	DeveloperLedgerBalanceRupees *int64

	CreatedAt time.Time
	UpdatedAt time.Time
}

// Mismatch reports whether the bank-verified and developer-reported balances disagree — computed
// at read time, never stored, and never silently reconciled either direction (Screen 8.10: "a
// mismatch is a reason to ask, immediately, not a footnote").
func (e *EscrowAccount) Mismatch() bool {
	if e.BankBalanceRupees == nil || e.DeveloperLedgerBalanceRupees == nil {
		return false
	}
	return *e.BankBalanceRupees != *e.DeveloperLedgerBalanceRupees
}

func (e *EscrowAccount) Validate() error {
	if e.ProjectID == uuid.Nil {
		return fmt.Errorf("project_id is required")
	}
	return nil
}
