package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/scridddhub/backend/internal/domain"
	"github.com/scridddhub/backend/internal/usecase"
)

// GroqReportVerdictDrafter implements usecase.ReportVerdictDrafter: it reads sections A–G of a
// Parcel Due-Diligence Report and proposes section H (verdict, summary, what to fix). It is a
// draft for the advocate, who edits and signs; it is told to use only the report's facts.
type GroqReportVerdictDrafter struct {
	apiKey string
	model  string
	client *http.Client
}

func NewGroqReportVerdictDrafter(apiKey string) *GroqReportVerdictDrafter {
	return &GroqReportVerdictDrafter{apiKey: apiKey, model: "openai/gpt-oss-120b", client: &http.Client{Timeout: 60 * time.Second}}
}

var _ usecase.ReportVerdictDrafter = (*GroqReportVerdictDrafter)(nil)

const reportVerdictSystemPrompt = `You draft the verdict section of a land due-diligence report for a
builder in Maharashtra, India. A lawyer (advocate) will review, edit and sign it. You are given
sections A to G of the report. Use ONLY those facts.

Decide one verdict:
- "go": nothing found that should stop or delay the purchase.
- "fix_first": problems that can be fixed before paying a token (e.g. a missing mutation entry,
  an NA order not yet obtained, a pending search, an unchecked risk).
- "no_go": a problem that makes the purchase unsafe (e.g. a court case on title, an acquisition
  notice, land in a no-construction zone, Class II land that can't be transferred).

Rules:
- Never invent facts, cases, documents or names that aren't in the report.
- If something is unknown or not checked, say so plainly and treat it as something to fix or
  confirm, not as clean.
- Quote abbreviations exactly as written (e.g. "CC pending"). Don't expand or explain one
  unless the report spells it out; many have more than one meaning.
- "fix_list": each item starts with the section letter it comes from, then a colon, then one
  short action. For example "B: record the 2009 heirship mutation at the talathi office".
  Empty list for "go".
- "summary": 2-4 plain sentences a builder can read in 20 seconds. No legal guarantees, never say
  "clean title" or "verified".

Respond with ONLY this JSON:
{"verdict": "go" | "fix_first" | "no_go", "summary": string, "fix_list": [string]}`

