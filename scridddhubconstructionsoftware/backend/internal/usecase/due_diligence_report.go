package usecase

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
)

// Parcel Due-Diligence Report (services/duediligencereport/README.md). The report row holds only
// what the report adds (land status, zoning/FSI, verdict, sign-off); every other section is
// composed here from data the parcel already has. Once finalised, the composed sections are
// frozen on the row and served from there, so a signed report never changes.

type DueDiligenceReportRepository interface {
	Create(ctx context.Context, actor string, r *domain.DueDiligenceReport) error
	Get(ctx context.Context, id uuid.UUID) (*domain.DueDiligenceReport, error)
	ListByParcel(ctx context.Context, parcelID uuid.UUID) ([]*domain.DueDiligenceReport, error)
	Update(ctx context.Context, actor string, r *domain.DueDiligenceReport) error
}

type LegalCheckGetter interface {
	GetByLandParcel(ctx context.Context, landParcelID uuid.UUID) (*domain.LegalCheck, error)
}

type AssessmentGetter interface {
	GetByLandParcel(ctx context.Context, landParcelID uuid.UUID) (*domain.FeasibilityAssessment, error)
}

// ReportVerdictDrafter is implemented by internal/llm: it reads the composed sections and proposes
// section H. It never sees anything that isn't in the report.
type ReportVerdictDrafter interface {
	DraftVerdict(ctx context.Context, sections *ReportSections) (draft domain.ReportVerdictDraft, model string, err error)
}

// ReportSections is the composed report, A to G plus the report's own fields. It is what the app
// shows and what gets frozen at sign-off.
type ReportSections struct {
	AsOf time.Time `json:"as_of"`
	Tier string    `json:"tier"`

	// A. Snapshot
	ParcelName   string   `json:"parcel_name"`
	Location     string   `json:"location"`
	Village      string   `json:"village,omitempty"`
	Taluka       string   `json:"taluka,omitempty"`
	District     string   `json:"district,omitempty"`
	SurveyNumber string   `json:"survey_number,omitempty"`
	AreaAcres    *float64 `json:"area_acres,omitempty"`
	AskingRupees *int64   `json:"asking_rupees,omitempty"`
	Latitude     *float64 `json:"latitude,omitempty"`
	Longitude    *float64 `json:"longitude,omitempty"`

	// The parcel's confirmed 7/12: holders, tenure, other rights, and the warning signs read from it.
	SevenTwelve *ReportSevenTwelve `json:"seven_twelve,omitempty"`

	// D. Eco-sensitive zone check: one result per notification checked (village lists).
	ESZ []ReportESZ `json:"esz"`

	// B. The confirmed mutation register (Ferfar), oldest first: the ownership chain.
	Mutations *ReportMutations `json:"mutations,omitempty"`

	// B, C, F come from the Legal & RERA check; LegalCheckStarted is false when there isn't one.
	LegalCheckStarted bool                           `json:"legal_check_started"`
	LegalCheckStatus  string                         `json:"legal_check_status,omitempty"`
	Risks             []ReportRisk                   `json:"risks"`
	TitleChain        []domain.OwnershipChainEntry   `json:"title_chain"`
	Searches          []domain.EncumbranceSearchItem `json:"searches"`
	SearchSummary     string                         `json:"search_summary,omitempty"`
	Documents         []domain.LegalDocument         `json:"documents"`
	SellerProjects    []domain.RERAHistoryEntry      `json:"seller_projects"`
	SellerSummary     string                         `json:"seller_summary,omitempty"`

	// D. Land status and E. development potential (the report's own fields)
	OccupancyClass    string        `json:"occupancy_class"`
	NAStatus          string        `json:"na_status"`
	TenancyRemarks    string        `json:"tenancy_remarks,omitempty"`
	CRZForestESZ      string        `json:"crz_forest_esz,omitempty"`
	DPZone            string        `json:"dp_zone,omitempty"`
	DPReservation     string        `json:"dp_reservation,omitempty"`
	PlanningAuthority string        `json:"planning_authority,omitempty"`
	RoadWidthM        *float64      `json:"road_width_m,omitempty"`
	FSIBand           *ReportFSI    `json:"fsi_band,omitempty"`
	FSINote           string        `json:"fsi_note,omitempty"`
	BaseFSI           *float64      `json:"base_fsi,omitempty"`
	MaxFSI            *float64      `json:"max_fsi,omitempty"`
	BuildableSqft     *int64        `json:"buildable_sqft,omitempty"`
	DevelopmentNote   string        `json:"development_note,omitempty"`
	Infrastructure    []ReportInfra `json:"infrastructure"`

	// G. Valuation (from the Valuation Summary)
	Valued             bool   `json:"valued"`
	ValueLowRupees     *int64 `json:"value_low_rupees,omitempty"`
	ValueLikelyRupees  *int64 `json:"value_likely_rupees,omitempty"`
	ValueHighRupees    *int64 `json:"value_high_rupees,omitempty"`
	FutureLikelyRupees *int64 `json:"future_likely_rupees,omitempty"`
	FutureYear         int16  `json:"future_year,omitempty"`
	PriceVerdict       string `json:"price_verdict,omitempty"`
	// ValueIndicative: no registered sales and no government rate behind the range, so it's a
	// rough indication only and doesn't judge the asking price.
	ValueIndicative bool   `json:"value_indicative,omitempty"`
	ValueBasis      string `json:"value_basis,omitempty"`

	// H. Verdict and sign-off
	Verdict           string     `json:"verdict,omitempty"`
	VerdictSummary    string     `json:"verdict_summary,omitempty"`
	FixList           []string   `json:"fix_list"`
	VerdictSource     string     `json:"verdict_source,omitempty"`
	VerdictModel      string     `json:"verdict_model,omitempty"`
	AdvocateName      string     `json:"advocate_name,omitempty"`
	AdvocateEnrolment string     `json:"advocate_enrolment,omitempty"`
	FinalisedAt       *time.Time `json:"finalised_at,omitempty"`

	// Still to collect: every item the report doesn't have yet, with where it comes from and who
	// fetches it, instead of a blank. The report can't be finalised while any item that belongs
	// to its tier is open.
	Requirements []ReportRequirement `json:"requirements"`
}

