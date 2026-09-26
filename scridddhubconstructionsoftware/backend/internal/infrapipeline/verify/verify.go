// Package verify is stage 4 of the infrastructure pipeline: it keeps only the extracted facts
// whose evidence quote really appears in the fetched page text (PIPELINE_PLAN.md decision 3).
// It is the main defence against an LLM inventing a date, a length or a station.
package verify

import (
	"regexp"
	"strconv"
	"strings"

	"github.com/scridddhub/backend/internal/infrapipeline"
)

// minEvidenceLen stops trivial "evidence" like "2027" or "Metro" from matching somewhere random.
const minEvidenceLen = 12

type Verifier struct{}

var _ infrapipeline.Verifier = Verifier{}

// Verify returns the project with every unsupported field cleared. Rules:
//   - evidence must be at least minEvidenceLen characters and appear in the page text
//     (case, whitespace, dash and quote differences ignored);
//   - for values that are numbers or dates, the value itself must also appear inside the evidence,
//     so a real sentence can't be paired with an invented number;
//   - a station/locality is kept only if its name appears inside its own evidence.
//
// If the project name fails, "name" is in Rejected and the caller must drop the whole project.
func (Verifier) Verify(p infrapipeline.ExtractedProject, pageText string) infrapipeline.VerifiedProject {
	page := normalize(pageText)
	out := infrapipeline.VerifiedProject{Project: p, FieldEvidence: map[string]string{}}

	found := func(evidence string) bool {
		e := normalize(evidence)
		return len(e) >= minEvidenceLen && strings.Contains(page, e)
	}
	accept := func(field, evidence string) { out.FieldEvidence[field] = evidence }
	reject := func(field string) { out.Rejected = append(out.Rejected, field) }

	// Name: evidence must exist and mention the name's distinguishing tokens (e.g. "12" in "Metro Line 12").
	if strings.TrimSpace(p.Name) != "" && found(p.NameEvidence) && tokensIn(distinctTokens(p.Name), p.NameEvidence) {
		accept("name", p.NameEvidence)
	} else {
		reject("name")
	}

	if p.Status.Value != nil {
		if found(p.Status.Evidence) {
			accept("status", p.Status.Evidence)
		} else {
			out.Project.Status = infrapipeline.Field[string]{}
			reject("status")
		}
	}

	if p.ExpectedCompletion.Value != nil {
		if found(p.ExpectedCompletion.Evidence) && tokensIn(numberTokens(*p.ExpectedCompletion.Value), p.ExpectedCompletion.Evidence) {
			accept("expected_completion", p.ExpectedCompletion.Evidence)
		} else {
			out.Project.ExpectedCompletion = infrapipeline.Field[string]{}
			reject("expected_completion")
		}
	}

	if p.LengthKm.Value != nil {
		num := strconv.FormatFloat(*p.LengthKm.Value, 'f', -1, 64)
		if found(p.LengthKm.Evidence) && strings.Contains(normalize(p.LengthKm.Evidence), num) {
			accept("length_km", p.LengthKm.Evidence)
		} else {
			out.Project.LengthKm = infrapipeline.Field[float64]{}
			reject("length_km")
		}
	}

	sentences := splitSentences(pageText)
	out.Project.Stations = keepPlaces(p.Stations, "station", sentences, found, accept, reject)
	out.Project.Localities = keepPlaces(p.Localities, "locality", sentences, found, accept, reject)
	return out
}

// keepPlaces keeps a station/locality when its own quote verifies. If the quote fails (models
// sometimes stitch two separate parts of a page into one "quote"), the place is re-anchored: the
// first real page sentence naming it as a whole word becomes its evidence. A place never named on
// the page is still rejected. Dates, lengths and status get no such fallback.
func keepPlaces(places []infrapipeline.NamedPlace, kind string, sentences []string, found func(string) bool,
	accept func(string, string), reject func(string)) []infrapipeline.NamedPlace {
	kept := make([]infrapipeline.NamedPlace, 0, len(places))
	for _, pl := range places {
		field := kind + ":" + pl.Name
		name := normalize(pl.Name)
		switch {
		case name == "":
			reject(field)
			continue
		case found(pl.Evidence) && strings.Contains(normalize(pl.Evidence), name):
			// quote verified as given
		default:
			anchored := sentenceNaming(sentences, name)
			if anchored == "" {
				reject(field)
				continue
			}
			pl.Evidence = anchored
		}
		accept(field, pl.Evidence)
		kept = append(kept, pl)
	}
	return kept
}

var sentenceBreak = regexp.MustCompile(`[.;!?\n]+\s*`)

// splitSentences breaks page text into sentence-ish spans (original wording kept).
func splitSentences(text string) []string {
	var out []string
	for _, s := range sentenceBreak.Split(text, -1) {
		if s = strings.TrimSpace(spaces.ReplaceAllString(s, " ")); len(s) >= minEvidenceLen {
			out = append(out, s)
		}
	}
	return out
}

// sentenceNaming returns the first sentence containing name as a whole word, or "".
func sentenceNaming(sentences []string, name string) string {
	re := regexp.MustCompile(`(^|[^a-z0-9])` + regexp.QuoteMeta(name) + `($|[^a-z0-9])`)
	for _, s := range sentences {
		if re.MatchString(normalize(s)) {
			return s
		}
	}
	return ""
}

var (
	spaces  = regexp.MustCompile(`\s+`)
	digits  = regexp.MustCompile(`[0-9]+`)
	dashes  = strings.NewReplacer("–", "-", "—", "-", "‐", "-", "‑", "-", "’", "'", "‘", "'", "“", `"`, "”", `"`, " ", " ")
	letters = regexp.MustCompile(`[a-z0-9]+`)
)

// spacedDash is a dash used as punctuation ("Metro Line - 5"), as opposed to one joining words
// ("Kalyan-Taloja"). Models often drop it when copying ("Metro Line 5"), found on MMRDA's Metro
// Line 5 page on 2026-09-27; treating it as a space makes both spellings match.
var spacedDash = regexp.MustCompile(`\s+-\s*|\s*-\s+`)

func normalize(s string) string {
	s = strings.ToLower(dashes.Replace(s))
	s = spacedDash.ReplaceAllString(s, " ")
	return strings.TrimSpace(spaces.ReplaceAllString(s, " "))
}

// numberTokens are the digit runs in a value ("Dec 2027" -> ["2027"]).
func numberTokens(v string) []string { return digits.FindAllString(v, -1) }

// distinctTokens are the name tokens worth requiring in the evidence: numbers and words longer
// than 3 letters, skipping generic ones ("metro", "line", "road", "project").
func distinctTokens(name string) []string {
	generic := map[string]bool{"metro": true, "line": true, "road": true, "project": true, "mumbai": true, "phase": true}
	var out []string
	for _, t := range letters.FindAllString(strings.ToLower(parenthesisFree(name)), -1) {
		if digits.MatchString(t) || (len(t) > 3 && !generic[t]) {
			out = append(out, t)
		}
	}
	return out
}

func parenthesisFree(s string) string {
	return regexp.MustCompile(`\([^)]*\)`).ReplaceAllString(s, " ")
}

func tokensIn(tokens []string, evidence string) bool {
	e := normalize(evidence)
	for _, t := range tokens {
		if !strings.Contains(e, t) {
			return false
		}
	}
	return true
}
