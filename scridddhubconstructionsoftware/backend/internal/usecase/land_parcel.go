package usecase

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
)

// LandParcelRepository is defined by this usecase (the consumer), implemented by
// internal/repository/postgres. Every Create/UpdateStage implementation must write the mutation
// and its audit_log row in one transaction (ADR-0002).
type LandParcelRepository interface {
	Create(ctx context.Context, actor string, parcel *domain.LandParcel) error
	Get(ctx context.Context, id uuid.UUID) (*domain.LandParcel, error)
	ListByProject(ctx context.Context, projectID uuid.UUID) ([]*domain.LandParcel, error)
	UpdateStage(ctx context.Context, actor string, id uuid.UUID, stage domain.LandParcelStage) (*domain.LandParcel, error)
	UpdateSourceVerifiedAt(ctx context.Context, actor string, id uuid.UUID, verifiedAt time.Time) (*domain.LandParcel, error)
	RecordClosedPrice(ctx context.Context, actor string, id uuid.UUID, closedPriceRupees int64, closedAt time.Time) (*domain.LandParcel, error)
}

type LandParcelUsecase struct {
	repo LandParcelRepository
}

func NewLandParcelUsecase(repo LandParcelRepository) *LandParcelUsecase {
	return &LandParcelUsecase{repo: repo}
}

func (u *LandParcelUsecase) Create(ctx context.Context, actor string, parcel *domain.LandParcel) error {
	if parcel.Stage == "" {
		parcel.Stage = domain.LandParcelStageSourced
	}
	if err := parcel.Validate(); err != nil {
		return err
	}
	return u.repo.Create(ctx, actor, parcel)
}

func (u *LandParcelUsecase) Get(ctx context.Context, id uuid.UUID) (*domain.LandParcel, error) {
	return u.repo.Get(ctx, id)
}

func (u *LandParcelUsecase) ListByProject(ctx context.Context, projectID uuid.UUID) ([]*domain.LandParcel, error) {
	return u.repo.ListByProject(ctx, projectID)
}

func (u *LandParcelUsecase) UpdateStage(ctx context.Context, actor string, id uuid.UUID, stage domain.LandParcelStage) (*domain.LandParcel, error) {
	if !stage.Valid() {
		return nil, domain.ErrInvalidStage
	}
	return u.repo.UpdateStage(ctx, actor, id, stage)
}

// The old comparable-based EstimatePrice was removed 2026-09-19 per docs/adr/0004 — see
// usecase.EstimateParcelValueUsecase for its replacement (ready_reckoner_rate.go).

// SourceVerification is a real reachability check, not a content scrape — it never reads or
// parses the target page, only whether it answers at all. Deliberately on-demand only (a person
// taps "Verify", nothing runs this automatically), matching the same discipline as EstimatePrice.
type SourceVerification struct {
	Reachable  bool
	StatusCode int
}

var sourceVerifyHTTPClient = &http.Client{
	Timeout: 8 * time.Second,
	// A reachability check should follow a normal redirect chain (many listing portals redirect
	// once) but not loop forever.
	CheckRedirect: func(req *http.Request, via []*http.Request) error {
		if len(via) >= 5 {
			return fmt.Errorf("too many redirects")
		}
		return nil
	},
}

// VerifySource checks whether the parcel's own recorded SourceURL is actually reachable right
// now. A successful (2xx) check is the only thing that ever sets SourceVerifiedAt — a failure is
// reported back to the caller but never persisted, since "unreachable at this moment" could just
// be a transient blip, not a fact worth recording as permanent history.
func (u *LandParcelUsecase) VerifySource(ctx context.Context, actor string, id uuid.UUID) (*domain.LandParcel, *SourceVerification, error) {
	parcel, err := u.repo.Get(ctx, id)
	if err != nil {
		return nil, nil, err
	}
	if parcel.SourceURL == nil || *parcel.SourceURL == "" {
		return nil, nil, fmt.Errorf("this parcel has no source URL recorded to verify")
	}

	parsed, err := url.Parse(*parcel.SourceURL)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return parcel, &SourceVerification{Reachable: false}, nil
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, parsed.String(), nil)
	if err != nil {
		return parcel, &SourceVerification{Reachable: false}, nil
	}
	resp, err := sourceVerifyHTTPClient.Do(req)
	if err != nil {
		return parcel, &SourceVerification{Reachable: false}, nil
	}
	defer resp.Body.Close()

	result := &SourceVerification{
		Reachable:  resp.StatusCode >= 200 && resp.StatusCode < 400,
		StatusCode: resp.StatusCode,
	}
	if !result.Reachable {
		return parcel, result, nil
	}

	updated, err := u.repo.UpdateSourceVerifiedAt(ctx, actor, id, time.Now())
	if err != nil {
		return nil, nil, err
	}
	return updated, result, nil
}

// RecordClosedPrice sets the real, final transacted price once a deal actually closes — a
// separate, later event from the parcel's original asking price. This is the only legitimate
// ground truth for a future pricing model (see docs/adr/0005); asking price is not used for that
// purpose. Requires the parcel to already have an area recorded (same reasoning as CostRupees —
// domain.LandParcel.Validate enforces this).
func (u *LandParcelUsecase) RecordClosedPrice(ctx context.Context, actor string, id uuid.UUID, closedPriceRupees int64) (*domain.LandParcel, error) {
	if closedPriceRupees <= 0 {
		return nil, fmt.Errorf("closed_price_rupees must be positive")
	}
	parcel, err := u.repo.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	if parcel.AreaAcres == nil {
		return nil, fmt.Errorf("this parcel has no area recorded yet — area is required before a closed price can be set")
	}
	return u.repo.RecordClosedPrice(ctx, actor, id, closedPriceRupees, time.Now())
}
