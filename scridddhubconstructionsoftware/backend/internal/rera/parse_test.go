package rera

import (
	"os"
	"testing"
	"time"

	"github.com/scridddhub/backend/internal/domain"
)

// Fixtures are real MahaRERA pages saved 2026-10-01.

func TestParseProjectPage_RealResults(t *testing.T) {
	raw, err := os.ReadFile("testdata/projects_421605.html")
	if err != nil {
		t.Fatal(err)
	}
	projects, total := ParseProjectPage(string(raw), time.Now())
	if total != 173 {
		t.Errorf("total = %d, want 173", total)
	}
	if len(projects) != 10 {
		t.Fatalf("got %d projects, want 10", len(projects))
	}
	p := projects[0]
	if p.RegistrationNumber != "P51700000001" || p.ProjectName != "MAYFAIR VISHWARAJA" ||
		p.PromoterName != "MAYFAIR HOUSING PRIVATE LIMITED" || p.Location != "Kalyan" ||
		p.Pincode != "421605" || p.District != "Thane" {
		t.Errorf("first project parsed wrong: %+v", p)
	}
	if p.LastModified == nil || p.LastModified.Format("2006-01-02") != "2017-05-09" {
		t.Errorf("last modified = %v", p.LastModified)
	}
	if p.HasExtension {
		t.Error("first project shows N/A for extension")
	}
	if p.DetailsURL != "https://maharerait.maharashtra.gov.in/public/project/view/4" {
		t.Errorf("details url = %q", p.DetailsURL)
	}
	withExt := 0
	for _, p := range projects {
		if p.HasExtension {
			withExt++
		}
	}
	// The saved page shows 5 "N/A" and 5 extension certificates.
	if withExt != 5 {
		t.Errorf("projects with extension = %d, want 5", withExt)
	}
}

func TestParseComplaintPage_RealResults(t *testing.T) {
	raw, err := os.ReadFile("testdata/complaints_page1.html")
	if err != nil {
		t.Fatal(err)
	}
	rows, pages := ParseComplaintPage(string(raw), time.Now())
	if pages != 542 {
		t.Errorf("pages = %d, want 542", pages)
	}
	if len(rows) != 10 {
		t.Fatalf("got %d rows, want 10", len(rows))
	}
	if rows[0].PromoterName != "Harshal Ramdas Navghare" || rows[0].Complaints != 1 {
		t.Errorf("first row = %+v", rows[0])
	}
	if rows[2].PromoterName != "ARJUN ANANT WAGHMARE" || rows[2].Complaints != 4 {
		t.Errorf("third row = %+v", rows[2])
	}
}

func TestNormalizePromoterName(t *testing.T) {
	for in, want := range map[string]string{
		"MAYFAIR HOUSING PRIVATE LIMITED": "MAYFAIR HOUSING",
		"M/s. Mayfair Housing Pvt. Ltd.":  "MAYFAIR HOUSING",
		"Swati Enterprises":               "SWATI ENTERPRISES",
		"Shree Ganesh Builders & Co.":     "SHREE GANESH BUILDERS",
		"  VIJAY  KAMDAR ":                "VIJAY KAMDAR",
	} {
		if got := domain.NormalizePromoterName(in); got != want {
			t.Errorf("NormalizePromoterName(%q) = %q, want %q", in, got, want)
		}
	}
}
