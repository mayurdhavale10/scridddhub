package infrapipeline

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"
)

// Pipeline wires the stages together. Every dependency is an interface so the whole run can be
// tested with fakes (run_test.go) and the same code serves every trigger (CLI now; on-demand and
// scheduled later).
type Pipeline struct {
	Store     Store
	Fetcher   Fetcher
	Extractor Extractor
	Verifier  Verifier
	Geodata   GeodataParser
	Locator   Locator
	Policy    PublishPolicy
	Logf      func(format string, args ...any)
	// IsFatal reports an error that should end the run early (e.g. the LLM's daily quota is used
	// up) — everything extracted so far is still stored. nil = never.
	IsFatal func(error) bool
}

type RunOptions struct {
	Trigger   RunTrigger
	Agency    string // "" = all agencies
	SourceURL string // "" = all enabled sources; otherwise only this one
	// SourceURLs limits the run to these registered sources (e.g. ones just discovered for an
	// area). Ignored when empty.
	SourceURLs []string
	DryRun     bool // fetch/extract/verify/locate and report, but write nothing
	Force      bool // re-extract even when a page's content hash is unchanged
	// MaxDiscovered caps how many newly discovered project pages one run follows.
	MaxDiscovered int
}

// DryRunProject is what a dry run would have stored.
type DryRunProject struct {
	Key      string
	Name     string
	Review   ReviewStatus
	Kept     map[string]string
	Rejected []string
	Points   []LocatedPoint
}

type RunResult struct {
	Stats   RunStats
	DryRun  []DryRunProject
	Skipped []string // candidates that couldn't be stored, with the reason
}

// candidate accumulates everything the run learned about one project, across sources.
type candidate struct {
	key      string
	agency   string
	vp       VerifiedProject
	official []GeoPoint
	sources  []ProjectSourceRef
}

func (p *Pipeline) logf(format string, args ...any) {
	if p.Logf != nil {
		p.Logf(format, args...)
	} else {
		log.Printf(format, args...)
	}
}

