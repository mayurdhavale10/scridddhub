package usecase

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
)

type fakeParcels struct{}

func (fakeParcels) Get(context.Context, uuid.UUID) (*domain.LandParcel, error) {
	return &domain.LandParcel{}, nil
}

type fakeTextReader struct{ called bool }

func (f *fakeTextReader) ReadSevenTwelveText(context.Context, string) (*domain.SevenTwelve, string, error) {
	f.called = true
	return &domain.SevenTwelve{SurveyNumber: "45", Owners: []domain.SevenTwelveOwner{{Name: "A"}}, DigitallySigned: true}, "m", nil
}

func TestReadText_Guards(t *testing.T) {
	r := &fakeTextReader{}
	u := NewLandRecordUsecase(nil, fakeParcels{}, nil).WithTextReader(r)
	ctx, id := context.Background(), uuid.New()

	if _, err := u.ReadText(ctx, id, "भोगवटादाराचे नाव", "https://evil.example.com/712"); err == nil {
		t.Error("a page from outside mahabhumi.gov.in must be refused")
	}
	if _, err := u.ReadText(ctx, id, "जिल्हा निवडा तालुका निवडा", "https://bhulekh.mahabhumi.gov.in/"); !errors.Is(err, ErrNotSevenTwelvePage) {
		t.Errorf("the search form isn't a 7/12: got %v", err)
	}
	if r.called {
		t.Error("the model must not be called for refused pages")
	}
	d, err := u.ReadText(ctx, id, "भूमापन क्रमांक 45 भोगवटादाराचे नाव A", "https://bhulekh.mahabhumi.gov.in/")
	if err != nil || !r.called {
		t.Fatalf("a 7/12 page should be read: %v", err)
	}
	if d.Data.DigitallySigned {
		t.Error("a Bhulekh view must never count as the digitally signed copy")
	}
}
