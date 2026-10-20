package domain

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

// Parcel Due-Diligence Report (screen 6.2, services/duediligencereport/README.md). The product
// builders pay for: a Quick Screen (automated, no lawyer) or a Full Report (signed by a partner
// advocate). Sections A, B, C, F and G are composed from data that already exists; the report
// itself stores land status (D), zoning/FSI (E), the verdict (H) and the sign-off.

const (
	ReportTierQuick = "quick"
	ReportTierFull  = "full"

	ReportStatusDraft  = "draft"
	ReportStatusSigned = "signed" // Full: an advocate signed it
	ReportStatusIssued = "issued" // Quick: issued without a lawyer

	VerdictGo       = "go"
	VerdictFixFirst = "fix_first"
	VerdictNoGo     = "no_go"

	VerdictSourceAIDraft = "ai_draft" // as the AI drafted it
	VerdictSourceEdited  = "edited"   // AI draft changed by a person
	VerdictSourcePerson  = "person"   // written by a person
)

var (
	ErrReportFinalised = errors.New("report is already final and can't be changed")
	ErrReportNotReady  = errors.New("report is not ready to finalise")
	ErrReportWrongTier = errors.New("wrong action for this report tier")
)

type DueDiligenceReport struct {
	ID           uuid.UUID
	LandParcelID uuid.UUID
	Tier         string
	Status       string

	OccupancyClass string // unknown | class_1 | class_2
	NAStatus       string // unknown | na_granted | in_process | not_na | not_needed
	TenancyRemarks string
	CRZForestESZ   string
	DPZone         string
	DPReservation  string

	// PlanningAuthority and RoadWidthM drive the indicative UDCPR FSI band. BaseFSI/MaxFSI are
	// the figures an architect confirms; when set they replace the band.
	PlanningAuthority string
	RoadWidthM        *float64
	BaseFSI           *float64
	MaxFSI            *float64
	DevelopmentNote   string

	// BuilderCalc is the builder's view of the land (residual land value), or nil if not entered.
	BuilderCalc *BuilderCalcInputs

	Verdict        string
	VerdictSummary string
	FixList        []string
	VerdictSource  string
	VerdictModel   string

	AdvocateName      string
	AdvocateEnrolment string
	// IssuedBy is the ScridddHub team member who issued the report: required for a Quick Screen,
	// recorded as the preparer on a Full report.
	IssuedBy     string
	FinalisedAt  *time.Time
	FrozenReport json.RawMessage // the composed report at sign/issue time

	CreatedAt time.Time
	UpdatedAt time.Time
}

func (r *DueDiligenceReport) Final() bool {
	return r.Status == ReportStatusSigned || r.Status == ReportStatusIssued
}

// Fingerprint identifies a finished report's frozen contents: the first 16 hex digits of their
// SHA-256, in groups of four ("3F9A 21C0 7B44 E812"). It's printed on the PDF; anyone can ask
// ScridddHub for the report by its ID and compare, so an edited copy shows. "" until final.
func (r *DueDiligenceReport) Fingerprint() string {
	if !r.Final() || len(r.FrozenReport) == 0 {
		return ""
	}
	sum := sha256.Sum256(r.FrozenReport)
	h := strings.ToUpper(hex.EncodeToString(sum[:8]))
	return h[0:4] + " " + h[4:8] + " " + h[8:12] + " " + h[12:16]
}

func validVerdict(v string) bool {
	return v == "" || v == VerdictGo || v == VerdictFixFirst || v == VerdictNoGo
}

