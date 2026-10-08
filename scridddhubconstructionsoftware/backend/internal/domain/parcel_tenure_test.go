package domain

import (
	"testing"

	"github.com/google/uuid"
)

func tenurePct(v float64) *float64 { return &v }
func tenureRupees(v int64) *int64  { return &v }

func TestParcelTenure_OutrightClearsJDATerms(t *testing.T) {
	tr := ParcelTenure{
		LandParcelID: uuid.New(), TenureType: TenureTypeOutright,
		PurchasePriceRupees: tenureRupees(42000000),
		JDAModel:            JDAModelAreaSharing, DeveloperAreaSharePct: tenurePct(62),
	}
	if err := tr.Validate(); err != nil {
		t.Fatal(err)
	}
	if tr.JDAModel != "" || tr.DeveloperAreaSharePct != nil {
		t.Fatal("outright should drop JDA terms")
	}
	if tr.PurchasePriceRupees == nil {
		t.Fatal("outright should keep the purchase price")
	}
}

func TestParcelTenure_JDAModels(t *testing.T) {
	area := ParcelTenure{LandParcelID: uuid.New(), TenureType: TenureTypeJDA, JDAModel: JDAModelAreaSharing, DeveloperAreaSharePct: tenurePct(62)}
	if err := area.Validate(); err != nil {
		t.Fatalf("area sharing 62%%: %v", err)
	}
	if got := *area.LandownerAreaSharePct(); got != 38 {
		t.Fatalf("landowner share = %v, want 38", got)
	}

	noShare := ParcelTenure{LandParcelID: uuid.New(), TenureType: TenureTypeJDA, JDAModel: JDAModelAreaSharing}
	if noShare.Validate() == nil {
		t.Fatal("area sharing without a share should fail")
	}

	revenue := ParcelTenure{LandParcelID: uuid.New(), TenureType: TenureTypeJDA, JDAModel: JDAModelRevenueSharing, LandownerRevenueSharePct: tenurePct(30), DeveloperAreaSharePct: tenurePct(62)}
	if err := revenue.Validate(); err != nil {
		t.Fatalf("revenue sharing 30%%: %v", err)
	}
	if revenue.DeveloperAreaSharePct != nil {
		t.Fatal("revenue sharing should drop the area share")
	}

	deposit := ParcelTenure{LandParcelID: uuid.New(), TenureType: TenureTypeJDA, JDAModel: JDAModelDepositPlusShare, DeveloperAreaSharePct: tenurePct(62)}
	if deposit.Validate() == nil {
		t.Fatal("deposit plus share without a deposit should fail")
	}
	deposit.SecurityDepositRupees = tenureRupees(40000000)
	if err := deposit.Validate(); err != nil {
		t.Fatalf("deposit plus share: %v", err)
	}
}
