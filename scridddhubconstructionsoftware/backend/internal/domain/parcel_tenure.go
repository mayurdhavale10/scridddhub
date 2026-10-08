package domain

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

// JDA models (Screen 8.9). Area sharing: the landowner gets a share of the built flats.
// Revenue sharing: the landowner gets a share of sales revenue. Deposit plus share: area sharing
// with a security deposit paid to the landowner up front.
const (
	JDAModelAreaSharing      = "area_sharing"
	JDAModelRevenueSharing   = "revenue_sharing"
	JDAModelDepositPlusShare = "deposit_plus_share"
)

// ParcelTenure is how the land in one deal is acquired: bought outright, or under a Joint
// Development Agreement with its owner. Per parcel, because a JDA is signed with that land's
// owner (owner decision, 2026-10-03). Fields for the other tenure type are cleared on save.
type ParcelTenure struct {
	ID           uuid.UUID
	LandParcelID uuid.UUID
	TenureType   TenureType

	PurchasePriceRupees     *int64
	PurchaseStampDutyRupees *int64

	JDAModel                   string
	DeveloperAreaSharePct      *float64
	LandownerRevenueSharePct   *float64
	CashOnTopOfShare           *bool
	SecurityDepositRupees      *int64
	DepositRefundable          *bool
	JDAStampDutyRupees         *int64
	GSTReverseChargeApplicable *bool
	LandownerIsCoPromoter      *bool

	CreatedAt time.Time
	UpdatedAt time.Time
}

// LandownerAreaSharePct is derived from the developer's share so the pair can never drift apart.
func (t *ParcelTenure) LandownerAreaSharePct() *float64 {
	if t.DeveloperAreaSharePct == nil {
		return nil
	}
	v := 100 - *t.DeveloperAreaSharePct
	return &v
}

func validPct(p *float64) bool { return p != nil && *p > 0 && *p < 100 }

// Validate checks the terms make sense for the chosen tenure and clears the fields that belong
// to the other one, so a parcel switched from JDA to outright doesn't keep stale JDA terms.
func (t *ParcelTenure) Validate() error {
	if t.LandParcelID == uuid.Nil {
		return fmt.Errorf("land_parcel_id is required")
	}
	switch t.TenureType {
	case TenureTypeOutright:
		t.JDAModel = ""
		t.DeveloperAreaSharePct, t.LandownerRevenueSharePct = nil, nil
		t.CashOnTopOfShare, t.SecurityDepositRupees, t.DepositRefundable = nil, nil, nil
		t.JDAStampDutyRupees, t.GSTReverseChargeApplicable, t.LandownerIsCoPromoter = nil, nil, nil
		return nil
	case TenureTypeJDA:
		t.PurchasePriceRupees, t.PurchaseStampDutyRupees = nil, nil
		switch t.JDAModel {
		case JDAModelAreaSharing, JDAModelDepositPlusShare:
			if !validPct(t.DeveloperAreaSharePct) {
				return fmt.Errorf("developer area share must be between 0 and 100%%")
			}
			t.LandownerRevenueSharePct = nil
		case JDAModelRevenueSharing:
			if !validPct(t.LandownerRevenueSharePct) {
				return fmt.Errorf("landowner revenue share must be between 0 and 100%%")
			}
			t.DeveloperAreaSharePct = nil
		default:
			return fmt.Errorf("invalid jda_model: %q", t.JDAModel)
		}
		if t.JDAModel == JDAModelDepositPlusShare && t.SecurityDepositRupees == nil {
			return fmt.Errorf("a deposit-plus-share JDA needs the security deposit amount")
		}
		return nil
	default:
		return fmt.Errorf("invalid tenure_type: %q", t.TenureType)
	}
}