func reportVerdictUserMessage(s *usecase.ReportSections) string {
	var b strings.Builder
	w := func(format string, a ...any) { fmt.Fprintf(&b, format+"\n", a...) }
	w("Report tier: %s. Date: %s.", s.Tier, s.AsOf.Format("2006-01-02"))
	w("A. SNAPSHOT: %s, %s.", s.ParcelName, s.Location)
	if s.AreaAcres != nil {
		w("Area: %.2f acres.", *s.AreaAcres)
	}
	if s.AskingRupees != nil {
		w("Asking price: Rs %d.", *s.AskingRupees)
	}
	if len(s.SevenTwelves) == 0 {
		w("7/12: none checked yet, so holders, class and rights on the land are unknown.")
	}
	for _, st := range s.SevenTwelves {
		d := st.Data
		var holders []string
		for _, o := range d.Owners {
			if !o.Former {
				holders = append(holders, o.Name)
			}
		}
		signed := "not a signed copy"
		if d.DigitallySigned {
			signed = "digitally signed copy"
			if d.SignedOn != "" {
				signed += ", signed " + d.SignedOn
			}
		}
		area := "unknown"
		if st.AreaAcres != nil {
			area = fmt.Sprintf("%.2f acres", *st.AreaAcres)
		}
		w("7/12 FOR SURVEY %s (checked by a person, %s): holders %s; tenure %s; area %s; NA %v; tenant %s; other rights %s; pending mutations %s; last mutation %s.",
			d.SurveyNumber, signed, strings.Join(holders, ", "), orUnknown(d.Tenure), area, d.IsNA, orUnknown(d.Tenants),
			orUnknown(strings.Join(d.OtherRights, "; ")), orUnknown(strings.Join(d.PendingMutations, "; ")), orUnknown(d.LastMutation))
		for _, f := range st.Flags {
			w("- WARNING (%s): %s", f.Level, f.Text)
		}
	}
	if sum := s.SevenTwelveSummary; sum != nil && len(s.SevenTwelves) > 1 {
		w("THE 7/12s TOGETHER: %d survey numbers, %d people must sign (%s).", len(s.SevenTwelves), len(sum.CurrentHolders), strings.Join(sum.CurrentHolders, ", "))
		for _, f := range sum.Flags {
			if strings.HasPrefix(f.Text, "No 7/12 yet") || strings.Contains(f.Text, "add up to") || strings.Contains(f.Text, "current holders across") {
				w("- WARNING (%s): %s", f.Level, f.Text)
			}
		}
	}
	if !s.LegalCheckStarted {
		w("B/C/F: the legal check has NOT been started, so title, searches and seller history are unknown.")
	} else {
		w("Risk levels (from the legal check):")
		for _, r := range s.Risks {
			w("- %s: %s %s", r.Area, r.Level, r.Note)
		}
		w("B. TITLE CHAIN:")
		if m := s.Mutations; m != nil {
			w("Mutation register (checked by a person), going back %d years:", m.YearsCovered)
			for _, e := range m.Entries {
				w("- mutation %s, %s: %s from %s to %s (%s)", e.Number, e.Date, domain.MutationTypeLabel(e.Type), orUnknown(e.From), orUnknown(e.To), orUnknown(e.Status))
			}
			for _, f := range m.Flags {
				w("- WARNING (%s): %s", f.Level, f.Text)
			}
		}
		if len(s.TitleChain) == 0 && s.Mutations == nil {
			w("- no title steps recorded")
		}
		for _, c := range s.TitleChain {
			end := ""
			if c.IsFinal {
				end = " (marked as the verified end of the chain)"
			}
			w("- %s: %s%s", c.Title, c.Description, end)
		}
		w("C. SEARCHES:")
		for _, x := range s.Searches {
			done := "not done"
			if x.Completed {
				done = "done"
			}
			w("- %s: %s", x.SearchType, done)
		}
		if s.SearchSummary != "" {
			w("Search findings: %s", s.SearchSummary)
		}
		w("Documents:")
		for _, d := range s.Documents {
			w("- %s: %s", d.DocumentType, d.Status)
		}
		w("F. SELLER / CO-DEVELOPER: %d past MahaRERA projects listed. %s", len(s.SellerProjects), s.SellerSummary)
	}
	w("D. LAND STATUS: occupancy class %s; NA status %s; tenancy remarks: %s; CRZ/forest/ESZ: %s; DP reservation: %s.",
		s.OccupancyClass, s.NAStatus, orUnknown(s.TenancyRemarks), orUnknown(s.CRZForestESZ), orUnknown(s.DPReservation))
	for _, e := range s.ESZ {
		if e.Listed {
			w("ECO-SENSITIVE ZONE: the village is LISTED (%s) in %s (%s, %s). Restrictions: %s", e.Coverage, e.Name, e.SONumber, e.Status, e.Summary)
		} else {
			w("ECO-SENSITIVE ZONE: the village is not in the %s list (%s).", e.Name, e.SONumber)
		}
	}
	fsi := "unknown"
	switch {
	case s.BaseFSI != nil && s.MaxFSI != nil:
		fsi = fmt.Sprintf("base %.2f, up to %.2f (architect)", *s.BaseFSI, *s.MaxFSI)
	case s.FSIBand != nil:
		fsi = fmt.Sprintf("base %.2f, up to %.2f, indicative band from %s, architect to confirm", s.FSIBand.Basic, s.FSIBand.Max, s.FSIBand.Source)
	case s.FSINote != "":
		fsi = s.FSINote
	}
	if s.BuildableSqft != nil {
		fsi += fmt.Sprintf("; buildable about %d sq ft before deductions", *s.BuildableSqft)
	}
	w("E. DEVELOPMENT: zone %s; FSI %s. %s", orUnknown(s.DPZone), fsi, s.DevelopmentNote)
	for _, x := range s.Infrastructure {
		d := ""
		if x.DistanceKm != nil {
			d = fmt.Sprintf("%.1f km", *x.DistanceKm)
		}
		kind := "existing hazard"
		if x.Planned {
			kind = "planned, " + x.Status
		}
		w("- %s (%s) %s", x.Name, kind, d)
	}
	if s.Valued && s.ValueLikelyRupees != nil {
		if s.ValueIndicative {
			w("G. VALUATION: no registered sales or government rate for this area, so there is NO reliable value yet. Don't judge the asking price; treat the valuation as open.")
		} else {
			w("G. VALUATION: likely value Rs %d today. %s (%s)", *s.ValueLikelyRupees, s.PriceVerdict, s.ValueBasis)
		}
	} else {
		w("G. VALUATION: not assessed.")
	}
	if len(s.Requirements) > 0 {
		w("STILL TO COLLECT (not yet in the report; treat each as open, not as clean):")
		for _, r := range s.Requirements {
			w("- %s: %s (from %s)", r.Section, r.Item, r.Source)
		}
	}
	return b.String()
}

func orUnknown(s string) string {
	if strings.TrimSpace(s) == "" {
		return "unknown"
	}
	return s
}

type reportVerdictFields struct {
	Verdict string   `json:"verdict"`
	Summary string   `json:"summary"`
	FixList []string `json:"fix_list"`
}

func (d *GroqReportVerdictDrafter) DraftVerdict(ctx context.Context, s *usecase.ReportSections) (domain.ReportVerdictDraft, string, error) {
	body, err := json.Marshal(groqEstimateRequest{
		Model: d.model,
		Messages: []groqChatMessage{
			{Role: "system", Content: reportVerdictSystemPrompt},
			{Role: "user", Content: reportVerdictUserMessage(s)},
		},
		ResponseFormat: groqResponseFormat{Type: "json_object"},
		Temperature:    0.1,
	})
	if err != nil {
		return domain.ReportVerdictDraft{}, "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, groqChatCompletionsURL, bytes.NewReader(body))
	if err != nil {
		return domain.ReportVerdictDraft{}, "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+d.apiKey)
	resp, err := d.client.Do(req)
	if err != nil {
		return domain.ReportVerdictDraft{}, "", err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return domain.ReportVerdictDraft{}, "", err
	}
	var chat groqChatResponse
	if err := json.Unmarshal(raw, &chat); err != nil {
		return domain.ReportVerdictDraft{}, "", fmt.Errorf("parsing groq response: %w", err)
	}
	if chat.Error != nil {
		return domain.ReportVerdictDraft{}, "", fmt.Errorf("groq API error: %s", chat.Error.Message)
	}
	if len(chat.Choices) == 0 {
		return domain.ReportVerdictDraft{}, "", fmt.Errorf("groq returned no choices")
	}
	var f reportVerdictFields
	if err := json.Unmarshal([]byte(chat.Choices[0].Message.Content), &f); err != nil {
		return domain.ReportVerdictDraft{}, "", fmt.Errorf("parsing verdict: %w", err)
	}
	return domain.ReportVerdictDraft{Verdict: f.Verdict, Summary: f.Summary, FixList: f.FixList}, d.model, nil
}
