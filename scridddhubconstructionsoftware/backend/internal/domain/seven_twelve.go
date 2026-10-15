package domain

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

// The 7/12 extract (सातबारा उतारा, village forms 7 and 12) is the record of rights for a piece of
// agricultural land in Maharashtra: who holds it, its tenure class, its area, and other rights on
// it (bank charges, tenants, acquisition). A person uploads a photo of one; the AI reads it into
// SevenTwelve as a draft; a person checks every field and confirms. Nothing read by the AI is used
// in a report until it's confirmed (AI drafts, a person signs).

type SevenTwelveOwner struct {
	Name       string `json:"name"`
	AreaHR     string `json:"area_hr,omitempty"`     // as written, hectare.are(.sqm)
	MutationNo string `json:"mutation_no,omitempty"` // the Ferfar entry that gave this right
	Former     bool   `json:"former"`                // bracketed / struck through: a past holder, not a current one
}

type SevenTwelve struct {
	District     string `json:"district"`
	Taluka       string `json:"taluka"`
	Village      string `json:"village"`
	SurveyNumber string `json:"survey_number"` // survey/gat no. with hissa as written
	// Tenure (भूधारणा पद्धती): class_1, class_2, govt_lease, or "" when it can't be read.
	Tenure      string `json:"tenure"`
	TotalAreaHR string `json:"total_area_hr"` // as written, e.g. "1.23.45"
	// AreaUnit is the unit the 7/12 prints (क्षेत्राचे एकक): "" or AreaUnitHectare for हे.आर.चौ.मी,
	// AreaUnitAre for आर.चौ.मी, which NA land uses ("11.60.00" there is 1,160 sq m, not 11 ha).
	AreaUnit   string `json:"area_unit,omitempty"`
	PotKharaba string `json:"pot_kharaba,omitempty"`

	Owners           []SevenTwelveOwner `json:"owners"`
	Tenants          string             `json:"tenants,omitempty"`       // कुळाचे नाव
	OtherRights      []string           `json:"other_rights"`            // इतर हक्क, one entry each
	PendingMutations []string           `json:"pending_mutations"`       // प्रलंबित फेरफार
	LastMutation     string             `json:"last_mutation,omitempty"` // शेवटचा फेरफार क्रमांक व दिनांक
	IsNA             bool               `json:"is_na"`                   // form 12 replaced by the NA note
	DigitallySigned  bool               `json:"digitally_signed"`        // QR code / 16-digit verification number seen
	// Set for a signed copy from Digital Satbara: the number to verify it with on
	// digitalsatbara.mahabhumi.gov.in/dslr/, and the date it was signed (as printed).
	VerificationNo string `json:"verification_no,omitempty"`
	SignedOn       string `json:"signed_on,omitempty"`

	Notes string `json:"notes,omitempty"` // anything the reader couldn't place, or couldn't read
}

const (
	AreaUnitHectare = "hectare" // हे.आर.चौ.मी
	AreaUnitAre     = "are"     // आर.चौ.मी
)

// AreaSqm is the total area in square metres, read in the unit the 7/12 prints.
func (s *SevenTwelve) AreaSqm() (float64, error) {
	if s.AreaUnit == AreaUnitAre {
		return ParseAreSqm(s.TotalAreaHR)
	}
	return ParseHectareAre(s.TotalAreaHR)
}

