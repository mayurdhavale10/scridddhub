package domain

import (
	"regexp"
	"strings"
	"time"
)

// RERAProject is one registered project from MahaRERA's public project search
// (www.maharera.maharashtra.gov.in/projects-search-result). Used to build a seller's or
// co-developer's track record on the Legal & RERA Check screen.
type RERAProject struct {
	RegistrationNumber string
	ProjectName        string
	PromoterName       string
	Location           string
	Pincode            string
	District           string
	// LastModified is the date MahaRERA shows as "Last Modified" for the registration.
	LastModified *time.Time
	// HasExtension is true when MahaRERA lists an extension certificate: the promoter asked
	// for more time to complete. It's the public list's only delay signal.
	HasExtension bool
	DetailsURL   string
	FetchedAt    time.Time
}

// RERAPromoterComplaints is one row of MahaRERA's "Promoter Wise Complaint List". A promoter
// missing from that list has no complaints on record.
type RERAPromoterComplaints struct {
	PromoterName string
	Complaints   int
	ViewURL      string
	FetchedAt    time.Time
}

// RERAPromoterMatch is a promoter name found in collected MahaRERA projects.
type RERAPromoterMatch struct {
	PromoterName string
	Projects     int
}

// RERASellerHistory is everything collected about one promoter.
type RERASellerHistory struct {
	PromoterName string
	Projects     []RERAProject
	// Complaints is nil when the complaint list hasn't been collected yet, so "0" is only
	// claimed when it's actually known.
	Complaints    *int
	WithExtension int
	// ProjectsComplete is true once a statewide collection has finished, so the project count
	// can be called a total rather than "found so far".
	ProjectsComplete bool
	ProjectsAsOf     *time.Time
	ComplaintsAsOf   *time.Time
}

var (
	nonAlnum      = regexp.MustCompile(`[^A-Z0-9 ]+`)
	spaces        = regexp.MustCompile(`\s+`)
	companySuffix = regexp.MustCompile(`\b(PRIVATE LIMITED|PVT LTD|PVT|LIMITED|LTD|LLP|CO|COMPANY|AND CO)$`)
	leadingMS     = regexp.MustCompile(`^M S `)
)

// NormalizePromoterName makes MahaRERA promoter names comparable: "M/s. Mayfair Housing Pvt.
// Ltd." and "MAYFAIR HOUSING PRIVATE LIMITED" both become "MAYFAIR HOUSING".
func NormalizePromoterName(name string) string {
	s := strings.ToUpper(name)
	s = strings.ReplaceAll(s, "&", " AND ")
	s = nonAlnum.ReplaceAllString(s, " ")
	s = strings.TrimSpace(spaces.ReplaceAllString(s, " "))
	s = leadingMS.ReplaceAllString(s, "")
	for {
		t := strings.TrimSpace(companySuffix.ReplaceAllString(s, ""))
		if t == s || t == "" {
			break
		}
		s = t
	}
	return s
}
