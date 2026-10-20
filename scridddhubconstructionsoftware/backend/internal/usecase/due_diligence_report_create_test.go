package usecase

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
)

type fakeReports struct {
	DueDiligenceReportRepository
	list []*domain.DueDiligenceReport
}

func (f *fakeReports) Create(_ context.Context, _ string, r *domain.DueDiligenceReport) error {
	r.ID = uuid.New()
	f.list = append(f.list, r)
	return nil
}

func (f *fakeReports) ListByParcel(_ context.Context, id uuid.UUID) ([]*domain.DueDiligenceReport, error) {
	var out []*domain.DueDiligenceReport
	for _, r := range f.list {
		if r.LandParcelID == id {
			out = append(out, r)
		}
	}
	return out, nil
}

// Ordering the same tier again while a draft is open returns that draft (Varap had six empty
// duplicates from repeated taps, 2026-10-17); another tier, or one after issuing, is new.
func TestCreateReport_OneDraftPerTier(t *testing.T) {
	d, tk, v, s := "Thane", "Kalyan", "Varap", "42/3, 42/4/2"
	p := &domain.LandParcel{ID: uuid.New(), District: &d, Taluka: &tk, Village: &v, SurveyNumber: &s}
	repo := &fakeReports{}
	u := NewDueDiligenceReportUsecase(repo, oneParcel{p}, nil, nil, nil, nil, nil)
	ctx := context.Background()

	first, err := u.Create(ctx, "t", p.ID, domain.ReportTierQuick)
	if err != nil {
		t.Fatal(err)
	}
	again, err := u.Create(ctx, "t", p.ID, domain.ReportTierQuick)
	if err != nil || again.ID != first.ID || len(repo.list) != 1 {
		t.Fatalf("second quick order: id %v (want %v), %d reports, err %v", again.ID, first.ID, len(repo.list), err)
	}
	full, _ := u.Create(ctx, "t", p.ID, domain.ReportTierFull)
	if full.ID == first.ID || len(repo.list) != 2 {
		t.Fatalf("a full report is separate from the quick one")
	}
	now := time.Now()
	first.Status, first.FinalisedAt = domain.ReportStatusIssued, &now
	next, _ := u.Create(ctx, "t", p.ID, domain.ReportTierQuick)
	if next.ID == first.ID || len(repo.list) != 3 {
		t.Fatalf("after issuing, a new quick screen can be ordered")
	}
}
