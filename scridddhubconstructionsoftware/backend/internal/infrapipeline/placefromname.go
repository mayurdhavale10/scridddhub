package infrapipeline

import (
	"regexp"
	"strings"
)

var (
	// The place follows the last " at " / " near " / " in " of a title: "Flyover at Burfiwala
	// Junction, Andheri", "ROB widening at kms 24/4-5 on JVLR at Kanjurmarg".
	placeMarker = regexp.MustCompile(`(?i)\s(?:at|near|in)\s`)
	// What follows the place is a road it's on, not the place: "... Malad junction on Western
	// Express Highway".
	onRoad = regexp.MustCompile(`(?i)\s(?:on|along|over)\s.*$`)
	// Generic words that make a geocoder miss ("Malad junction" -> "Malad").
	genericWords = regexp.MustCompile(`(?i)\b(?:junction|jn\.?|chowk|lane|building|area|road|station|bridge|flyover)\b`)
	hasLetter    = regexp.MustCompile(`\pL`)
	hasDigit     = regexp.MustCompile(`\d`)
)

// PlaceFromName returns the place a project's own title names, or "" if it names none: "Flyovers
// at Barfiwala Lane Junction, Andheri" -> "Andheri"; "Flyover at Times Of India Building,Malad
// junction on Western Express Highway" -> "Malad". MSRDC lists many projects whose page gives no
// other location (2026-09-28 dry run: 13 skipped), yet the title says where they are.
func PlaceFromName(name string) string {
	locs := placeMarker.FindAllStringIndex(name, -1)
	if len(locs) == 0 {
		return ""
	}
	s := name[locs[len(locs)-1][1]:]
	s = onRoad.ReplaceAllString(s, "")
	if i := strings.LastIndex(s, ","); i >= 0 {
		s = s[i+1:] // "Barfiwala Lane Junction, Andheri" -> the locality after the comma
	}
	s = strings.Join(strings.Fields(genericWords.ReplaceAllString(s, " ")), " ")
	s = strings.Trim(s, " .-–")
	if s == "" || len(s) > 40 || !hasLetter.MatchString(s) || hasDigit.MatchString(s) {
		return "" // "kms 24/4-5" is a chainage, not a place
	}
	return s
}

// addPlaceFromName gives a project with no location the place its title names, cited with the
// verified quote of the title — only when that quote actually contains the place, so the rule
// that every stored value is quoted from the page still holds. Reports whether it added one.
func addPlaceFromName(vp *VerifiedProject) bool {
	nameQuote, ok := vp.FieldEvidence["name"]
	if !ok {
		return false
	}
	place := PlaceFromName(vp.Project.Name)
	if place == "" || !strings.Contains(strings.ToLower(nameQuote), strings.ToLower(place)) {
		return false
	}
	vp.Project.Localities = append(vp.Project.Localities, NamedPlace{Name: place, Evidence: nameQuote})
	vp.FieldEvidence["locality:"+place] = nameQuote
	return true
}
