package usecase

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"net/url"
	"path/filepath"
	"regexp"
	"strings"
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
	reader  SevenTwelveReader     // optional
	ferfar  FerfarReader          // optional
	text    SevenTwelveTextReader // optional
	pdf     SignedPDFText         // optional
	now     func() time.Time
}

// SevenTwelveTextReader is implemented by internal/llm (a text model).
type SevenTwelveTextReader interface {
	ReadSevenTwelveText(ctx context.Context, text string) (*domain.SevenTwelve, string, error)
}

// WithTextReader enables reading the text of a 7/12 opened on Bhulekh inside the app.
func (u *LandRecordUsecase) WithTextReader(r SevenTwelveTextReader) *LandRecordUsecase {
	u.text = r
	return u
}

// ErrNotSevenTwelvePage: the page taken from Bhulekh doesn't look like a 7/12 yet.
var ErrNotSevenTwelvePage = errors.New("this page doesn't show a 7/12 yet: open the record (after the captcha) and try again, or take a screenshot and use Choose from gallery")

// ReadText reads a 7/12 from the text of a Bhulekh page the person opened in the app after typing
// the captcha themselves. Nothing is saved; the draft goes through the same check-and-confirm step.
func (u *LandRecordUsecase) ReadText(ctx context.Context, parcelID uuid.UUID, text, sourceURL string) (*SevenTwelveDraft, error) {
	if u.text == nil {
		return nil, ErrReaderUnavailable
	}
	text, err := checkBhulekhPage(text, sourceURL)
	if err != nil {
		return nil, err
	}
	p, err := u.parcels.Get(ctx, parcelID)
	if err != nil {
		return nil, err
	}
	data, model, err := readBhulekhText(ctx, u.text, text, sourceURL)
	if err != nil {
		return nil, err
	}
	return &SevenTwelveDraft{Data: *data, Flags: data.Flags(p.AreaAcres), ReadBy: model}, nil
}

// SignedPDFText is implemented by internal/ocr: the page text of a signed 7/12 PDF.
type SignedPDFText interface {
	Text(ctx context.Context, pdf []byte) (string, error)
}

// WithSignedPDF enables reading signed 7/12 PDFs bought from Digital Satbara.
func (u *LandRecordUsecase) WithSignedPDF(r SignedPDFText) *LandRecordUsecase {
	u.pdf = r
	return u
}

// MaxSignedPDFBytes: a Digital Satbara 7/12 is about 85 KB; anything near this isn't one.
const MaxSignedPDFBytes = 5 << 20

// Digital Satbara names its downloads "<village>_<survey with / as #>_Satbara.pdf", e.g.
// "वरप_42#3_Satbara.pdf". The survey number there is exact; OCR of the page can slip.
var reSatbaraFile = regexp.MustCompile(`^(.+)_(.+)_Satbara\.pdf$`)

