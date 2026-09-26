package domain

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

type FilingStatus string

const (
	FilingStatusNotStarted FilingStatus = "not_started"
	FilingStatusDraft      FilingStatus = "draft"
	FilingStatusFiled      FilingStatus = "filed"
)

// GSTFiling (Screen 8.14) — same "AI drafts, licensed professional files" discipline as the 8.4
// certification family: this prepares and reconciles the return data and the Rule 42/43 reversal
// calculation for review. The actual GSTN filing action is the CA/GST practitioner's.
type GSTFiling struct {
	ID            uuid.UUID
	ProjectID     uuid.UUID
	PeriodYear    int16
	PeriodQuarter int16

	GSTR1Status    FilingStatus
	GSTR1FiledLate *bool
	GSTR3BStatus   FilingStatus
	GSTR3BDueAt    *time.Time

	ITCClaimedRupees        int64
	ExemptTurnoverRatioPct  *float64
	CommonITCReversalRupees *int64

	CreatedAt time.Time
	UpdatedAt time.Time
}

func (f *GSTFiling) Validate() error {
	if f.ProjectID == uuid.Nil {
		return fmt.Errorf("project_id is required")
	}
	if f.PeriodQuarter < 1 || f.PeriodQuarter > 4 {
		return fmt.Errorf("period_quarter must be 1-4")
	}
	return nil
}

type TDSDepositStatus string

const (
	TDSDepositStatusDeposited      TDSDepositStatus = "deposited"
	TDSDepositStatusPendingDeposit TDSDepositStatus = "pending_deposit"
)

// TDSProfessionalDeduction is one 194J deduction line (Screen 8.15 "194J — by professional").
// 194C stays an aggregate only — per-contractor detail lives on the not-yet-built Screen 15.
type TDSProfessionalDeduction struct {
	PayeeName     string           `json:"payee_name"`
	AmountRupees  int64            `json:"amount_rupees"`
	DepositStatus TDSDepositStatus `json:"deposit_status"`
	DepositDueAt  *time.Time       `json:"deposit_due_at"`
}

// TDSFiling (Screen 8.15) — deducting tax is not the same as depositing/filing it; per-bill
// deduction still lives on Screen 15, this rolls it up to the quarterly Form 26Q return and
// tracks it through to actual deposit. Same "prepares, doesn't file" honest limit as GSTFiling.
type TDSFiling struct {
	ID            uuid.UUID
	ProjectID     uuid.UUID
	PeriodYear    int16
	PeriodQuarter int16

	Form26QStatus             FilingStatus
	Form26QDueAt              *time.Time
	Section194CDeductedRupees int64
	Section194JDeductedRupees int64
	Section194JByProfessional []TDSProfessionalDeduction

	CreatedAt time.Time
	UpdatedAt time.Time
}

func (f *TDSFiling) Validate() error {
	if f.ProjectID == uuid.Nil {
		return fmt.Errorf("project_id is required")
	}
	if f.PeriodQuarter < 1 || f.PeriodQuarter > 4 {
		return fmt.Errorf("period_quarter must be 1-4")
	}
	return nil
}