type ReportMutations struct {
	Entries      []domain.MutationEntry   `json:"entries"`
	Flags        []domain.SevenTwelveFlag `json:"flags"`
	YearsCovered int                      `json:"years_covered"`
	ConfirmedBy  string                   `json:"confirmed_by"`
	ConfirmedAt  time.Time                `json:"confirmed_at"`
}

type ReportESZ struct {
	Name       string `json:"name"`
	SONumber   string `json:"so_number"`
	NotifiedOn string `json:"notified_on"`
	Status     string `json:"status"` // final | draft
	SourceURL  string `json:"source_url"`
	Summary    string `json:"summary"`
	Listed     bool   `json:"listed"`
	Coverage   string `json:"coverage,omitempty"`  // full | partial
	Exact      bool   `json:"exact"`               // false: spelling differs slightly, a person confirms
	ListedAs   string `json:"listed_as,omitempty"` // village as spelled in the notification
}

type ReportSevenTwelve struct {
	Data        domain.SevenTwelve       `json:"data"`
	Flags       []domain.SevenTwelveFlag `json:"flags"`
	AreaAcres   *float64                 `json:"area_acres,omitempty"` // total area converted from hectare.are
	ConfirmedBy string                   `json:"confirmed_by"`
	ConfirmedAt time.Time                `json:"confirmed_at"`
}

// ReportFSI is the indicative UDCPR band; an architect confirms the final figure.
type ReportFSI struct {
	Basic            float64 `json:"basic"`
	Premium          float64 `json:"premium"`
	TDR              float64 `json:"tdr"`
	Max              float64 `json:"max"`
	MaxWithAncillary float64 `json:"max_with_ancillary"`
	Source           string  `json:"source"`
}

// ReportRequirement is one thing the report still needs.
type ReportRequirement struct {
	Section string `json:"section"`  // A–H
	Item    string `json:"item"`     // what's missing
	Source  string `json:"source"`   // where it comes from
	Who     string `json:"who"`      // team | advocate | builder
	InQuick bool   `json:"in_quick"` // part of a Quick Screen too (otherwise Full Report only)
}

type ReportRisk struct {
	Area  string `json:"area"`
	Level string `json:"level"`
	Note  string `json:"note,omitempty"`
}

type ReportInfra struct {
	Name       string   `json:"name"`
	Planned    bool     `json:"planned"`
	Status     string   `json:"status,omitempty"`
	Category   string   `json:"category"`
	DistanceKm *float64 `json:"distance_km,omitempty"`
}

