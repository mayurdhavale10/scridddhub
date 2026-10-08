package usecase

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
)

type valuationParcels struct{ p *domain.LandParcel }

func (f valuationParcels) Get(context.Context, uuid.UUID) (*domain.LandParcel, error) {
	return f.p, nil
}

type valuationRates struct{}

func (valuationRates) Get(context.Context, string, string, string) (*domain.ReadyReckonerRate, error) {
	return &domain.ReadyReckonerRate{RatePerSqmRupees: 1000, EffectiveYear: "2025-26"}, nil
}

type valuationInfraFake struct{}

func (valuationInfraFake) ForParcel(context.Context, uuid.UUID) (*PlannedInfrastructureResult, error) {
	d := 7.1
	return &PlannedInfrastructureResult{Matches: []domain.PlannedInfrastructureMatch{{
		Project: domain.InfrastructureProject{Name: "Metro Line 12", Kind: "metro", Status: "under_construction"}, DistanceKm: &d,
	}}}, nil
}

type valuationSales struct{ err error }

func (f valuationSales) ForParcel(context.Context, uuid.UUID) (*domain.NearbyTransactions, error) {
	return nil, f.err
}

type valuationValuer struct{ got ParcelValuationRequest }

func (f *valuationValuer) Value(_ context.Context, req ParcelValuationRequest) (domain.ValuationDraft, string, error) {
	f.got = req
	return domain.ValuationDraft{CurrentLowPerAcre: 8e6, CurrentLikelyPerAcre: 1e7, CurrentHighPerAcre: 1.2e7,
		FutureLowPerAcre: 1e7, FutureLikelyPerAcre: 1.3e7, FutureHighPerAcre: 1.6e7,
		UpliftDrivers: []string{"Metro Line 12 (7.1 km)"}}, "test-model", nil
}

type valuationStore struct{ saved *domain.FeasibilityAssessment }

func (f *valuationStore) Upsert(_ context.Context, _ string, a *domain.FeasibilityAssessment) error {
	f.saved = a
	return nil
}
func (f *valuationStore) GetByLandParcel(context.Context, uuid.UUID) (*domain.FeasibilityAssessment, error) {
	return f.saved, nil
}

func valStrp(s string) *string { return &s }

// A parcel nobody prepared: typed location, picked village, an area and a price. Assess must work
// from whatever is known, record it, and still succeed when an input (sales) fails to load.
func TestValuationUsecase_AssessesAnyParcel(t *testing.T) {
	area, asking := 3.5, int64(4.2e7)
	parcel := &domain.LandParcel{ID: uuid.New(), Location: "Nilaje", AreaAcres: &area, CostRupees: &asking,
		District: valStrp("Thane"), Taluka: valStrp("Kalyan"), Village: valStrp("Nilaje")}
	valuer, store := &valuationValuer{}, &valuationStore{}
	u := NewValuationUsecase(valuationParcels{parcel}, valuationRates{}, valuationInfraFake{}, valuationSales{err: errors.New("down")}, valuer, store)
	u.now = func() time.Time { return time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC) }

	a, err := u.Assess(context.Background(), "tester", parcel.ID)
	if err != nil {
		t.Fatal(err)
	}
	if valuer.got.ReadyReckoner == nil || len(valuer.got.Infrastructure) != 1 || valuer.got.HorizonYears != 5 {
		t.Errorf("valuer was not given the parcel's inputs: %+v", valuer.got)
	}
	if store.saved == nil || a.CurrentValuationRupees != 3.5e7 || a.FutureValuationYear != 2031 {
		t.Errorf("assessment not built/saved correctly: %+v", a)
	}
	if a.Basis.ReadyReckonerPerAcre == nil || *a.Basis.AskingPriceRupees != asking || a.Basis.Model != "test-model" {
		t.Errorf("basis must record what it rested on: %+v", a.Basis)
	}
	if a.Verdict != "Asking price above estimated value" {
		t.Errorf("verdict %q", a.Verdict)
	}
}

func TestValuationUsecase_NeedsArea(t *testing.T) {
	parcel := &domain.LandParcel{ID: uuid.New(), Location: "Titwala"}
	u := NewValuationUsecase(valuationParcels{parcel}, valuationRates{}, nil, nil, &valuationValuer{}, &valuationStore{})
	if _, err := u.Assess(context.Background(), "tester", parcel.ID); !errors.Is(err, domain.ErrValuationNeedsArea) {
		t.Errorf("want ErrValuationNeedsArea, got %v", err)
	}
}
