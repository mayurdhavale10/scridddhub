package domain

import (
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
)

func newFullReport() *DueDiligenceReport {
	r := &DueDiligenceReport{LandParcelID: uuid.New(), Tier: ReportTierFull, Status: ReportStatusDraft}
	_ = r.Validate()
	return r
}

func TestReport_FullNeedsLandStatusVerdictAndAdvocate(t *testing.T) {
	r := newFullReport()
	err := r.Finalise("Adv. A", "MAH/123/2010", []byte(`{}`), time.Now())
	if !errors.Is(err, ErrReportNotReady) {
		t.Fatalf("empty report: want not ready, got %v", err)
	}
	r.OccupancyClass, r.NAStatus, r.DPZone = "class_1", "in_process", "Residential"
	r.Verdict, r.VerdictSummary = VerdictFixFirst, "Title gap in 2009."
	if !errors.Is(r.Finalise("Adv. A", "MAH/123/2010", nil, time.Now()), ErrReportNotReady) {
		t.Fatal("fix_first without a fix list should not finalise")
	}
	r.FixList = []string{"B: record the 2009 heirship"}
	if !errors.Is(r.Finalise("", "", nil, time.Now()), ErrReportNotReady) {
		t.Fatal("full report without an advocate should not finalise")
	}
	if err := r.Finalise("Adv. A", "MAH/123/2010", []byte(`{"a":1}`), time.Now()); err != nil {
		t.Fatalf("ready report: %v", err)
	}
	if r.Status != ReportStatusSigned || r.FinalisedAt == nil || string(r.FrozenReport) != `{"a":1}` {
		t.Fatalf("not signed and frozen: %+v", r)
	}
	if !errors.Is(r.Finalise("Adv. A", "MAH/123/2010", nil, time.Now()), ErrReportFinalised) {
		t.Fatal("signed report should not finalise twice")
	}
}

func TestReport_QuickIssuesWithoutLawyerOrLandStatus(t *testing.T) {
	r := &DueDiligenceReport{LandParcelID: uuid.New(), Tier: ReportTierQuick, Status: ReportStatusDraft}
	_ = r.Validate()
	r.Verdict, r.VerdictSummary = VerdictGo, "No red flags in public records."
	if err := r.Finalise("", "", []byte(`{}`), time.Now()); err != nil {
		t.Fatalf("quick screen: %v", err)
	}
	if r.Status != ReportStatusIssued {
		t.Fatalf("status = %q, want issued", r.Status)
	}
}

func TestCleanVerdictDraft_KeepsOnlyCitedFixes(t *testing.T) {
	d, err := CleanVerdictDraft(ReportVerdictDraft{
		Verdict: " Fix_First ",
		Summary: " Gap. ",
		FixList: []string{"B: record heirship", "get a lawyer", "D. apply for NA", "Z: nonsense"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if d.Verdict != VerdictFixFirst || d.Summary != "Gap." {
		t.Fatalf("got %+v", d)
	}
	if len(d.FixList) != 2 {
		t.Fatalf("fix list = %v, want the two cited items", d.FixList)
	}
	if _, err := CleanVerdictDraft(ReportVerdictDraft{Verdict: "maybe"}); err == nil {
		t.Fatal("invalid verdict should error")
	}
}