type DueDiligenceReportUsecase struct {
	reports DueDiligenceReportRepository
	parcels ParcelGetter
	legal   LegalCheckGetter
	values  AssessmentGetter
	infra   InfrastructureForParcel // optional
	drafter ReportVerdictDrafter    // optional
	records LandRecordGetter        // optional: the parcel's confirmed 7/12
	esz     ESZSource               // optional: eco-sensitive zone village lists
	now     func() time.Time
}

type ESZSource interface {
	ForDistrict(ctx context.Context, district string) ([]domain.ESZNotification, []domain.ESZVillage, error)
}

// WithESZ adds the eco-sensitive zone check to every composed report.
func (u *DueDiligenceReportUsecase) WithESZ(src ESZSource) *DueDiligenceReportUsecase {
	u.esz = src
	return u
}

type LandRecordGetter interface {
	GetByLandParcel(ctx context.Context, parcelID uuid.UUID) (*domain.LandRecord, error)
	GetMutations(ctx context.Context, parcelID uuid.UUID) (*domain.LandMutations, error)
}

func NewDueDiligenceReportUsecase(reports DueDiligenceReportRepository, parcels ParcelGetter, legal LegalCheckGetter,
	values AssessmentGetter, infra InfrastructureForParcel, drafter ReportVerdictDrafter, records LandRecordGetter) *DueDiligenceReportUsecase {
	return &DueDiligenceReportUsecase{reports: reports, parcels: parcels, legal: legal, values: values,
		infra: infra, drafter: drafter, records: records, now: time.Now}
}

// Create starts a draft report for a parcel ("Order" on screen 6.1; payment isn't connected yet).
func (u *DueDiligenceReportUsecase) Create(ctx context.Context, actor string, parcelID uuid.UUID, tier string) (*domain.DueDiligenceReport, error) {
	p, err := u.parcels.Get(ctx, parcelID)
	if err != nil {
		return nil, err
	}
	// Every land record lookup (7/12, Ferfar, Index-II) needs these, so they're asked for up front
	// rather than discovered missing halfway through the work.
	if missing := p.MissingLandRecordIDs(); len(missing) > 0 {
		return nil, fmt.Errorf("%w: %s", domain.ErrReportNotReady, strings.Join(missing, ", "))
	}
	r := &domain.DueDiligenceReport{LandParcelID: parcelID, Tier: tier, Status: domain.ReportStatusDraft}
	if err := r.Validate(); err != nil {
		return nil, err
	}
	if err := u.reports.Create(ctx, actor, r); err != nil {
		return nil, err
	}
	return r, nil
}

func (u *DueDiligenceReportUsecase) List(ctx context.Context, parcelID uuid.UUID) ([]*domain.DueDiligenceReport, error) {
	list, err := u.reports.ListByParcel(ctx, parcelID)
	if err != nil {
		return nil, err
	}
	for _, r := range list {
		u.inheritFromLandRecord(ctx, r)
	}
	return list, nil
}

// landRecord returns the parcel's confirmed 7/12, or nil.
func (u *DueDiligenceReportUsecase) landRecord(ctx context.Context, parcelID uuid.UUID) *domain.LandRecord {
	if u.records == nil {
		return nil
	}
	rec, err := u.records.GetByLandParcel(ctx, parcelID)
	if err != nil {
		if !errors.Is(err, domain.ErrNotFound) {
			log.Printf("parcel %s: land record: %v", parcelID, err)
		}
		return nil
	}
	return rec
}

// inheritFromLandRecord fills land status (D) a person hasn't entered from the parcel's
// confirmed 7/12, in memory. What the team typed on the report always wins.
func (u *DueDiligenceReportUsecase) inheritFromLandRecord(ctx context.Context, r *domain.DueDiligenceReport) {
	if r.Final() {
		return
	}
	rec := u.landRecord(ctx, r.LandParcelID)
	if rec == nil {
		return
	}
	d := rec.Data
	if (r.OccupancyClass == "" || r.OccupancyClass == "unknown") && (d.Tenure == "class_1" || d.Tenure == "class_2") {
		r.OccupancyClass = d.Tenure
	}
	if (r.NAStatus == "" || r.NAStatus == "unknown") && d.IsNA {
		r.NAStatus = "na_granted"
	}
	if strings.TrimSpace(r.TenancyRemarks) == "" {
		var parts []string
		if strings.TrimSpace(d.Tenants) != "" {
			parts = append(parts, "Tenant: "+d.Tenants)
		}
		parts = append(parts, d.OtherRights...)
		if len(parts) == 0 {
			r.TenancyRemarks = "None recorded on the 7/12"
		} else {
			r.TenancyRemarks = strings.Join(parts, "; ")
		}
	}
}

