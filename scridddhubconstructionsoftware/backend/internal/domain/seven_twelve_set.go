package domain

import (
	"fmt"
	"sort"
	"strings"
)

// A parcel's 7/12s taken together: one per survey number it spans. Warnings that only show when
// they're read side by side (a survey number with no 7/12 yet, different holders on different
// pieces, the total area against the parcel's) are worked out here. Rules, not AI.

// SevenTwelveSet is the parcel's confirmed 7/12s and what they add up to.
type SevenTwelveSet struct {
	Records        []LandRecord      `json:"-"`
	Flags          []SevenTwelveFlag `json:"flags"`
	TotalAreaSqm   float64           `json:"total_area_sqm"`
	Missing        []string          `json:"missing"`         // parcel survey numbers with no confirmed 7/12
	Extra          []string          `json:"extra"`           // confirmed 7/12s for survey numbers not on the parcel
	CurrentHolders []string          `json:"current_holders"` // everyone who must sign, across all pieces
}

// NewSevenTwelveSet sorts the records by survey number and works out the combined warnings.
// parcelSurveys are the parcel's survey numbers; parcelAreaAcres its total area, if known.
func NewSevenTwelveSet(records []LandRecord, parcelSurveys []string, parcelAreaAcres *float64) SevenTwelveSet {
	recs := append([]LandRecord(nil), records...)
	sort.SliceStable(recs, func(i, j int) bool { return surveyLess(recs[i].Data.SurveyNumber, recs[j].Data.SurveyNumber) })
	set := SevenTwelveSet{Records: recs, Flags: []SevenTwelveFlag{}, Missing: []string{}, Extra: []string{}, CurrentHolders: []string{}}
	add := func(level, text string) { set.Flags = append(set.Flags, SevenTwelveFlag{Level: level, Text: text}) }

	have := map[string]bool{}
	for _, r := range recs {
		have[SurveyKey(r.Data.SurveyNumber)] = true
	}
	want := map[string]bool{}
	for _, s := range parcelSurveys {
		want[SurveyKey(s)] = true
		if !have[SurveyKey(s)] {
			set.Missing = append(set.Missing, s)
		}
	}
	if len(set.Missing) > 0 && len(recs) > 0 {
		add("high", "No 7/12 yet for "+strings.Join(set.Missing, ", ")+": part of the land is unchecked.")
	}

	// One 7/12 for land on one survey number: its own checks apply as they are. Otherwise the area
	// and holder checks are made across the set (a single piece's area isn't the parcel's).
	single := len(recs) == 1 && len(parcelSurveys) <= 1
	holderPieces := map[string][]string{} // holder → survey numbers
	var holderOrder []string
	areaKnown := len(recs) > 0
	for _, r := range recs {
		survey := r.Data.SurveyNumber
		if len(want) > 0 && !want[SurveyKey(survey)] {
			set.Extra = append(set.Extra, survey)
			add("high", fmt.Sprintf("A 7/12 for %s is saved, but %s isn't one of this parcel's survey numbers. Make sure it's the right land.", survey, survey))
		}
		// Each 7/12's own warnings. The area and holder-count checks are done across all of them
		// below, unless there's only one.
		var area *float64
		if single {
			area = parcelAreaAcres
		}
		for _, f := range r.Data.Flags(area) {
			if !single && strings.Contains(f.Text, "current holders: every one of them must sign") {
				continue
			}
			if !single {
				f.Text = survey + ": " + f.Text
			}
			set.Flags = append(set.Flags, f)
		}
		if sqm, err := r.Data.AreaSqm(); err == nil && sqm > 0 {
			set.TotalAreaSqm += sqm
		} else {
			areaKnown = false
		}
		for _, o := range r.Data.Owners {
			if o.Former {
				continue
			}
			name := strings.Join(strings.Fields(o.Name), " ")
			if _, ok := holderPieces[name]; !ok {
				holderOrder = append(holderOrder, name)
			}
			holderPieces[name] = append(holderPieces[name], survey)
		}
	}
	if holderOrder != nil {
		set.CurrentHolders = holderOrder
	}

	if !single && len(recs) > 0 {
		if len(holderOrder) > 1 {
			var parts []string
			for _, h := range holderOrder {
				parts = append(parts, fmt.Sprintf("%s (%s)", h, strings.Join(holderPieces[h], ", ")))
			}
			where := fmt.Sprintf("across the %d survey numbers", len(recs))
			if len(recs) == 1 {
				where = "on " + recs[0].Data.SurveyNumber
			}
			add("medium", fmt.Sprintf("%d current holders %s: every one of them must sign: %s.",
				len(holderOrder), where, strings.Join(parts, "; ")))
		}
		if areaKnown && len(set.Missing) == 0 && parcelAreaAcres != nil && *parcelAreaAcres > 0 {
			recAcres := set.TotalAreaSqm / sqmPerAcre
			if diff := (recAcres - *parcelAreaAcres) / *parcelAreaAcres; diff > 0.05 || diff < -0.05 {
				add("medium", fmt.Sprintf("The 7/12s add up to %.2f acres (%.0f sq m), but the parcel was entered as %.2f acres.",
					recAcres, set.TotalAreaSqm, *parcelAreaAcres))
			}
		}
	}
	if !areaKnown {
		set.TotalAreaSqm = 0
	}
	return set
}

// surveyLess orders "42/3" before "42/4/2" and "9" before "10": compare number by number.
func surveyLess(a, b string) bool {
	pa, pb := surveyParts(a), surveyParts(b)
	for i := 0; i < len(pa) && i < len(pb); i++ {
		if pa[i] != pb[i] {
			na, ea := atoiOK(pa[i])
			nb, eb := atoiOK(pb[i])
			if ea && eb {
				return na < nb
			}
			return pa[i] < pb[i]
		}
	}
	return len(pa) < len(pb)
}

func surveyParts(s string) []string {
	s = devanagariDigits.Replace(s)
	return strings.FieldsFunc(s, func(r rune) bool { return r == '/' || r == ' ' || r == '-' })
}

func atoiOK(s string) (int, bool) {
	n := 0
	if s == "" {
		return 0, false
	}
	for _, r := range s {
		if r < '0' || r > '9' {
			return 0, false
		}
		n = n*10 + int(r-'0')
	}
	return n, true
}
