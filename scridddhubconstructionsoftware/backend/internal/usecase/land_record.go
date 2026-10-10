package usecase

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
)

// A parcel's 7/12. Reading a photo returns a draft only; nothing is saved until a person checks
// it and confirms (services/duediligencereport/README.md, "Reading the 7/12").

// SevenTwelveReader is implemented by internal/llm (a vision model).
type SevenTwelveReader interface {
	ReadSevenTwelve(ctx context.Context, image []byte, mimeType string) (*domain.SevenTwelve, string, error)
}

// FerfarReader is implemented by internal/llm (a vision model).
type FerfarReader interface {
	ReadFerfar(ctx context.Context, image []byte, mimeType string) (*domain.MutationRegister, string, error)
}

type LandRecordRepository interface {
	GetByLandParcel(ctx context.Context, parcelID uuid.UUID) (*domain.LandRecord, error)
	Upsert(ctx context.Context, actor string, rec *domain.LandRecord) error
	GetMutations(ctx context.Context, parcelID uuid.UUID) (*domain.LandMutations, error)
	UpsertMutations(ctx context.Context, actor string, m *domain.LandMutations) error
}

type LandRecordUsecase struct {
	repo    LandRecordRepository
	parcels ParcelGetter
	reader  SevenTwelveReader // optional
	ferfar  FerfarReader      // optional
	now     func() time.Time
}

// WithFerfarReader enables reading mutation register photos.
func (u *LandRecordUsecase) WithFerfarReader(r FerfarReader) *LandRecordUsecase {
	u.ferfar = r
	return u
}

// FerfarDraft is what the AI read from one page, with the warning signs worked out from it.
type FerfarDraft struct {
	Data   domain.MutationRegister  `json:"data"`
	Flags  []domain.SevenTwelveFlag `json:"flags"`
	ReadBy string                   `json:"read_by"`
}

// ReadFerfar reads one photo of mutation entries. Nothing is saved; pages are combined in the app.
func (u *LandRecordUsecase) ReadFerfar(ctx context.Context, parcelID uuid.UUID, image []byte, mimeType string) (*FerfarDraft, error) {
	if u.ferfar == nil {
		return nil, ErrReaderUnavailable
	}
	if err := checkPhoto(image, mimeType); err != nil {
		return nil, err
	}
	if _, err := u.parcels.Get(ctx, parcelID); err != nil {
		return nil, err
	}
	m, model, err := u.ferfar.ReadFerfar(ctx, image, mimeType)
	if err != nil {
		return nil, fmt.Errorf("reading the mutation entries: %w", err)
	}
	return &FerfarDraft{Data: *m, Flags: m.Flags(u.now()), ReadBy: model}, nil
}

// ConfirmFerfar saves the mutation register after a person has checked every entry.
func (u *LandRecordUsecase) ConfirmFerfar(ctx context.Context, actor string, parcelID uuid.UUID, data domain.MutationRegister, readBy string) (*domain.LandMutations, error) {
	if _, err := u.parcels.Get(ctx, parcelID); err != nil {
		return nil, err
	}
	if err := data.Validate(); err != nil {
		return nil, err
	}
	m := &domain.LandMutations{LandParcelID: parcelID, Data: data, ReadBy: readBy, ConfirmedBy: actor, ConfirmedAt: u.now()}
	if err := u.repo.UpsertMutations(ctx, actor, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (u *LandRecordUsecase) GetFerfar(ctx context.Context, parcelID uuid.UUID) (*domain.LandMutations, []domain.SevenTwelveFlag, error) {
	m, err := u.repo.GetMutations(ctx, parcelID)
	if err != nil {
		return nil, nil, err
	}
	return m, m.Data.Flags(u.now()), nil
}

func checkPhoto(image []byte, mimeType string) error {
	switch mimeType {
	case "image/jpeg", "image/png", "image/webp":
	default:
		return fmt.Errorf("upload a photo (JPEG, PNG or WebP), not %q", mimeType)
	}
	if len(image) == 0 || len(image) > MaxSevenTwelveImageBytes {
		return fmt.Errorf("photo must be under %d MB", MaxSevenTwelveImageBytes>>20)
	}
	return nil
}

func NewLandRecordUsecase(repo LandRecordRepository, parcels ParcelGetter, reader SevenTwelveReader) *LandRecordUsecase {
	return &LandRecordUsecase{repo: repo, parcels: parcels, reader: reader, now: time.Now}
}

// MaxSevenTwelveImageBytes keeps uploads within what the vision model accepts (20 MB, base64).
const MaxSevenTwelveImageBytes = 8 << 20

var ErrReaderUnavailable = errors.New("reading 7/12 photos isn't configured")

// SevenTwelveDraft is what the AI read, with the warning signs worked out from it.
type SevenTwelveDraft struct {
	Data   domain.SevenTwelve       `json:"data"`
	Flags  []domain.SevenTwelveFlag `json:"flags"`
	ReadBy string                   `json:"read_by"`
}

func (u *LandRecordUsecase) Read(ctx context.Context, parcelID uuid.UUID, image []byte, mimeType string) (*SevenTwelveDraft, error) {
	if u.reader == nil {
		return nil, ErrReaderUnavailable
	}
	switch mimeType {
	case "image/jpeg", "image/png", "image/webp":
	default:
		return nil, fmt.Errorf("upload a photo (JPEG, PNG or WebP) of the 7/12, not %q", mimeType)
	}
	if len(image) == 0 || len(image) > MaxSevenTwelveImageBytes {
		return nil, fmt.Errorf("photo must be under %d MB", MaxSevenTwelveImageBytes>>20)
	}
	p, err := u.parcels.Get(ctx, parcelID)
	if err != nil {
		return nil, err
	}
	data, model, err := u.reader.ReadSevenTwelve(ctx, image, mimeType)
	if err != nil {
		return nil, fmt.Errorf("reading the 7/12: %w", err)
	}
	return &SevenTwelveDraft{Data: *data, Flags: data.Flags(p.AreaAcres), ReadBy: model}, nil
}

// Confirm saves the 7/12 after a person has checked it.
func (u *LandRecordUsecase) Confirm(ctx context.Context, actor string, parcelID uuid.UUID, data domain.SevenTwelve, readBy string) (*domain.LandRecord, error) {
	if _, err := u.parcels.Get(ctx, parcelID); err != nil {
		return nil, err
	}
	if err := data.Validate(); err != nil {
		return nil, err
	}
	rec := &domain.LandRecord{LandParcelID: parcelID, Data: data, ReadBy: readBy, ConfirmedBy: actor, ConfirmedAt: u.now()}
	if err := u.repo.Upsert(ctx, actor, rec); err != nil {
		return nil, err
	}
	return rec, nil
}

func (u *LandRecordUsecase) Get(ctx context.Context, parcelID uuid.UUID) (*domain.LandRecord, []domain.SevenTwelveFlag, error) {
	p, err := u.parcels.Get(ctx, parcelID)
	if err != nil {
		return nil, nil, err
	}
	rec, err := u.repo.GetByLandParcel(ctx, parcelID)
	if err != nil {
		return nil, nil, err
	}
	return rec, rec.Data.Flags(p.AreaAcres), nil
}