// Get returns the report and its sections: frozen ones once final, composed live otherwise.
func (u *DueDiligenceReportUsecase) Get(ctx context.Context, id uuid.UUID) (*domain.DueDiligenceReport, *ReportSections, error) {
	r, err := u.reports.Get(ctx, id)
	if err != nil {
		return nil, nil, err
	}
	if r.Final() && len(r.FrozenReport) > 0 {
		var s ReportSections
		if err := json.Unmarshal(r.FrozenReport, &s); err != nil {
			return nil, nil, fmt.Errorf("reading frozen report: %w", err)
		}
		return r, &s, nil
	}
	u.inheritFromLandRecord(ctx, r)
	s, err := u.compose(ctx, r)
	return r, s, err
}

// ReportEdits are the fields a person can change on a draft.
type ReportEdits struct {
	OccupancyClass, NAStatus, TenancyRemarks, CRZForestESZ, DPZone, DPReservation string
	PlanningAuthority                                                             string
	RoadWidthM                                                                    *float64
	BaseFSI, MaxFSI                                                               *float64
	DevelopmentNote                                                               string
	Verdict, VerdictSummary                                                       string
	FixList                                                                       []string
}

func (u *DueDiligenceReportUsecase) Update(ctx context.Context, actor string, id uuid.UUID, e ReportEdits) (*domain.DueDiligenceReport, error) {
	r, err := u.reports.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	if r.Final() {
		return nil, domain.ErrReportFinalised
	}
	verdictChanged := r.Verdict != e.Verdict || r.VerdictSummary != e.VerdictSummary || !sameStrings(r.FixList, e.FixList)
	r.OccupancyClass, r.NAStatus, r.TenancyRemarks = e.OccupancyClass, e.NAStatus, e.TenancyRemarks
	r.CRZForestESZ, r.DPZone, r.DPReservation = e.CRZForestESZ, e.DPZone, e.DPReservation
	r.BaseFSI, r.MaxFSI, r.DevelopmentNote = e.BaseFSI, e.MaxFSI, e.DevelopmentNote
	r.PlanningAuthority, r.RoadWidthM = e.PlanningAuthority, e.RoadWidthM
	r.Verdict, r.VerdictSummary, r.FixList = e.Verdict, e.VerdictSummary, e.FixList
	if verdictChanged {
		switch {
		case r.VerdictSource == domain.VerdictSourceAIDraft || r.VerdictSource == domain.VerdictSourceEdited:
			r.VerdictSource = domain.VerdictSourceEdited
		case r.Verdict != "" || r.VerdictSummary != "":
			r.VerdictSource = domain.VerdictSourcePerson
		}
	}
	if err := r.Validate(); err != nil {
		return nil, err
	}
	if err := u.reports.Update(ctx, actor, r); err != nil {
		return nil, err
	}
	return r, nil
}

// DraftVerdict asks the AI for section H from the composed report. The draft is saved as
// "ai_draft"; the advocate edits it and signs. Nothing is final until a person finalises.
func (u *DueDiligenceReportUsecase) DraftVerdict(ctx context.Context, actor string, id uuid.UUID) (*domain.DueDiligenceReport, error) {
	if u.drafter == nil {
		return nil, errors.New("AI drafting is not configured")
	}
	r, err := u.reports.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	if r.Final() {
		return nil, domain.ErrReportFinalised
	}
	u.inheritFromLandRecord(ctx, r)
	s, err := u.compose(ctx, r)
	if err != nil {
		return nil, err
	}
	draft, model, err := u.drafter.DraftVerdict(ctx, s)
	if err != nil {
		return nil, fmt.Errorf("drafting verdict: %w", err)
	}
	draft, err = domain.CleanVerdictDraft(draft)
	if err != nil {
		return nil, err
	}
	r.Verdict, r.VerdictSummary, r.FixList = draft.Verdict, draft.Summary, draft.FixList
	r.VerdictSource, r.VerdictModel = domain.VerdictSourceAIDraft, model
	if err := u.reports.Update(ctx, actor, r); err != nil {
		return nil, err
	}
	return r, nil
}

