package usecase

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/scridddhub/backend/internal/domain"
	"github.com/scridddhub/backend/internal/transactionpipeline"
)

type fakeSaleStore struct {
	saved []domain.RegisteredTransaction
}

func (f *fakeSaleStore) ResolveVillage(_ context.Context, d, t, v string) (string, string, string, error) {
	if strings.EqualFold(v, "Dhamni") {
		return "491", "4", "123", nil
	}
	return "", "", "", domain.ErrNotFound
}
func (f *fakeSaleStore) SaveTransactionSource(_ context.Context, s transactionpipeline.SourceRecord) (string, error) {
	return "src-1", nil
}
func (f *fakeSaleStore) SaveRegisteredTransaction(_ context.Context, t domain.RegisteredTransaction) error {
	f.saved = append(f.saved, t)
	return nil
}

func TestRecordManualSale(t *testing.T) {
	store := &fakeSaleStore{}
	u := NewRegisteredSaleEntryUsecase(store)
	good := ManualSale{District: "Raigad", Taluka: "Karjat", Village: "Dhamni", SurveyNo: "12/1",
		RegistrationDate: time.Now().AddDate(0, -2, 0), DocumentNo: "1234", OfficeName: "Karjat",
		PropertyType: "land", AreaAcres: 2, SalePriceRupees: 8e7, Comparable: true}
	if err := u.Record(context.Background(), "team", good); err != nil {
		t.Fatal(err)
	}
	got := store.saved[0]
	if got.ReviewedBy != "team" || got.LocationMethod != "unknown" || got.DeedType != "sale" || got.SourceRecordID != "src-1" {
		t.Errorf("saved %+v", got)
	}

	bad := good
	bad.Comparable, bad.ExclusionReason = false, ""
	if u.Record(context.Background(), "team", bad) == nil {
		t.Error("a non-comparable sale needs a reason")
	}
	bad = good
	bad.Village = "Nowhere"
	if u.Record(context.Background(), "team", bad) == nil {
		t.Error("an unknown village must fail")
	}
	bad = good
	bad.RegistrationDate = time.Now().AddDate(0, 1, 0)
	if u.Record(context.Background(), "team", bad) == nil {
		t.Error("a future date must fail")
	}
}
