package domain

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
)

// The mutation register (फेरफार, village form 6) records every change of rights on a survey
// number: sales, inheritance, gifts, partitions, bank charges and their release, NA orders, court
// orders, acquisition. Read in order, it is the ownership chain a 30-year title search traces.
// A person uploads photos of the entries; the AI reads them into a draft; a person checks every
// entry and confirms. The checks below are rules, not AI.

const (
	MutationSale          = "sale"
	MutationInheritance   = "inheritance" // वारस
	MutationGift          = "gift"        // बक्षीस
	MutationPartition     = "partition"   // वाटप
	MutationCharge        = "charge"      // बोजा, loan
	MutationChargeRelease = "charge_released"
	MutationNA            = "na"
	MutationCourtOrder    = "court_order"
	MutationAcquisition   = "acquisition"
	MutationOther         = "other"
)

var mutationTypes = map[string]string{
	MutationSale: "Sale", MutationInheritance: "Inheritance", MutationGift: "Gift", MutationPartition: "Partition",
	MutationCharge: "Bank charge", MutationChargeRelease: "Charge released", MutationNA: "NA order",
	MutationCourtOrder: "Court order", MutationAcquisition: "Acquisition", MutationOther: "Other",
}

// MutationTypeLabel is the English label for a mutation type.
func MutationTypeLabel(t string) string {
	if l, ok := mutationTypes[t]; ok {
		return l
	}
	return "Other"
}

type MutationEntry struct {
	Number        string `json:"number"`
	Date          string `json:"date"` // as written, dd/mm/yyyy
	Type          string `json:"type"`
	From          string `json:"from,omitempty"` // whose right ended
	To            string `json:"to,omitempty"`   // whose right began (or the bank, for a charge)
	SurveyNumbers string `json:"survey_numbers,omitempty"`
	Status        string `json:"status"` // certified | pending | rejected | ""
	Remarks       string `json:"remarks,omitempty"`
	// RawText is the "nature of right" column exactly as written. The type is decided from it by
	// rules (ClassifyMutationText), not by the model: on a test page the model called a sale
	// (खरेदी) a "charge released", which would have hidden an unpaid bank loan.
	RawText string `json:"raw_text,omitempty"`
}

// mutationKeywords: the words a mutation entry uses for its nature of right, most specific first.
var mutationKeywords = []struct {
	word, kind string
}{
	{"बोजा कमी", MutationChargeRelease}, {"बोजा उतरव", MutationChargeRelease}, {"कर्ज फेड", MutationChargeRelease},
	{"कर्जफेड", MutationChargeRelease}, {"बोजा मुक्त", MutationChargeRelease},
	{"भूसंपादन", MutationAcquisition}, {"भू संपादन", MutationAcquisition},
	{"न्यायालय", MutationCourtOrder}, {"कोर्ट", MutationCourtOrder},
	{"बिनशेती", MutationNA},
	{"खरेदी", MutationSale}, {"विक्री", MutationSale},
	{"वारस", MutationInheritance},
	{"बक्षीस", MutationGift},
	{"वाटप", MutationPartition}, {"वाटणी", MutationPartition},
	{"बोजा", MutationCharge}, {"कर्ज", MutationCharge}, {"गहाण", MutationCharge},
}

// ClassifyMutationText decides an entry's type from the words written in it. ok is false when no
// known word appears; the model's guess is then kept for a person to check.
func ClassifyMutationText(raw string) (kind string, ok bool) {
	for _, k := range mutationKeywords {
		if strings.Contains(raw, k.word) {
			return k.kind, true
		}
	}
	return "", false
}

type MutationRegister struct {
	Entries []MutationEntry `json:"entries"`
	Notes   string          `json:"notes,omitempty"`
}

func (m *MutationRegister) Validate() error {
	if len(m.Entries) == 0 {
		return fmt.Errorf("at least one mutation entry is required")
	}
	for i, e := range m.Entries {
		if strings.TrimSpace(e.Number) == "" {
			return fmt.Errorf("entry %d: mutation number is required", i+1)
		}
		if _, ok := mutationTypes[e.Type]; !ok {
			return fmt.Errorf("entry %s: invalid type %q", e.Number, e.Type)
		}
		switch e.Status {
		case "", "certified", "pending", "rejected":
		default:
			return fmt.Errorf("entry %s: invalid status %q", e.Number, e.Status)
		}
		if e.Date != "" {
			if _, err := ParseMutationDate(e.Date); err != nil {
				return fmt.Errorf("entry %s: %w", e.Number, err)
			}
		}
	}
	return nil
}

