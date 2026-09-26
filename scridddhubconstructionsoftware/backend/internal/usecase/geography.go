package usecase

import (
	"context"
	"fmt"
	"strings"

	"github.com/scridddhub/backend/internal/domain"
)

// GeographyRepository is defined by this usecase, implemented by internal/repository/postgres.
// Serves the real, complete Maharashtra administrative geography (docs/adr/0006) — decoupled from
// which villages happen to have a Ready Reckoner rate on file (that's EstimateParcelValueUsecase's
// concern, not this one).
type GeographyRepository interface {
	ListDistricts(ctx context.Context) ([]string, error)
	ListTalukas(ctx context.Context, district string) ([]string, error)
	ListVillages(ctx context.Context, district, taluka string) ([]string, error)
	SearchVillages(ctx context.Context, query string) ([]domain.VillageMatch, error)
}

type GeographyUsecase struct {
	repo GeographyRepository
}

func NewGeographyUsecase(repo GeographyRepository) *GeographyUsecase {
	return &GeographyUsecase{repo: repo}
}

func (u *GeographyUsecase) ListDistricts(ctx context.Context) ([]string, error) {
	return u.repo.ListDistricts(ctx)
}

func (u *GeographyUsecase) ListTalukas(ctx context.Context, district string) ([]string, error) {
	return u.repo.ListTalukas(ctx, district)
}

func (u *GeographyUsecase) ListVillages(ctx context.Context, district, taluka string) ([]string, error) {
	return u.repo.ListVillages(ctx, district, taluka)
}

// SearchVillages requires at least 2 characters — a single letter can match thousands of villages
// across Maharashtra and isn't a useful autocomplete result yet.
//
// Real users type a landmark alongside the place name (e.g. "Khadakpada, Near Seth Hirachand
// Mutha school") — strip anything from the first comma onward before matching, since a village
// name is never going to be a 40-character description (confirmed live, 2026-09-21: this exact
// input returned zero matches before this fix).
func (u *GeographyUsecase) SearchVillages(ctx context.Context, query string) ([]domain.VillageMatch, error) {
	term := strings.TrimSpace(query)
	if idx := strings.Index(term, ","); idx != -1 {
		term = strings.TrimSpace(term[:idx])
	}
	if len(term) < 2 {
		return nil, fmt.Errorf("query must be at least 2 characters")
	}
	return u.repo.SearchVillages(ctx, term)
}
