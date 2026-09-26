package domain

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

type TenureType string

const (
	TenureTypeOutright TenureType = "outright"
	TenureTypeJDA      TenureType = "jda"
)

func (t TenureType) Valid() bool {
	return t == TenureTypeOutright || t == TenureTypeJDA
}

// LandTenure governs FinancialStructure (Screen 8) per docs/domain-model.md — the JDA fields
// only apply when TenureType is jda; nil/zero otherwise. Scoped to Project (see migration
// 000009's comment on why, not LandParcel like the previous four entities).
type LandTenure struct {
	ID         uuid.UUID
	ProjectID  uuid.UUID
	TenureType TenureType

	JDAModel                        string
	DeveloperAreaSharePct           *float64
	CashOnTopOfShare                *bool
	RefundableSecurityDepositRupees *int64
	JDAStampDutyRupees              *int64
	GSTReverseChargeApplicable      *bool
	LandownerIsCoPromoter           *bool

	CreatedAt time.Time
	UpdatedAt time.Time
}

// LandownerAreaSharePct is derived, never stored separately — the wireframe shows a paired
// "62 : 38" value; storing both halves independently would let them silently drift apart.
func (t *LandTenure) LandownerAreaSharePct() *float64 {
	if t.DeveloperAreaSharePct == nil {
		return nil
	}
	landowner := 100 - *t.DeveloperAreaSharePct
	return &landowner
}

func (t *LandTenure) Validate() error {
	if t.ProjectID == uuid.Nil {
		return fmt.Errorf("project_id is required")
	}
	if !t.TenureType.Valid() {
		return fmt.Errorf("invalid tenure_type: %q", t.TenureType)
	}
	if t.TenureType == TenureTypeJDA && t.DeveloperAreaSharePct == nil {
		return fmt.Errorf("developer_area_share_pct is required for a JDA tenure")
	}
	return nil
}