// ReadSignedPDF reads a signed 7/12 PDF from Digital Satbara into a draft. The page is OCR'd, the
// text reader structures it, and rules then set the fields they read reliably (unit, area,
// tenure, NA, signature). Nothing is saved; the draft goes through check-and-confirm.
func (u *LandRecordUsecase) ReadSignedPDF(ctx context.Context, parcelID uuid.UUID, pdf []byte, filename string) (*SevenTwelveDraft, error) {
	if u.pdf == nil || u.text == nil {
		return nil, ErrReaderUnavailable
	}
	if len(pdf) == 0 || len(pdf) > MaxSignedPDFBytes || !bytes.HasPrefix(pdf, []byte("%PDF")) {
		return nil, fmt.Errorf("upload the 7/12 PDF downloaded from Digital Satbara (under %d MB)", MaxSignedPDFBytes>>20)
	}
	p, err := u.parcels.Get(ctx, parcelID)
	if err != nil {
		return nil, err
	}
	raw, err := u.pdf.Text(ctx, pdf)
	if err != nil {
		return nil, fmt.Errorf("reading the PDF: %w", err)
	}
	if !strings.Contains(raw, "भोगवटादार") && !strings.Contains(raw, "भूमापन") && !strings.Contains(raw, "गाव नमुना") {
		return nil, ErrNotSevenTwelvePage
	}
	data, model, err := u.text.ReadSevenTwelveText(ctx, "OCR text of a digitally signed 7/12 PDF, read region by region (OCR slips are possible, especially in digits):\n"+raw)
	if err != nil {
		return nil, fmt.Errorf("reading the 7/12: %w", err)
	}
	var notes []string
	if m := reSatbaraFile.FindStringSubmatch(filepath.Base(filename)); m != nil {
		survey := strings.ReplaceAll(m[2], "#", "/")
		if survey != data.SurveyNumber {
			notes = append(notes, "survey number "+survey+" taken from the file name")
		}
		data.SurveyNumber = survey
	}
	if fixed := data.ApplySignedCopyText(raw); len(fixed) > 0 {
		notes = append(notes, "read by rules: "+strings.Join(fixed, "; "))
	}
	data.OtherRights = cleanOtherRights(data.OtherRights)
	if !data.DigitallySigned {
		notes = append(notes, "no Digital Satbara verification number found on the page")
	}
	data.Notes = strings.TrimSpace(strings.Join(append(notes, data.Notes), ". "))
	return &SevenTwelveDraft{Data: *data, Flags: data.Flags(p.AreaAcres), ReadBy: model + " + tesseract"}, nil
}

// cleanOtherRights drops entries that are only area lines from the next column (OCR runs the
// table's columns together), e.g. "बिन शोती ११.६०.००".
func cleanOtherRights(in []string) []string {
	out := []string{}
	for _, r := range in {
		if reAreaOnly.MatchString(strings.TrimSpace(r)) {
			continue
		}
		out = append(out, r)
	}
	return out
}

var reAreaOnly = regexp.MustCompile(`^(बिन\s*श[ेो]ती|जिरायत|बागायत|आकारणी|एकूण[^०-९0-9]*)?\s*[०-९0-9.]+$`)

// checkBhulekhPage refuses pages from anywhere but mahabhumi.gov.in, and pages that don't show a
// 7/12 yet, before any AI call. It returns the trimmed text.
func checkBhulekhPage(text, sourceURL string) (string, error) {
	if !isMahabhumiURL(sourceURL) {
		return "", fmt.Errorf("the page must come from mahabhumi.gov.in, not %q", sourceURL)
	}
	text = strings.TrimSpace(text)
	if len(text) > 200_000 {
		text = text[:200_000]
	}
	// A 7/12 always names the holder column; without it the record isn't on screen yet.
	if !strings.Contains(text, "भोगवटादार") && !strings.Contains(text, "भूमापन") && !strings.Contains(strings.ToLower(text), "occupant") {
		return "", ErrNotSevenTwelvePage
	}
	return text, nil
}

// readBhulekhText reads a checked Bhulekh page. A Bhulekh view is never the signed copy.
func readBhulekhText(ctx context.Context, r SevenTwelveTextReader, text, sourceURL string) (*domain.SevenTwelve, string, error) {
	data, model, err := r.ReadSevenTwelveText(ctx, text)
	if err != nil {
		return nil, "", fmt.Errorf("reading the 7/12: %w", err)
	}
	data.DigitallySigned = false
	data.Notes = strings.TrimSpace("Read from the Bhulekh view (" + sourceURL + "), which the site says is not for legal use. " + data.Notes)
	return data, model, nil
}

func isMahabhumiURL(raw string) bool {
	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "https" && u.Scheme != "http") {
		return false
	}
	h := strings.ToLower(u.Hostname())
	return h == "mahabhumi.gov.in" || strings.HasSuffix(h, ".mahabhumi.gov.in")
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