// LandRecord is a confirmed 7/12 for one survey number of a parcel. A parcel has one per survey
// number it spans (migration 053).
type LandRecord struct {
	ID           uuid.UUID
	LandParcelID uuid.UUID
	SurveyKey    string // SurveyKey(Data.SurveyNumber)
	Data         SevenTwelve
	ReadBy       string // the AI model that drafted it ("" if typed by hand)
	ConfirmedBy  string
	ConfirmedAt  time.Time
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

func (s *SevenTwelve) Validate() error {
	if strings.TrimSpace(s.SurveyNumber) == "" {
		return fmt.Errorf("survey number is required")
	}
	switch s.Tenure {
	case "", "class_1", "class_2", "govt_lease":
	default:
		return fmt.Errorf("invalid tenure: %q", s.Tenure)
	}
	switch s.AreaUnit {
	case "", AreaUnitHectare, AreaUnitAre:
	default:
		return fmt.Errorf("invalid area unit: %q", s.AreaUnit)
	}
	if s.TotalAreaHR != "" {
		if _, err := s.AreaSqm(); err != nil {
			return fmt.Errorf("total area: %w", err)
		}
	}
	current := 0
	for _, o := range s.Owners {
		if strings.TrimSpace(o.Name) == "" {
			return fmt.Errorf("every owner needs a name")
		}
		if !o.Former {
			current++
		}
	}
	if current == 0 {
		return fmt.Errorf("at least one current holder is required")
	}
	if s.OtherRights == nil {
		s.OtherRights = []string{}
	}
	if s.PendingMutations == nil {
		s.PendingMutations = []string{}
	}
	return nil
}

// ParseHectareAre reads a 7/12 area such as "1.23.45" (1 hectare, 23 are, 45 sq m) or "0.40"
// (40 are) into square metres. It isn't a decimal: "1.5" means 1 ha 5 are, not 1.5 ha.
func ParseHectareAre(s string) (float64, error) {
	s = strings.TrimSpace(devanagariDigits.Replace(s))
	parts := strings.Split(s, ".")
	if len(parts) < 1 || len(parts) > 3 {
		return 0, fmt.Errorf("can't read area %q (expected hectare.are or hectare.are.sqm)", s)
	}
	n := make([]float64, 3)
	for i, p := range parts {
		v, err := strconv.Atoi(strings.TrimSpace(p))
		if err != nil || v < 0 {
			return 0, fmt.Errorf("can't read area %q", s)
		}
		if i > 0 && v >= 100 {
			return 0, fmt.Errorf("area %q: are and sq m parts must be below 100", s)
		}
		n[i] = float64(v)
	}
	return n[0]*10000 + n[1]*100 + n[2], nil
}

// ParseAreSqm reads an area printed in आर.चौ.मी (are and sq m), as NA land's 7/12 is: "11.60.00"
// is 11 are 60.00 sq m = 1,160 sq m (the third part is hundredths of a sq m).
func ParseAreSqm(s string) (float64, error) {
	s = strings.TrimSpace(devanagariDigits.Replace(s))
	parts := strings.Split(s, ".")
	if len(parts) < 1 || len(parts) > 3 {
		return 0, fmt.Errorf("can't read area %q (expected are.sqm or are.sqm.hundredths)", s)
	}
	n := make([]float64, 3)
	for i, p := range parts {
		v, err := strconv.Atoi(strings.TrimSpace(p))
		if err != nil || v < 0 {
			return 0, fmt.Errorf("can't read area %q", s)
		}
		if i > 0 && v >= 100 {
			return 0, fmt.Errorf("area %q: sq m and hundredths parts must be below 100", s)
		}
		n[i] = float64(v)
	}
	return n[0]*100 + n[1] + n[2]/100, nil
}

// SameSurveyNumber compares survey numbers written different ways: "45/2A", "45/2/अ" and
// "४५/२ अ" are the same land. Hissa letters अ ब क ड map to A B C D.
func SameSurveyNumber(a, b string) bool {
	return SurveyKey(a) != "" && SurveyKey(a) == SurveyKey(b)
}

// SurveyKey is a survey number reduced to digits and hissa letters ("45/2/अ" → "452A"), the key
// the land record cache is stored under.
func SurveyKey(s string) string {
	s = devanagariDigits.Replace(strings.ToUpper(s))
	s = strings.NewReplacer("अ", "A", "ब", "B", "क", "C", "ड", "D", "इ", "E").Replace(s)
	var out strings.Builder
	for _, r := range s {
		if (r >= '0' && r <= '9') || (r >= 'A' && r <= 'Z') {
			out.WriteRune(r)
		}
	}
	return out.String()
}

var devanagariDigits = strings.NewReplacer("०", "0", "१", "1", "२", "2", "३", "3", "४", "4", "५", "5", "६", "6", "७", "7", "८", "8", "९", "9")

// SevenTwelveFlag is a warning raised from what the 7/12 says. Rules, not AI.
type SevenTwelveFlag struct {
	Level string `json:"level"` // high | medium
	Text  string `json:"text"`
}

// Flags reads the warning signs a buyer must see on a 7/12.
func (s *SevenTwelve) Flags(parcelAreaAcres *float64) []SevenTwelveFlag {
	out := []SevenTwelveFlag{}
	add := func(level, text string) { out = append(out, SevenTwelveFlag{Level: level, Text: text}) }

	switch s.Tenure {
	case "class_2":
		add("high", "Class II land: it can't be sold without the Collector's permission and a premium (nazrana).")
	case "govt_lease":
		add("high", "Government lease land: the holder doesn't own it outright.")
	case "":
		add("medium", "Tenure class couldn't be read. Check the भूधारणा पद्धती column.")
	}
	if strings.TrimSpace(s.Tenants) != "" {
		add("high", "A tenant (कुळ) is recorded: "+s.Tenants+". Tenancy rights can block a sale.")
	}
	for _, r := range s.OtherRights {
		l := strings.ToLower(r)
		switch {
		case strings.HasPrefix(r, NAPermissionPrefix):
			continue // a permission granted, not a burden
		case strings.Contains(r, "तुकडा"):
			add("medium", "Fragment (तुकडा) entry: "+r+". Check the land meets the minimum holding size for the intended use, or that the restriction no longer applies.")
		case strings.Contains(r, "बोजा") || strings.Contains(l, "bank") || strings.Contains(l, "loan") || strings.Contains(r, "कर्ज"):
			add("high", "Charge on the land (बोजा): "+r)
		case strings.Contains(r, "संपादन") || strings.Contains(l, "acquisition"):
			add("high", "Acquisition entry: "+r)
		case strings.Contains(r, "कुळ") || strings.Contains(l, "tenan"):
			add("high", "Tenancy entry: "+r)
		case strings.Contains(r, "43") || strings.Contains(l, "restrict") || strings.Contains(r, "प्रतिबंध"):
			add("high", "Restriction on transfer: "+r)
		default:
			add("medium", "Other right recorded: "+r)
		}
	}
	for _, m := range s.PendingMutations {
		add("medium", "Pending mutation (not yet certified): "+m)
	}
	if !s.DigitallySigned {
		add("medium", "This copy isn't digitally signed (no QR code or verification number). Get a signed copy from Mahabhumi.")
	}
	current := 0
	for _, o := range s.Owners {
		if !o.Former {
			current++
		}
	}
	if current > 1 {
		add("medium", fmt.Sprintf("%d current holders: every one of them must sign the sale.", current))
	}
	if parcelAreaAcres != nil && s.TotalAreaHR != "" {
		if sqm, err := s.AreaSqm(); err == nil && sqm > 0 {
			recAcres := sqm / sqmPerAcre
			if diff := (recAcres - *parcelAreaAcres) / *parcelAreaAcres; diff > 0.05 || diff < -0.05 {
				add("medium", fmt.Sprintf("Area on the 7/12 is %.2f acres, but the parcel was entered as %.2f acres.", recAcres, *parcelAreaAcres))
			}
		}
	}
	return out
}