// Finalise signs (Full, needs the advocate) or issues (Quick) the report and freezes its sections.
func (u *DueDiligenceReportUsecase) Finalise(ctx context.Context, actor string, id uuid.UUID, advocateName, enrolment string) (*domain.DueDiligenceReport, error) {
	r, err := u.reports.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	if r.Final() {
		return nil, domain.ErrReportFinalised
	}
	u.inheritFromLandRecord(ctx, r)
	now := u.now()
	// Compose with the sign-off fields already set so the frozen copy carries them.
	preview := *r
	preview.AdvocateName, preview.AdvocateEnrolment, preview.FinalisedAt = advocateName, enrolment, &now
	s, err := u.compose(ctx, &preview)
	if err != nil {
		return nil, err
	}
	// A finished report has no gaps: everything its tier promises must be collected first.
	if open := openRequirements(s, r.Tier); len(open) > 0 {
		return nil, fmt.Errorf("%w: still to collect: %s", domain.ErrReportNotReady, strings.Join(open, "; "))
	}
	frozen, err := json.Marshal(s)
	if err != nil {
		return nil, err
	}
	if err := r.Finalise(advocateName, enrolment, frozen, now); err != nil {
		return nil, err
	}
	if err := u.reports.Update(ctx, actor, r); err != nil {
		return nil, err
	}
	return r, nil
}

