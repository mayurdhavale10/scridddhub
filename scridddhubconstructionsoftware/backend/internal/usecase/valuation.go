package usecase

import (
	"context"
	"errors"
	"fmt"
	"log"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
)

// Valuation Summary (services/valuationsummary/README.md): "Assess" values ANY saved parcel —
// nothing here depends on the parcel being one we prepared. It gathers whatever is known about
// the parcel (area, Ready Reckoner rate if a village was picked, nearby planned projects and
// existing places from its pin or location, nearby registered sales when there are any), asks the
// AI for per-acre ranges, and lets domain.BuildValuation decide the totals, comparison and verdict.

// ParcelValuationRequest is what the AI is given. The asking price is deliberately absent so the
// estimate can't anchor to the seller's number.
type ParcelValuationRequest struct {
	Location       string
	Village        string
	Taluka         string
	District       string
	AreaAcres      float64
	ReadyReckoner  *domain.ReadyReckonerRate
	Infrastructure []domain.ValuationInfra
	SalesCount     int
	SalesMonths    int
	SalesMedian    *float64 // ₹ per acre
	AsOf           time.Time
	HorizonYears   int
}

// ParcelValuer is implemented by internal/llm.
type ParcelValuer interface {
	Value(ctx context.Context, req ParcelValuationRequest) (draft domain.ValuationDraft, model string, err error)
}

// InfrastructureForParcel and SalesForParcel are the existing Compare-screen features, reused as
// inputs (implemented by PlannedInfrastructureUsecase and RegisteredTransactionsUsecase).
type InfrastructureForParcel interface {
	ForParcel(ctx context.Context, parcelID uuid.UUID) (*PlannedInfrastructureResult, error)
}

type SalesForParcel interface {
	ForParcel(ctx context.Context, parcelID uuid.UUID) (*domain.NearbyTransactions, error)
}

type ValuationUsecase struct {
	parcels     ParcelGetter
	rates       ReadyReckonerRateRepository
	infra       InfrastructureForParcel // optional
	sales       SalesForParcel          // optional
	valuer      ParcelValuer
	assessments FeasibilityAssessmentRepository
	now         func() time.Time
}

func NewValuationUsecase(parcels ParcelGetter, rates ReadyReckonerRateRepository, infra InfrastructureForParcel,
	sales SalesForParcel, valuer ParcelValuer, assessments FeasibilityAssessmentRepository) *ValuationUsecase {
	return &ValuationUsecase{parcels: parcels, rates: rates, infra: infra, sales: sales, valuer: valuer,
		assessments: assessments, now: time.Now}
}

// Inputs that don't exist or fail to load are skipped: an assessment with fewer inputs is still
// honest, because its "based on" record lists exactly what was used.
func (u *ValuationUsecase) Assess(ctx context.Context, actor string, parcelID uuid.UUID) (*domain.FeasibilityAssessment, error) {
	p, err := u.parcels.Get(ctx, parcelID)
	if err != nil {
		return nil, err
	}
	if p.AreaAcres == nil || *p.AreaAcres <= 0 {
		return nil, domain.ErrValuationNeedsArea
	}
	now := u.now()
	req := ParcelValuationRequest{
		Location: p.Location, AreaAcres: *p.AreaAcres, AsOf: now, HorizonYears: domain.ValuationHorizonYears,
	}
	basis := domain.ValuationBasis{
		AsOf: now, Location: p.Location, AreaAcres: *p.AreaAcres, AskingPriceRupees: p.CostRupees,
		Pinned: p.Latitude != nil && p.Longitude != nil,
	}

	if p.District != nil && p.Taluka != nil && p.Village != nil {
		req.District, req.Taluka, req.Village = *p.District, *p.Taluka, *p.Village
		rate, err := u.rates.Get(ctx, *p.District, *p.Taluka, *p.Village)
		switch {
		case err == nil:
			req.ReadyReckoner = rate
			perAcre := int64(float64(rate.RatePerSqmRupees) * domain.SqmPerAcre)
			basis.ReadyReckonerPerAcre, basis.ReadyReckonerYear = &perAcre, rate.EffectiveYear
		case errors.Is(err, domain.ErrNotFound):
		default:
			log.Printf("valuation: ready reckoner rate for %s: %v", parcelID, err)
		}
	}

	if u.infra != nil {
		if res, err := u.infra.ForParcel(ctx, parcelID); err != nil {
			log.Printf("valuation: infrastructure for %s: %v", parcelID, err)
		} else {
			req.Infrastructure = valuationInfra(res)
			basis.Infrastructure = req.Infrastructure
		}
	}

	if u.sales != nil {
		if s, err := u.sales.ForParcel(ctx, parcelID); err != nil {
			log.Printf("valuation: nearby sales for %s: %v", parcelID, err)
		} else if s != nil && s.Count > 0 {
			req.SalesCount, req.SalesMonths, req.SalesMedian = s.Count, s.Months, s.MedianRate
			basis.NearbySalesCount, basis.NearbySalesMonths, basis.NearbySalesMedianPerAcre = s.Count, s.Months, s.MedianRate
		}
	}

	draft, model, err := u.valuer.Value(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("valuing parcel: %w", err)
	}
	basis.Model = model
	a, err := domain.BuildValuation(parcelID, basis, draft)
	if err != nil {
		return nil, err
	}
	if err := u.assessments.Upsert(ctx, actor, a); err != nil {
		return nil, err
	}
	return a, nil
}

// maxExistingPerKind keeps the prompt focused: every planned project, plus the nearest few
// existing places of each kind.
const maxExistingPerKind = 2

func valuationInfra(res *PlannedInfrastructureResult) []domain.ValuationInfra {
	var out []domain.ValuationInfra
	for _, m := range res.Matches {
		p := m.Project
		out = append(out, domain.ValuationInfra{
			Name: p.Name, Kind: p.Kind, Category: p.Category, Status: p.Status,
			Completion: p.ExpectedCompletion, DistanceKm: m.DistanceKm, Planned: true,
		})
	}
	perKind := map[string]int{}
	existing := append([]domain.NearbyPlaceMatch(nil), res.Existing...)
	sort.SliceStable(existing, func(i, j int) bool { return existing[i].DistanceKm < existing[j].DistanceKm })
	for _, e := range existing {
		if perKind[e.Place.Kind] >= maxExistingPerKind {
			continue
		}
		perKind[e.Place.Kind]++
		d := e.DistanceKm
		out = append(out, domain.ValuationInfra{
			Name: e.Place.Name, Kind: e.Place.Kind, Category: e.Place.Category, DistanceKm: &d,
		})
	}
	return out
}