// ParseMutationDate reads dd/mm/yyyy (also dd-mm-yyyy, dd.mm.yyyy, Devanagari digits).
func ParseMutationDate(s string) (time.Time, error) {
	s = strings.NewReplacer("-", "/", ".", "/").Replace(strings.TrimSpace(devanagariDigits.Replace(s)))
	for _, layout := range []string{"2/1/2006", "02/01/2006", "2/1/06"} {
		if t, err := time.Parse(layout, s); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("can't read date %q (expected dd/mm/yyyy)", s)
}

// SortedEntries returns the entries oldest first; undated entries go last, in number order.
func (m *MutationRegister) SortedEntries() []MutationEntry {
	out := append([]MutationEntry(nil), m.Entries...)
	sort.SliceStable(out, func(i, j int) bool {
		ti, ei := ParseMutationDate(out[i].Date)
		tj, ej := ParseMutationDate(out[j].Date)
		switch {
		case ei == nil && ej == nil:
			return ti.Before(tj)
		case ei == nil:
			return true
		case ej == nil:
			return false
		}
		return out[i].Number < out[j].Number
	})
	return out
}

// YearsCovered is how far back the dated entries go, in whole years before now.
func (m *MutationRegister) YearsCovered(now time.Time) int {
	oldest := time.Time{}
	for _, e := range m.Entries {
		if t, err := ParseMutationDate(e.Date); err == nil && (oldest.IsZero() || t.Before(oldest)) {
			oldest = t
		}
	}
	if oldest.IsZero() {
		return 0
	}
	return int(now.Sub(oldest).Hours() / 24 / 365.25)
}

// TitleSearchYears is the period a title search traces (Maharashtra practice).
const TitleSearchYears = 30

// Flags reads the warning signs in the mutation register.
func (m *MutationRegister) Flags(now time.Time) []SevenTwelveFlag {
	out := []SevenTwelveFlag{}
	add := func(level, text string) { out = append(out, SevenTwelveFlag{Level: level, Text: text}) }
	entries := m.SortedEntries()

	if y := m.YearsCovered(now); y < TitleSearchYears {
		add("medium", fmt.Sprintf("The entries go back %d years; a title search covers %d. Older mutations, old 7/12s or Index-II are needed for the rest.", y, TitleSearchYears))
	}
	for i, e := range entries {
		label := "Mutation " + e.Number
		switch e.Status {
		case "pending":
			add("medium", label+" is pending (not certified): "+MutationTypeLabel(e.Type)+". Rights under it aren't final.")
		case "rejected":
			add("medium", label+" was rejected: "+MutationTypeLabel(e.Type)+". Find out why before relying on the chain.")
		}
		switch e.Type {
		case MutationCharge:
			released := false
			for _, later := range entries[i+1:] {
				if later.Type == MutationChargeRelease {
					released = true
					break
				}
			}
			if !released {
				add("high", label+": a bank charge"+with(" in favour of ", e.To)+" with no later release entry. Get the bank's no-dues letter.")
			}
		case MutationInheritance:
			add("medium", label+": inheritance"+with(" to ", e.To)+". Check every legal heir is named or has released their share; a missing heir is the most common title dispute.")
		case MutationCourtOrder:
			add("high", label+": a court order. The advocate must read the order and check it's final.")
		case MutationAcquisition:
			add("high", label+": an acquisition entry. Part or all of the land may have been taken.")
		}
	}
	// Chain continuity: whoever transfers by sale or gift should have received rights earlier.
	seen := map[string]bool{}
	for _, e := range entries {
		if (e.Type == MutationSale || e.Type == MutationGift) && e.From != "" && len(seen) > 0 && !namedBefore(seen, e.From) {
			add("medium", "Mutation "+e.Number+": "+e.From+" transfers the land but doesn't appear as receiving it in an earlier entry. A link in the chain may be missing.")
		}
		for _, n := range splitNames(e.To) {
			seen[normalizeName(n)] = true
		}
	}
	return out
}

// with returns prefix+value, or "" when value is empty.
func with(prefix, value string) string {
	if strings.TrimSpace(value) == "" {
		return ""
	}
	return prefix + value
}

func splitNames(s string) []string {
	f := strings.FieldsFunc(s, func(r rune) bool { return r == ',' || r == ';' || r == '\n' })
	var out []string
	for _, n := range f {
		if n = strings.TrimSpace(n); n != "" {
			out = append(out, n)
		}
	}
	return out
}

func normalizeName(s string) string {
	return strings.Join(strings.Fields(strings.ToLower(s)), " ")
}

func namedBefore(seen map[string]bool, from string) bool {
	for _, n := range splitNames(from) {
		if seen[normalizeName(n)] {
			return true
		}
	}
	return false
}

// LandMutations is a parcel's confirmed mutation register.
type LandMutations struct {
	ID           uuid.UUID
	LandParcelID uuid.UUID
	Data         MutationRegister
	ReadBy       string
	ConfirmedBy  string
	ConfirmedAt  time.Time
	CreatedAt    time.Time
	UpdatedAt    time.Time
}