func (p *Pipeline) Run(ctx context.Context, opts RunOptions) (RunResult, error) {
	var res RunResult
	if opts.MaxDiscovered == 0 {
		opts.MaxDiscovered = 200
	}
	sources, err := p.Store.ListEnabledSources(ctx, opts.Agency)
	if err != nil {
		return res, fmt.Errorf("listing sources: %w", err)
	}
	if opts.SourceURL != "" {
		sources = filterSources(sources, opts.SourceURL)
		if len(sources) == 0 {
			return res, fmt.Errorf("source %q is not an enabled registry entry", opts.SourceURL)
		}
	}
	if len(opts.SourceURLs) > 0 {
		var picked []Source
		for _, u := range opts.SourceURLs {
			picked = append(picked, filterSources(sources, u)...)
		}
		sources = picked
	}

	var runID = uuid.Nil
	if !opts.DryRun {
		runID, err = p.Store.StartRun(ctx, opts.Trigger, map[string]any{
			"agency": opts.Agency, "source": opts.SourceURL, "force": opts.Force, "policy": string(p.Policy),
		})
		if err != nil {
			return res, fmt.Errorf("starting run: %w", err)
		}
	}

	cands := map[string]*candidate{}
	order := []string{}
	seenURL := map[string]bool{}
	for _, s := range sources {
		seenURL[s.URL] = true
	}
	discovered := 0

	var runErr error
sourceLoop:
	for i := 0; i < len(sources); i++ {
		if ctx.Err() != nil {
			runErr = ctx.Err()
			break
		}
		src := sources[i]
		res.Stats.Sources++
		page, err := p.Fetcher.Fetch(ctx, src.URL)
		if err != nil {
			runErr = err
			break
		}

		switch page.Status {
		case FetchBlocked:
			res.Stats.Blocked++
			p.logf("BLOCKED  %s — %s", src.URL, page.Detail)
			p.saveFetch(ctx, opts, runID, src, page)
			continue
		case FetchError:
			res.Stats.Errors++
			p.logf("ERROR    %s — %s", src.URL, page.Detail)
			p.saveFetch(ctx, opts, runID, src, page)
			continue
		}
		if !opts.Force && src.LastContentHash != "" && page.ContentHash == src.LastContentHash {
			res.Stats.Unchanged++
			p.logf("same     %s", src.URL)
			if !opts.DryRun {
				if err := p.Store.MarkUnchanged(ctx, src.ID); err != nil {
					p.logf("  marking unchanged: %v", err)
				}
			}
			continue
		}
		res.Stats.Fetched++
		fetchID := p.saveFetch(ctx, opts, runID, src, page)

		if src.Kind == SourceGeodata {
			pts, err := p.Geodata.Parse(page.Raw, page.ContentType, page.FinalURL)
			if err != nil {
				res.Stats.Errors++
				p.logf("ERROR    %s — geodata: %v", src.URL, err)
				continue
			}
			if strings.TrimSpace(src.ProjectHint) == "" {
				p.logf("SKIP     %s — geodata source has no project_hint", src.URL)
				continue
			}
			c := getCandidate(cands, &order, CanonicalKey(src.Agency, src.ProjectHint), src.Agency)
			c.official = append(c.official, pts...)
			c.sources = append(c.sources, ProjectSourceRef{SourceID: src.ID, SourceURL: page.FinalURL, FetchID: fetchID,
				FieldEvidence: map[string]string{"points": fmt.Sprintf("%d points from official geodata file", len(pts))}})
			p.logf("geodata  %s — %d points for %q", src.URL, len(pts), src.ProjectHint)
			continue
		}

		ext, err := p.Extractor.Extract(ctx, src, page)
		if err != nil {
			res.Stats.Errors++
			p.logf("ERROR    %s — extract: %v", src.URL, err)
			if p.IsFatal != nil && p.IsFatal(err) {
				runErr = err
				p.logf("STOP     ending run early; storing what was extracted so far")
				break sourceLoop
			}
			continue
		}

		// Follow newly discovered official project pages (same host only — see DiscoverProjectLinks).
		var fresh []DiscoveredSource
		for _, d := range ext.Discovered {
			if !seenURL[d.URL] && discovered < opts.MaxDiscovered {
				seenURL[d.URL] = true
				discovered++
				fresh = append(fresh, d)
				sources = append(sources, Source{Agency: src.Agency, URL: d.URL, Kind: d.Kind, Enabled: true, RobotsStatus: RobotsUnknown})
			}
		}
		if len(fresh) > 0 {
			p.logf("found    %d new project pages on %s", len(fresh), src.URL)
			if !opts.DryRun {
				if _, err := p.Store.AddDiscoveredSources(ctx, src.ID, src.Agency, fresh); err != nil {
					p.logf("  saving discovered sources: %v", err)
				}
			}
		}

		for _, ep := range ext.Projects {
			res.Stats.Extracted++
			vp := p.Verifier.Verify(ep, page.Text)
			res.Stats.Rejected += len(vp.Rejected)
			if _, ok := vp.FieldEvidence["name"]; !ok {
				p.logf("DROP     %q on %s — name not supported by the page", ep.Name, src.URL)
				continue
			}
			// A registered project page is about one known project: its hint gives a stable key
			// even when the page's own title varies ("Versova-Andheri-Ghatkopar Metro Corridor" is
			// MMRDA's Metro Line 1). Pages yielding several projects fall back to their names.
			key := CanonicalKey(src.Agency, ep.Name)
			if strings.TrimSpace(src.ProjectHint) != "" && len(ext.Projects) == 1 {
				key = CanonicalKey(src.Agency, src.ProjectHint)
			}
			if key == "" {
				res.Skipped = append(res.Skipped, fmt.Sprintf("%q on %s: name has no Latin letters or digits to key it by", ep.Name, src.URL))
				p.logf("SKIP     %q on %s — can't key a name with no Latin letters/digits", ep.Name, src.URL)
				continue
			}
			c := getCandidate(cands, &order, key, src.Agency)
			mergeVerified(&c.vp, vp)
			c.sources = append(c.sources, ProjectSourceRef{SourceID: src.ID, SourceURL: page.FinalURL, FetchID: fetchID, FieldEvidence: vp.FieldEvidence})
			p.logf("extract  %q from %s — kept %d, rejected %d", ep.Name, src.URL, len(vp.FieldEvidence), len(vp.Rejected))
		}
	}

	// Store what was gathered even if the run was cut short (time budget, quota): the storing
	// phase gets a context that isn't already cancelled, bounded so it can't hang.
	storeCtx, cancelStore := context.WithTimeout(context.WithoutCancel(ctx), 10*time.Minute)
	defer cancelStore()
	ctx = storeCtx

	for _, key := range order {
		c := cands[key]
		// A project with no stations, localities or coordinates can't answer "what's near this
		// property?" — e.g. MMRDA's MUTP-II page lists programme items like "EMU Procurement".
		// Record it instead of storing an unlocatable row.
		if len(c.official) == 0 && len(c.vp.Project.Stations) == 0 && len(c.vp.Project.Localities) == 0 {
			res.Skipped = append(res.Skipped, key+": no location on the page (no stations, localities or coordinates)")
			continue
		}
		points, err := p.Locator.Locate(ctx, c.vp, c.official)
		if err != nil {
			p.logf("  locating %s: %v", key, err)
		}
		review := p.Policy.Decide(c.vp, points)
		cp := CanonicalProject{Key: key, Agency: c.agency, Project: c.vp, Points: points, Sources: c.sources, Review: review}
		if opts.DryRun {
			res.DryRun = append(res.DryRun, DryRunProject{Key: key, Name: c.vp.Project.Name, Review: review,
				Kept: c.vp.FieldEvidence, Rejected: c.vp.Rejected, Points: points})
			continue
		}
		wrote, err := p.Store.UpsertProject(ctx, cp)
		switch {
		case err != nil:
			res.Stats.Errors++
			p.logf("ERROR    storing %s: %v", key, err)
		case !wrote:
			res.Skipped = append(res.Skipped, key+": no verified name and no existing project to update")
		case review == ReviewApproved:
			res.Stats.Approved++
		default:
			res.Stats.Pending++
		}
	}

	if !opts.DryRun {
		if err := p.Store.FinishRun(ctx, runID, res.Stats, runErr); err != nil {
			p.logf("finishing run: %v", err)
		}
	}
	return res, runErr
}