// compose builds sections A–H. Inputs that fail to load are left empty and logged; the report
// then shows that section as not available rather than failing.
func (u *DueDiligenceReportUsecase) compose(ctx context.Context, r *domain.DueDiligenceReport) (*ReportSections, error) {
	p, err := u.parcels.Get(ctx, r.LandParcelID)
	if err != nil {
		return nil, err
	}
	s := &ReportSections{
		AsOf: u.now(), Tier: r.Tier,
		ParcelName: p.Name, Location: p.Location, AreaAcres: p.AreaAcres, AskingRupees: p.CostRupees,
		Latitude: p.Latitude, Longitude: p.Longitude,
		Risks: []ReportRisk{}, TitleChain: []domain.OwnershipChainEntry{}, Searches: []domain.EncumbranceSearchItem{},
		Documents: []domain.LegalDocument{}, SellerProjects: []domain.RERAHistoryEntry{}, Infrastructure: []ReportInfra{},
		OccupancyClass: r.OccupancyClass, NAStatus: r.NAStatus, TenancyRemarks: r.TenancyRemarks,
		CRZForestESZ: r.CRZForestESZ, DPZone: r.DPZone, DPReservation: r.DPReservation,
		BaseFSI: r.BaseFSI, MaxFSI: r.MaxFSI, DevelopmentNote: r.DevelopmentNote,
		Verdict: r.Verdict, VerdictSummary: r.VerdictSummary, FixList: r.FixList,
		VerdictSource: r.VerdictSource, VerdictModel: r.VerdictModel,
		AdvocateName: r.AdvocateName, AdvocateEnrolment: r.AdvocateEnrolment, FinalisedAt: r.FinalisedAt,
	}
	for dst, src := range map[*string]*string{&s.Village: p.Village, &s.Taluka: p.Taluka, &s.District: p.District, &s.SurveyNumber: p.SurveyNumber} {
		if src != nil {
			*dst = *src
		}
	}
	if s.FixList == nil {
		s.FixList = []string{}
	}
	s.PlanningAuthority, s.RoadWidthM = r.PlanningAuthority, r.RoadWidthM
	if r.PlanningAuthority != "" && r.RoadWidthM != nil {
		band, err := domain.UDCPRFSIBand(r.PlanningAuthority, *r.RoadWidthM)
		switch {
		case errors.Is(err, domain.ErrFSIUnsupported):
			s.FSINote = "UDCPR doesn't apply here (Mumbai DCPR 2034, or CIDCO / NAINA regulations). The architect works out the FSI."
		case err != nil:
			log.Printf("report %s: FSI band: %v", r.ID, err)
		default:
			s.FSIBand = &ReportFSI{Basic: band.Basic, Premium: band.Premium, TDR: band.TDR,
				Max: band.Max, MaxWithAncillary: band.MaxWithAncillary, Source: band.Source}
		}
	}
	// Buildable area = land area × max FSI (1 acre = 43,560 sq ft), before road, reservation and
	// amenity deductions. The architect's figure wins over the UDCPR band when entered.
	maxFSI := r.MaxFSI
	if maxFSI == nil && s.FSIBand != nil {
		maxFSI = &s.FSIBand.Max
	}
	if p.AreaAcres != nil && maxFSI != nil {
		v := int64(*p.AreaAcres * 43560 * *maxFSI)
		s.BuildableSqft = &v
	}

	if lc, err := u.legal.GetByLandParcel(ctx, r.LandParcelID); err == nil {
		s.LegalCheckStarted, s.LegalCheckStatus = true, string(lc.Status)
		s.Risks = []ReportRisk{
			{Area: "Ownership", Level: string(lc.OwnershipRisk), Note: lc.OwnershipRiskNote},
			{Area: "Litigation", Level: string(lc.LitigationRisk), Note: lc.LitigationRiskNote},
			{Area: "Encumbrance", Level: string(lc.EncumbranceRisk), Note: lc.EncumbranceRiskNote},
			{Area: "Regulatory", Level: string(lc.RegulatoryRisk), Note: lc.RegulatoryRiskNote},
		}
		s.TitleChain, s.Searches, s.SearchSummary = nonNil(lc.OwnershipChain), nonNil(lc.EncumbranceSearches), lc.SearchSummaryNote
		s.Documents, s.SellerProjects, s.SellerSummary = nonNil(lc.Documents), nonNil(lc.RERAHistory), lc.RERAHistorySummaryNote
	} else if !errors.Is(err, domain.ErrNotFound) {
		log.Printf("report %s: legal check: %v", r.ID, err)
	}

	if fa, err := u.values.GetByLandParcel(ctx, r.LandParcelID); err == nil && fa.CurrentValuationRupees > 0 {
		likely, future := fa.CurrentValuationRupees, fa.FutureValuationRupees
		s.Valued = true
		s.ValueLowRupees, s.ValueHighRupees, s.ValueLikelyRupees = fa.CurrentLowRupees, fa.CurrentHighRupees, &likely
		if future > 0 {
			s.FutureLikelyRupees, s.FutureYear = &future, fa.FutureValuationYear
		}
		s.PriceVerdict = fa.Verdict
		s.ValueIndicative = !fa.Basis.HasMarketEvidence()
		s.ValueBasis = fa.ComparableSalesNote
		if fa.Basis.ReadyReckonerPerAcre != nil {
			s.ValueBasis += fmt.Sprintf("; government rate ₹%d per acre (%s)", *fa.Basis.ReadyReckonerPerAcre, fa.Basis.ReadyReckonerYear)
		}
	} else if err != nil && !errors.Is(err, domain.ErrNotFound) {
		log.Printf("report %s: valuation: %v", r.ID, err)
	}

	if u.infra != nil {
		if res, err := u.infra.ForParcel(ctx, r.LandParcelID); err == nil && res != nil {
			s.Infrastructure = reportInfra(res)
		} else if err != nil {
			log.Printf("report %s: infrastructure: %v", r.ID, err)
		}
	}
	if rec := u.landRecord(ctx, r.LandParcelID); rec != nil {
		st := &ReportSevenTwelve{Data: rec.Data, Flags: rec.Data.Flags(p.AreaAcres), ConfirmedBy: rec.ConfirmedBy, ConfirmedAt: rec.ConfirmedAt}
		if p.SurveyNumber != nil && !domain.SameSurveyNumber(*p.SurveyNumber, rec.Data.SurveyNumber) {
			st.Flags = append([]domain.SevenTwelveFlag{{Level: "high", Text: fmt.Sprintf(
				"Survey number on the 7/12 (%s) doesn't match the one given for this parcel (%s). Make sure it's the right land.",
				rec.Data.SurveyNumber, *p.SurveyNumber)}}, st.Flags...)
		}
		if sqm, err := rec.Data.AreaSqm(); err == nil && sqm > 0 {
			a := sqm / domain.SqmPerAcre
			st.AreaAcres = &a
		}
		s.SevenTwelve = st
	}

	if u.records != nil {
		if m, err := u.records.GetMutations(ctx, r.LandParcelID); err == nil {
			s.Mutations = &ReportMutations{Entries: m.Data.SortedEntries(), Flags: m.Data.Flags(u.now()),
				YearsCovered: m.Data.YearsCovered(u.now()), ConfirmedBy: m.ConfirmedBy, ConfirmedAt: m.ConfirmedAt}
		} else if !errors.Is(err, domain.ErrNotFound) {
			log.Printf("report %s: mutations: %v", r.ID, err)
		}
	}

	s.ESZ = []ReportESZ{}
	if u.esz != nil && s.District != "" && s.Taluka != "" && s.Village != "" {
		if ns, vs, err := u.esz.ForDistrict(ctx, s.District); err == nil {
			for _, r := range domain.CheckESZ(ns, vs, s.District, s.Taluka, s.Village) {
				s.ESZ = append(s.ESZ, ReportESZ{
					Name: r.Notification.Name, SONumber: r.Notification.SONumber,
					NotifiedOn: r.Notification.NotifiedOn.Format("2 Jan 2006"), Status: r.Notification.Status,
					SourceURL: r.Notification.SourceURL, Summary: r.Notification.Summary,
					Listed: r.Listed, Coverage: r.Coverage, Exact: r.Exact, ListedAs: r.ListedAs,
				})
			}
		} else {
			log.Printf("report %s: ESZ check: %v", r.ID, err)
		}
	}

	s.Requirements = reportRequirements(s)
	return s, nil
}

