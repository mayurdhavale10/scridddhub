package usecase

import (
	"strings"
	"testing"

	"github.com/scridddhub/backend/internal/domain"
)

func TestReportRequirements_GapsBecomeFetchLines(t *testing.T) {
	lat := 19.15
	s := &ReportSections{
		Village: "Nilaje", SurveyNumber: "45/2A", Latitude: &lat, Longitude: &lat,
		LegalCheckStarted: true,
		Searches:          []domain.EncumbranceSearchItem{{SearchType: "District & High Court litigation", Completed: false}},
		Documents:         []domain.LegalDocument{{DocumentType: "7/12 Extract", Status: domain.DocumentStatusPending}},
		OccupancyClass:    "unknown", NAStatus: "unknown",
	}
	reqs := reportRequirements(s)
	s.Requirements = reqs

	find := func(item string) *ReportRequirement {
		for i := range reqs {
			if strings.Contains(reqs[i].Item, item) {
				return &reqs[i]
			}
		}
		return nil
	}
	if r := find("7/12"); r == nil || !r.InQuick || r.Who != "team" || !strings.Contains(r.Source, "Mahabhumi") {
		t.Errorf("7/12 should be fetched by the team from Mahabhumi in a Quick Screen, got %+v", r)
	}
	if r := find("litigation"); r == nil || r.InQuick || !strings.Contains(r.Source, "eCourts") {
		t.Errorf("court search should be a Full Report advocate item from eCourts, got %+v", r)
	}
	if find("Survey/gat") != nil {
		t.Error("survey number is present, shouldn't be a requirement")
	}

	// Quick Screen is blocked only by Quick items; Full by everything except the verdict.
	quick, full := openRequirements(s, domain.ReportTierQuick), openRequirements(s, domain.ReportTierFull)
	if len(full) <= len(quick) {
		t.Errorf("Full should have more open items than Quick: quick=%v full=%v", quick, full)
	}
	for _, q := range quick {
		if strings.Contains(q, "litigation") {
			t.Error("Quick Screen shouldn't wait for the advocate's court search")
		}
	}
}

func TestReportRequirements_FSIBandClearsFSIItem(t *testing.T) {
	s := &ReportSections{FSIBand: &ReportFSI{Max: 2}}
	for _, r := range reportRequirements(s) {
		if strings.Contains(r.Item, "road width") {
			t.Error("FSI item should be gone once the band is computed")
		}
	}
}