func (p *Pipeline) saveFetch(ctx context.Context, opts RunOptions, runID uuid.UUID, src Source, page FetchResult) uuid.UUID {
	if opts.DryRun || src.ID == uuid.Nil {
		// Discovered-this-run sources get their registry row from AddDiscoveredSources; their
		// fetch is linked on the next run. Dry runs write nothing.
		return uuid.Nil
	}
	id, err := p.Store.SaveFetch(ctx, runID, src, page)
	if err != nil {
		p.logf("  saving fetch for %s: %v", src.URL, err)
		return uuid.Nil
	}
	return id
}

func getCandidate(m map[string]*candidate, order *[]string, key, agency string) *candidate {
	if c, ok := m[key]; ok {
		return c
	}
	c := &candidate{key: key, agency: agency, vp: VerifiedProject{FieldEvidence: map[string]string{}}}
	m[key] = c
	*order = append(*order, key)
	return c
}

// mergeVerified folds one source's verified project into the candidate: the first verified value
// for each scalar field wins (sources are processed in registry order — agency pages first);
// stations and localities are unioned by name; rejections are kept for review.
func mergeVerified(dst *VerifiedProject, src VerifiedProject) {
	d, s := &dst.Project, src.Project
	if _, ok := dst.FieldEvidence["name"]; !ok {
		d.Name, d.NameEvidence, d.Kind = s.Name, s.NameEvidence, s.Kind
	}
	if d.Kind == "" || d.Kind == "other" {
		d.Kind = s.Kind
	}
	if d.Status.Value == nil && s.Status.Value != nil {
		d.Status = s.Status
	}
	if d.ExpectedCompletion.Value == nil && s.ExpectedCompletion.Value != nil {
		d.ExpectedCompletion = s.ExpectedCompletion
	}
	if d.LengthKm.Value == nil && s.LengthKm.Value != nil {
		d.LengthKm = s.LengthKm
	}
	d.Stations = unionPlaces(d.Stations, s.Stations)
	d.Localities = unionPlaces(d.Localities, s.Localities)
	for k, v := range src.FieldEvidence {
		if _, ok := dst.FieldEvidence[k]; !ok {
			dst.FieldEvidence[k] = v
		}
	}
	dst.Rejected = append(dst.Rejected, src.Rejected...)
}

func unionPlaces(a, b []NamedPlace) []NamedPlace {
	seen := map[string]bool{}
	for _, p := range a {
		seen[strings.ToLower(p.Name)] = true
	}
	for _, p := range b {
		if !seen[strings.ToLower(p.Name)] {
			seen[strings.ToLower(p.Name)] = true
			a = append(a, p)
		}
	}
	return a
}

func filterSources(all []Source, url string) []Source {
	for _, s := range all {
		if s.URL == url {
			return []Source{s}
		}
	}
	return nil
}
