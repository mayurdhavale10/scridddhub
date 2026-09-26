package usecase

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/scridddhub/backend/internal/domain"
)

type fakeEstimator struct{ got LandValueEstimateRequest }

func (f *fakeEstimator) Estimate(_ context.Context, req LandValueEstimateRequest) (AILandValueEstimate, error) {
	f.got = req
	return AILandValueEstimate{UsedReadyReckonerRate: req.ReadyReckoner != nil}, nil
}

type fakeRates struct {
	rate *domain.ReadyReckonerRate
	err  error
}

func (f fakeRates) Get(context.Context, string, string, string) (*domain.ReadyReckonerRate, error) {
	return f.rate, f.err
}

func TestAIEstimate_PicksUpRateForRealVillage(t *testing.T) {
	est := &fakeEstimator{}
	rate := &domain.ReadyReckonerRate{RatePerSqmRupees: 520}
	u := NewAILandEstimateUsecase(est, fakeRates{rate: rate})

	_, err := u.Estimate(context.Background(), AILandEstimateInput{
		Location: "Kakadpada, Kalyan, Thane", AreaAcres: 2, Notes: "road-facing",
		District: "Thane", Taluka: "Kalyan", Village: "Kakadpada",
	})
	if err != nil {
		t.Fatal(err)
	}
	if est.got.ReadyReckoner != rate {
		t.Fatalf("expected the DB rate to be passed to the model")
	}
	if est.got.Notes != "road-facing" {
		t.Fatalf("notes not passed through: %q", est.got.Notes)
	}
}

func TestAIEstimate_NoRateOnFileStillEstimates(t *testing.T) {
	est := &fakeEstimator{}
	u := NewAILandEstimateUsecase(est, fakeRates{err: domain.ErrNotFound})

	if _, err := u.Estimate(context.Background(), AILandEstimateInput{
		Location: "Godre, Junnar, Pune", AreaAcres: 1, District: "Pune", Taluka: "Junnar", Village: "Godre",
	}); err != nil {
		t.Fatal(err)
	}
	if est.got.ReadyReckoner != nil {
		t.Fatalf("expected no rate")
	}
}

func TestAIEstimate_FreeTextSkipsLookup(t *testing.T) {
	est := &fakeEstimator{}
	// A lookup here would fail the test: free text must not touch the rates repo.
	u := NewAILandEstimateUsecase(est, fakeRates{err: errors.New("should not be called")})

	if _, err := u.Estimate(context.Background(), AILandEstimateInput{
		Location: "Godrej Hill, Kalyan", AreaAcres: 2.1, Notes: strings.Repeat("x", 1500),
	}); err != nil {
		t.Fatal(err)
	}
	if n := len([]rune(est.got.Notes)); n != maxNotesLen {
		t.Fatalf("notes should be truncated to %d, got %d", maxNotesLen, n)
	}
}

func TestAIEstimate_DBErrorSurfaces(t *testing.T) {
	u := NewAILandEstimateUsecase(&fakeEstimator{}, fakeRates{err: errors.New("db down")})
	_, err := u.Estimate(context.Background(), AILandEstimateInput{
		Location: "x", AreaAcres: 1, District: "a", Taluka: "b", Village: "c",
	})
	if err == nil {
		t.Fatal("expected a DB failure to surface, not be silently treated as no rate")
	}
}