// reportRequirements turns every gap into a line saying where the item comes from and who gets
// it, so a report never just says "not recorded". Quick Screen items are the ones our team can
// get from public records and the 7/12; the rest come with the Full Report's advocate search.
func reportRequirements(s *ReportSections) []ReportRequirement {
	out := []ReportRequirement{}
	add := func(section, item, source, who string, inQuick bool) {
		out = append(out, ReportRequirement{Section: section, Item: item, Source: source, Who: who, InQuick: inQuick})
	}

	if s.SurveyNumber == "" || s.Village == "" {
		add("A", "Survey/gat number and village", "From the seller or the 7/12", "builder", true)
	}
	if s.Latitude == nil {
		add("A", "Map pin of the parcel", "Dropped on the map, or GPS on a site visit", "builder", true)
	}

	if s.SevenTwelve == nil {
		add("A", "7/12 extract, read and checked", "Photo of the 7/12; our team gets a signed copy from Mahabhumi if needed", "team", true)
	}
	if s.Mutations != nil && s.Mutations.YearsCovered < domain.TitleSearchYears {
		add("B", fmt.Sprintf("Older records to complete %d years (the register goes back %d)", domain.TitleSearchYears, s.Mutations.YearsCovered),
			"Older mutation entries, old 7/12s, or Index-II at the Sub-Registrar", "advocate", false)
	}
	if len(s.TitleChain) == 0 && s.Mutations == nil {
		add("B", "Owners over the last 30 years", "Mutation register (Ferfar) and Index-II at the Sub-Registrar", "advocate", false)
	}

	if !s.LegalCheckStarted {
		add("C", "Encumbrance, litigation and acquisition searches", "Sub-Registrar (IGR), eCourts and the district gazette", "advocate", false)
	}
	for _, sr := range s.Searches {
		if !sr.Completed {
			add("C", sr.SearchType, searchSource(sr.SearchType), "advocate", false)
		}
	}
	for _, d := range s.Documents {
		if d.Status != domain.DocumentStatusReceived {
			src, who, quick := documentSource(d.DocumentType)
			if s.SevenTwelve != nil && strings.Contains(d.DocumentType, "7/12") {
				continue // read and confirmed on the parcel
			}
			if s.Mutations != nil && (strings.Contains(strings.ToLower(d.DocumentType), "mutation") || strings.Contains(strings.ToLower(d.DocumentType), "ferfar")) {
				continue
			}
			add("C", d.DocumentType, src, who, quick)
		}
	}
	for _, rk := range s.Risks {
		if rk.Level == string(domain.RiskLevelNotChecked) {
			add("C", rk.Area+" risk", "Judged from the papers and searches above", "advocate", false)
		}
	}

	if s.OccupancyClass == "" || s.OccupancyClass == "unknown" {
		add("D", "Occupancy class (Class I or II)", "7/12, tenure column (भूधारणा पद्धती)", "team", true)
	}
	if s.NAStatus == "" || s.NAStatus == "unknown" {
		add("D", "NA status", "7/12, and the Collector's NA order or sanad if there is one", "team", true)
	}
	if s.TenancyRemarks == "" {
		add("D", "Tenancy and other rights", "7/12, other rights column (इतर हक्क)", "team", true)
	}
	if s.CRZForestESZ == "" {
		if len(s.ESZ) > 0 {
			// The ESZ village lists were checked automatically; coastal and forest still need a person.
			add("D", "Coastal zone (CRZ) and forest boundary", "MCZMA coastal zone maps and the forest department", "team", true)
		} else {
			add("D", "Coastal, forest and eco-sensitive zone", "MCZMA coastal maps and the ESZ gazette notifications", "team", true)
		}
	}
	for _, e := range s.ESZ {
		if e.Listed && !e.Exact {
			add("D", "Confirm the village is the one in the "+e.Name+" list (spelled \""+e.ListedAs+"\")", e.SONumber+", "+e.SourceURL, "team", true)
		}
	}
	if s.DPReservation == "" {
		add("D", "Reservation on the plot (road, garden, school…)", "Zone certificate from the planning authority", "team", false)
	}

	if s.DPZone == "" {
		add("E", "Development Plan / Regional Plan zone", "DP or Regional Plan map, or a zone certificate", "team", true)
	}
	if s.FSIBand == nil && s.MaxFSI == nil && s.FSINote == "" {
		add("E", "Planning authority and access road width (for FSI)", "DP map and a site visit", "team", true)
	}

	if len(s.SellerProjects) == 0 {
		add("F", "Seller's MahaRERA record", "MahaRERA, searched by the seller's name", "team", true)
	}
	if !s.Valued {
		add("G", "Value today and in 5 years", "ScridddHub valuation for the pinned location", "team", true)
	}
	if s.Valued && s.ValueIndicative {
		add("G", "Registered sale prices in this village", "Index-II search at the Sub-Registrar (IGR Maharashtra e-Search)", "team", true)
		add("G", "Government ready-reckoner rate", "IGR e-ASR, for the village and zone", "team", true)
	}
	if s.Verdict == "" {
		add("H", "Verdict and what to fix", "Drafted by AI from sections A–G, then checked and edited", "team", true)
	}
	return out
}

