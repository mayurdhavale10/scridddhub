// Package rera collects public records from MahaRERA's website: the registered project list
// and the promoter-wise complaint list. Both pages are public and have no captcha; the newer
// maharerait portal's search does have one and is not used. See
// services/legalcheck/README.md.
package rera

import (
	"html"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/scridddhub/backend/internal/domain"
)

var (
	// Each project is a card that starts with `<div class="row shadow p-3 mb-5 bg-body rounded">`.
	cardSplit    = regexp.MustCompile(`<div class="row shadow p-3 mb-5 bg-body rounded">`)
	regNumberRe  = regexp.MustCompile(`#\s*(P[0-9]{8,14})`)
	projectName  = regexp.MustCompile(`(?s)<h4 class="title4"><strong>(.*?)</strong></h4>`)
	promoterRe   = regexp.MustCompile(`(?s)<p class="darkBlue bold\s*">(.*?)</p>`)
	locationRe   = regexp.MustCompile(`(?s)fa-location-dot"></em>(.*?)</a>`)
	labelValueRe = regexp.MustCompile(`(?s)<div class="greyColor">\s*([^<]+?)\s*</div>\s*<p>(.*?)</p>`)
	extensionRe  = regexp.MustCompile(`(?s)Extension Certificate</div>(.{0,200})`)
	detailsRe    = regexp.MustCompile(`href="(https://maharerait\.maharashtra\.gov\.in/public/project/view/[0-9]+)"`)
	totalRe      = regexp.MustCompile(`Showing Final\s*<span class="colorBlue">\s*([0-9,]+)\s*</span>`)
	tagRe        = regexp.MustCompile(`<[^>]+>`)

	complaintRow = regexp.MustCompile(`(?s)<tr>\s*<td class="center">\s*[0-9]+\s*</td>\s*<td>(.*?)</td>\s*<td>\s*([0-9]+)\s*</td>\s*<td class="center"><a href="([^"]+)"`)
	pagesOfRe    = regexp.MustCompile(`of\s+([0-9,]+)\s*<`)
)

func clean(s string) string {
	s = tagRe.ReplaceAllString(s, " ")
	s = html.UnescapeString(s)
	return strings.Join(strings.Fields(s), " ")
}

func atoi(s string) int {
	n, _ := strconv.Atoi(strings.ReplaceAll(s, ",", ""))
	return n
}

// ParseProjectPage reads one page of the project search results. total is the number of
// results MahaRERA reports for the whole search (0 if not shown).
func ParseProjectPage(page string, fetchedAt time.Time) (projects []domain.RERAProject, total int) {
	if m := totalRe.FindStringSubmatch(page); m != nil {
		total = atoi(m[1])
	}
	cards := cardSplit.Split(page, -1)
	for _, card := range cards[1:] {
		reg := regNumberRe.FindStringSubmatch(card)
		if reg == nil {
			continue
		}
		p := domain.RERAProject{RegistrationNumber: reg[1], FetchedAt: fetchedAt}
		if m := projectName.FindStringSubmatch(card); m != nil {
			p.ProjectName = clean(m[1])
		}
		if m := promoterRe.FindStringSubmatch(card); m != nil {
			p.PromoterName = clean(m[1])
		}
		if m := locationRe.FindStringSubmatch(card); m != nil {
			p.Location = clean(m[1])
		}
		for _, lv := range labelValueRe.FindAllStringSubmatch(card, -1) {
			value := clean(lv[2])
			switch clean(lv[1]) {
			case "Pincode":
				p.Pincode = value
			case "District":
				p.District = value
			case "Last Modified":
				if t, err := time.Parse("2006-01-02", value); err == nil {
					p.LastModified = &t
				}
			}
		}
		if m := extensionRe.FindStringSubmatch(card); m != nil {
			p.HasExtension = strings.Contains(m[1], "DocProjectExtCert")
		}
		if m := detailsRe.FindStringSubmatch(card); m != nil {
			p.DetailsURL = m[1]
		}
		projects = append(projects, p)
	}
	return projects, total
}

// ParseComplaintPage reads one page of the promoter-wise complaint list. pages is the total
// page count MahaRERA shows ("Pages 1 of 542"), 0 if not shown.
func ParseComplaintPage(page string, fetchedAt time.Time) (rows []domain.RERAPromoterComplaints, pages int) {
	for _, m := range complaintRow.FindAllStringSubmatch(page, -1) {
		rows = append(rows, domain.RERAPromoterComplaints{
			PromoterName: clean(m[1]),
			Complaints:   atoi(m[2]),
			ViewURL:      html.UnescapeString(m[3]),
			FetchedAt:    fetchedAt,
		})
	}
	if i := strings.Index(page, "Pages"); i >= 0 {
		if m := pagesOfRe.FindStringSubmatch(page[i:]); m != nil {
			pages = atoi(m[1])
		}
	}
	return rows, pages
}