// Validate checks the stored fields. It doesn't decide readiness to finalise; OpenItems does.
func (r *DueDiligenceReport) Validate() error {
	if r.LandParcelID == uuid.Nil {
		return fmt.Errorf("land_parcel_id is required")
	}
	if r.Tier != ReportTierQuick && r.Tier != ReportTierFull {
		return fmt.Errorf("invalid tier: %q", r.Tier)
	}
	switch r.OccupancyClass {
	case "", "unknown", "class_1", "class_2":
	default:
		return fmt.Errorf("invalid occupancy_class: %q", r.OccupancyClass)
	}
	switch r.NAStatus {
	case "", "unknown", "na_granted", "in_process", "not_na", "not_needed":
	default:
		return fmt.Errorf("invalid na_status: %q", r.NAStatus)
	}
	if !validVerdict(r.Verdict) {
		return fmt.Errorf("invalid verdict: %q", r.Verdict)
	}
	if r.PlanningAuthority != "" {
		ok := false
		for _, a := range PlanningAuthorities {
			ok = ok || a == r.PlanningAuthority
		}
		if !ok {
			return fmt.Errorf("invalid planning_authority: %q", r.PlanningAuthority)
		}
	}
	if r.RoadWidthM != nil && (*r.RoadWidthM <= 0 || *r.RoadWidthM > 200) {
		return fmt.Errorf("road width must be between 0 and 200 m")
	}
	if r.BaseFSI != nil && r.MaxFSI != nil && *r.MaxFSI < *r.BaseFSI {
		return fmt.Errorf("max FSI can't be below base FSI")
	}
	if r.OccupancyClass == "" {
		r.OccupancyClass = "unknown"
	}
	if r.NAStatus == "" {
		r.NAStatus = "unknown"
	}
	if r.FixList == nil {
		r.FixList = []string{}
	}
	return nil
}

// OpenItems lists what must be filled before the report can be finalised. A Full report also
// needs the land status a lawyer would confirm; both tiers need a verdict.
func (r *DueDiligenceReport) OpenItems() []string {
	var open []string
	if r.Verdict == "" {
		open = append(open, "verdict")
	}
	if strings.TrimSpace(r.VerdictSummary) == "" {
		open = append(open, "verdict summary")
	}
	if r.Verdict == VerdictFixFirst && len(r.FixList) == 0 {
		open = append(open, "what to fix")
	}
	if r.Tier == ReportTierFull {
		if r.OccupancyClass == "unknown" || r.OccupancyClass == "" {
			open = append(open, "occupancy class")
		}
		if r.NAStatus == "unknown" || r.NAStatus == "" {
			open = append(open, "NA status")
		}
		if strings.TrimSpace(r.DPZone) == "" {
			open = append(open, "DP zone")
		}
	}
	return open
}

// Finalise freezes the report. A Full report needs the advocate's name and enrolment number and
// becomes "signed"; a Quick Screen becomes "issued" with no lawyer.
func (r *DueDiligenceReport) Finalise(advocateName, advocateEnrolment, issuedBy string, frozen json.RawMessage, at time.Time) error {
	if r.Final() {
		return ErrReportFinalised
	}
	if open := r.OpenItems(); len(open) > 0 {
		return fmt.Errorf("%w: %s", ErrReportNotReady, strings.Join(open, ", "))
	}
	issuedBy = strings.TrimSpace(issuedBy)
	if r.Tier != ReportTierFull && issuedBy == "" {
		return fmt.Errorf("%w: the name of the person issuing it", ErrReportNotReady)
	}
	r.IssuedBy = issuedBy
	if r.Tier == ReportTierFull {
		if strings.TrimSpace(advocateName) == "" || strings.TrimSpace(advocateEnrolment) == "" {
			return fmt.Errorf("%w: advocate name and enrolment number", ErrReportNotReady)
		}
		r.AdvocateName, r.AdvocateEnrolment = strings.TrimSpace(advocateName), strings.TrimSpace(advocateEnrolment)
		r.Status = ReportStatusSigned
	} else {
		r.Status = ReportStatusIssued
	}
	r.FrozenReport = frozen
	r.FinalisedAt = &at
	return nil
}

// ReportVerdictDraft is what the AI proposes for section H. Fix items must name the section they
// come from ("B: ...", "D: ..."), so every suggestion traces to evidence in the report.
type ReportVerdictDraft struct {
	Verdict string
	Summary string
	FixList []string
}

// CleanVerdictDraft keeps only a valid verdict and fix items that cite a report section A–G.
func CleanVerdictDraft(d ReportVerdictDraft) (ReportVerdictDraft, error) {
	d.Verdict = strings.TrimSpace(strings.ToLower(d.Verdict))
	if d.Verdict == "" || !validVerdict(d.Verdict) {
		return d, fmt.Errorf("AI returned an invalid verdict: %q", d.Verdict)
	}
	var kept []string
	for _, f := range d.FixList {
		f = strings.TrimSpace(f)
		if len(f) > 2 && strings.ContainsRune("ABCDEFG", rune(f[0])) && (f[1] == ':' || f[1] == '.') {
			kept = append(kept, f)
		}
	}
	if kept == nil {
		kept = []string{}
	}
	d.FixList = kept
	d.Summary = strings.TrimSpace(d.Summary)
	return d, nil
}