func searchSource(searchType string) string {
	t := strings.ToLower(searchType)
	switch {
	case strings.Contains(t, "court") || strings.Contains(t, "litigation"):
		return "eCourts (district courts) and the Bombay High Court case search"
	case strings.Contains(t, "acquisition"):
		return "District gazette and Collector's acquisition notices"
	case strings.Contains(t, "encumbrance") || strings.Contains(t, "registrar"):
		return "Index-II search at the Sub-Registrar (IGR Maharashtra) and CERSAI"
	}
	return "Public records search by the advocate"
}

// documentSource says where a paper comes from. The 7/12 and 8A are fetched by our team from
// Mahabhumi (₹15 for a digitally signed copy); deeds and receipts come from the seller.
func documentSource(docType string) (source, who string, inQuick bool) {
	t := strings.ToLower(docType)
	switch {
	case strings.Contains(t, "7/12") || strings.Contains(t, "8a") || strings.Contains(t, "8-a"):
		return "Digitally signed copy from Mahabhumi (digitalsatbara.mahabhumi.gov.in)", "team", true
	case strings.Contains(t, "mutation") || strings.Contains(t, "ferfar"):
		return "Mutation register (village form 6) from Mahabhumi or the talathi", "team", false
	case strings.Contains(t, "encumbrance"):
		return "Index-II search at the Sub-Registrar", "advocate", false
	case strings.Contains(t, "tax"):
		return "From the seller (gram panchayat or municipal receipt)", "builder", false
	}
	return "From the seller", "builder", false
}

// openRequirements lists the requirements that block finalising a report of this tier.
func openRequirements(s *ReportSections, tier string) []string {
	var open []string
	for _, rq := range s.Requirements {
		if rq.Section == "H" {
			continue // the verdict is checked by domain.OpenItems
		}
		if tier == domain.ReportTierFull || rq.InQuick {
			open = append(open, rq.Section+": "+rq.Item)
		}
	}
	return open
}

// reportInfra keeps what matters to a buyer: planned projects (nearest first, up to 6) and
// existing hazards (landfills, power lines…) within reach.
func reportInfra(res *PlannedInfrastructureResult) []ReportInfra {
	out := []ReportInfra{}
	for _, m := range res.Matches {
		out = append(out, ReportInfra{Name: m.Project.Name, Planned: true, Status: m.Project.Status,
			Category: m.Project.Category, DistanceKm: m.DistanceKm})
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].DistanceKm == nil {
			return false
		}
		return out[j].DistanceKm == nil || *out[i].DistanceKm < *out[j].DistanceKm
	})
	if len(out) > 6 {
		out = out[:6]
	}
	for _, e := range res.Existing {
		if e.Place.Category == "negative" {
			d := e.DistanceKm
			out = append(out, ReportInfra{Name: e.Place.Name, Category: "negative", DistanceKm: &d})
		}
	}
	return out
}

func nonNil[T any](s []T) []T {
	if s == nil {
		return []T{}
	}
	return s
}

func sameStrings(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
