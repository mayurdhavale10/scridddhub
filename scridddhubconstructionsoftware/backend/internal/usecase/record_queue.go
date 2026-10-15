package usecase

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
)

// The land record queue and cache (docs/design/land-records-acquisition.md). Lookups wait in a
// queue; a person on the team opens each on the official site in the app (which fills every field
// but the captcha), types the captcha, and the page text comes back here. The reading is cached by
// the land itself, so any parcel or report on that survey number reuses it.

type RecordQueueStore interface {
	Enqueue(ctx context.Context, reqs []domain.RecordRequest) (int, error)
	List(ctx context.Context, status, district, taluka string, limit int) ([]domain.RecordRequest, error)
	Get(ctx context.Context, id uuid.UUID) (*domain.RecordRequest, error)
	SetStatus(ctx context.Context, id uuid.UUID, status, note string) error
	Counts(ctx context.Context, district, taluka string) (map[string]int, error)
	SaveCache(ctx context.Context, c *domain.CachedRecord) error
	CacheFor(ctx context.Context, kind, district, taluka, village, surveyKey string) (*domain.CachedRecord, error)
}

type RecordQueueUsecase struct {
	store   RecordQueueStore
	parcels ParcelGetter
	reader  SevenTwelveTextReader
	image   SevenTwelveReader // optional: Bhulekh now serves the 7/12 as a picture
	now     func() time.Time
}

func NewRecordQueueUsecase(store RecordQueueStore, parcels ParcelGetter, reader SevenTwelveTextReader) *RecordQueueUsecase {
	return &RecordQueueUsecase{store: store, parcels: parcels, reader: reader, now: time.Now}
}

// WithImageReader enables saving a fetched 7/12 that the site shows as an image, not text.
func (u *RecordQueueUsecase) WithImageReader(r SevenTwelveReader) *RecordQueueUsecase {
	u.image = r
	return u
}

type LandToFetch struct {
	District, Taluka, Village, SurveyNumber string
	LandParcelID                            *uuid.UUID
}

// Enqueue adds 7/12 lookups (a region's survey numbers, or one parcel). Survey numbers already
// queued or fetched are left alone. It returns how many were new.
func (u *RecordQueueUsecase) Enqueue(ctx context.Context, actor string, lands []LandToFetch) (int, error) {
	var reqs []domain.RecordRequest
	for i, l := range lands {
		l.District, l.Taluka, l.Village = strings.TrimSpace(l.District), strings.TrimSpace(l.Taluka), strings.TrimSpace(l.Village)
		if l.District == "" || l.Taluka == "" || l.Village == "" {
			return 0, fmt.Errorf("item %d: district, taluka and village are required", i+1)
		}
		if err := domain.ValidateSurveyNumber(l.SurveyNumber); err != nil {
			return 0, fmt.Errorf("item %d: %w", i+1, err)
		}
		reqs = append(reqs, domain.RecordRequest{
			Kind: domain.RecordKind712, District: l.District, Taluka: l.Taluka, Village: l.Village,
			SurveyNumber: strings.TrimSpace(l.SurveyNumber), SurveyKey: domain.SurveyKey(l.SurveyNumber),
			LandParcelID: l.LandParcelID, RequestedBy: actor,
		})
	}
	return u.store.Enqueue(ctx, reqs)
}

// EnqueueParcel queues a 7/12 for each of the parcel's survey numbers that has no fresh cached
// copy.
func (u *RecordQueueUsecase) EnqueueParcel(ctx context.Context, actor string, p *domain.LandParcel) error {
	if len(p.MissingLandRecordIDs()) > 0 {
		return nil
	}
	id := p.ID
	var lands []LandToFetch
	for _, s := range p.SurveyNumbers() {
		if c, err := u.store.CacheFor(ctx, domain.RecordKind712, *p.District, *p.Taluka, *p.Village, domain.SurveyKey(s)); err == nil && c.Fresh(u.now()) {
			continue
		}
		lands = append(lands, LandToFetch{District: *p.District, Taluka: *p.Taluka, Village: *p.Village, SurveyNumber: s, LandParcelID: &id})
	}
	if len(lands) == 0 {
		return nil
	}
	_, err := u.Enqueue(ctx, actor, lands)
	return err
}

func (u *RecordQueueUsecase) Queue(ctx context.Context, status, district, taluka string) ([]domain.RecordRequest, map[string]int, error) {
	if status == "" {
		status = domain.RecordQueued
	}
	list, err := u.store.List(ctx, status, district, taluka, 200)
	if err != nil {
		return nil, nil, err
	}
	counts, err := u.store.Counts(ctx, district, taluka)
	return list, counts, err
}

