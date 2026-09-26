package usecase

import (
	"context"
	"fmt"

	"github.com/scridddhub/backend/internal/domain"
)

// ReadyReckonerRateRepository is defined by this usecase (the consumer), implemented by
// internal/repository/postgres. This is read-only from the app's perspective — rows are seeded
// directly (see services/estimatedparcelvalue/README.md), not created through this interface, so
// there's no Create/Update method here to keep from implying the app can edit this data itself.
type ReadyReckonerRateRepository interface {
	// Get returns the most recent (by effective_year) rate on file for an exact
	// district/taluka/village, or domain.ErrNotFound if none exists yet.
	Get(ctx context.Context, district, taluka, village string) (*domain.ReadyReckonerRate, error)
}

type EstimateParcelValueUsecase struct {
	repo ReadyReckonerRateRepository
}

func NewEstimateParcelValueUsecase(repo ReadyReckonerRateRepository) *EstimateParcelValueUsecase {
	return &EstimateParcelValueUsecase{repo: repo}
}

// Estimate is on-demand only — called when whoever is adding a parcel wants a value for a
// location they haven't priced. Standalone: the only input beyond the location itself is area,
// never anything about other parcels in this app (see docs/adr/0004).
func (u *EstimateParcelValueUsecase) Estimate(ctx context.Context, district, taluka, village string, areaAcres float64) (*domain.LocationValueEstimate, error) {
	if areaAcres <= 0 {
		return nil, fmt.Errorf("area_acres must be positive")
	}
	rate, err := u.repo.Get(ctx, district, taluka, village)
	if err != nil {
		return nil, err
	}
	return domain.EstimateLocationValue(rate, areaAcres), nil
}