// SaveResult takes the page text of a fetched 7/12, reads it, caches it by the land, and marks
// the lookup done. The reading is a draft until a person confirms it on a parcel.
func (u *RecordQueueUsecase) SaveResult(ctx context.Context, actor string, id uuid.UUID, text, sourceURL string) (*domain.CachedRecord, error) {
	if u.reader == nil {
		return nil, ErrReaderUnavailable
	}
	req, err := u.store.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	text, err = checkBhulekhPage(text, sourceURL)
	if err != nil {
		return nil, err
	}
	data, model, err := readBhulekhText(ctx, u.reader, text, sourceURL)
	if err != nil {
		return nil, err
	}
	return u.cache(ctx, actor, req, data, model, text, sourceURL)
}

// SaveImageResult is SaveResult for a 7/12 the site shows as an image (as Bhulekh does since at
// least 2026-10-11: the record is a JPEG in the page, with no text to read).
func (u *RecordQueueUsecase) SaveImageResult(ctx context.Context, actor string, id uuid.UUID, image []byte, mimeType, sourceURL string) (*domain.CachedRecord, error) {
	if u.image == nil {
		return nil, ErrReaderUnavailable
	}
	if !isMahabhumiURL(sourceURL) {
		return nil, fmt.Errorf("the page must come from mahabhumi.gov.in, not %q", sourceURL)
	}
	switch mimeType {
	case "image/jpeg", "image/png", "image/webp":
	default:
		return nil, fmt.Errorf("the 7/12 image must be JPEG, PNG or WebP, not %q", mimeType)
	}
	if len(image) == 0 || len(image) > MaxSevenTwelveImageBytes {
		return nil, fmt.Errorf("image must be under %d MB", MaxSevenTwelveImageBytes>>20)
	}
	req, err := u.store.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	data, model, err := u.image.ReadSevenTwelve(ctx, image, mimeType)
	if err != nil {
		return nil, fmt.Errorf("reading the 7/12: %w", err)
	}
	data.DigitallySigned = false
	data.Notes = strings.TrimSpace("Read from the Bhulekh view (" + sourceURL + "), which the site says is not for legal use. " + data.Notes)
	return u.cache(ctx, actor, req, data, model, "", sourceURL)
}

func (u *RecordQueueUsecase) cache(ctx context.Context, actor string, req *domain.RecordRequest, data *domain.SevenTwelve, model, text, sourceURL string) (*domain.CachedRecord, error) {
	id := req.ID
	c := &domain.CachedRecord{
		Kind: req.Kind, District: req.District, Taluka: req.Taluka, Village: req.Village,
		SurveyNumber: req.SurveyNumber, SurveyKey: req.SurveyKey, RawText: text, Parsed: *data,
		ReadBy: model, SourceURL: sourceURL, FetchedBy: actor, FetchedAt: u.now(),
	}
	if err := u.store.SaveCache(ctx, c); err != nil {
		return nil, err
	}
	note := ""
	if data.SurveyNumber != "" && !domain.SameSurveyNumber(data.SurveyNumber, req.SurveyNumber) {
		note = "page shows survey " + data.SurveyNumber
	}
	return c, u.store.SetStatus(ctx, id, domain.RecordFetched, note)
}

// Skip marks a lookup the site couldn't serve (not found) or the person passed over.
func (u *RecordQueueUsecase) Skip(ctx context.Context, id uuid.UUID, status, note string) error {
	if status != domain.RecordNotFound && status != domain.RecordSkipped && status != domain.RecordQueued {
		return fmt.Errorf("status must be not_found, skipped or queued")
	}
	return u.store.SetStatus(ctx, id, status, note)
}

// CachedForParcel returns the cached 7/12 for the parcel's land, as a draft to check and confirm.
// survey picks which of the parcel's survey numbers; "" means the first.
func (u *RecordQueueUsecase) CachedForParcel(ctx context.Context, parcelID uuid.UUID, survey string) (*domain.CachedRecord, *SevenTwelveDraft, error) {
	p, err := u.parcels.Get(ctx, parcelID)
	if err != nil {
		return nil, nil, err
	}
	surveys := p.SurveyNumbers()
	if len(p.MissingLandRecordIDs()) > 0 || len(surveys) == 0 {
		return nil, nil, domain.ErrNotFound
	}
	if survey == "" {
		survey = surveys[0]
	}
	c, err := u.store.CacheFor(ctx, domain.RecordKind712, *p.District, *p.Taluka, *p.Village, domain.SurveyKey(survey))
	if err != nil {
		return nil, nil, err
	}
	return c, &SevenTwelveDraft{Data: c.Parsed, Flags: draftFlags(p, &c.Parsed), ReadBy: c.ReadBy}, nil
}
