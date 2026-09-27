package infrapipeline

import (
	"context"
	"fmt"
	"net/url"
	"sort"
	"strings"

	"github.com/google/uuid"
)

// OfficialSource is a discovered URL that passed the official-domain allowlist.
type OfficialSource struct {
	URL    string
	Agency string
}

// FilterOfficial keeps only http(s) URLs whose host is an allowlisted domain or a subdomain of
// one, labels each with the most specific matching domain's agency, and de-duplicates (ignoring
// fragments). Everything else — news sites, property portals, blogs — is dropped.
func FilterOfficial(urls []string, domains map[string]string) []OfficialSource {
	// Longest domain first so "mmrda.maharashtra.gov.in" beats the generic "gov.in".
	keys := make([]string, 0, len(domains))
	for d := range domains {
		keys = append(keys, strings.ToLower(d))
	}
	sort.Slice(keys, func(i, j int) bool { return len(keys[i]) > len(keys[j]) })

	seen := map[string]bool{}
	var out []OfficialSource
	for _, raw := range urls {
		u, err := url.Parse(strings.TrimSpace(raw))
		if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
			continue
		}
		normalizeURL(u)
		if isNonEnglishDuplicate(u) {
			continue
		}
		host := strings.ToLower(u.Hostname())
		for _, d := range keys {
			if host == d || strings.HasSuffix(host, "."+d) {
				s := u.String()
				if !seen[s] {
					seen[s] = true
					out = append(out, OfficialSource{URL: s, Agency: domains[d]})
				}
				break
			}
		}
	}
	return out
}

// normalizeURL makes search results match already-registered sources: no fragment, no "www."
// prefix, and no pagination parameter — seen 2026-09-27, Exa returned
// "www.mmrda…/metro-line-2b/overview?page=1" for the registered ".../metro-line-2b/overview".
// Other query parameters are kept: some sites address pages by them (CIDCO's "?Token=…").
func normalizeURL(u *url.URL) {
	u.Fragment = ""
	u.Host = strings.TrimPrefix(strings.ToLower(u.Host), "www.")
	q := u.Query()
	for _, p := range []string{"page", "lang", "reg"} {
		q.Del(p)
	}
	u.RawQuery = q.Encode()
}

// isNonEnglishDuplicate skips MMRDA pages outside its /en/ section: the same projects in Marathi
// extract under Marathi names and would become duplicate projects ("मुंबई पारबंदर प्रकल्प" =
// the MTHL Metro Link page, seen 2026-09-27).
func isNonEnglishDuplicate(u *url.URL) bool {
	return u.Host == "mmrda.maharashtra.gov.in" && strings.HasPrefix(u.Path, "/projects/")
}

// SearchArea is Step C for one area: discover candidate pages, keep official ones, register them
// as sources, and run the normal pipeline on just those. Results land as pending (or approved per
// policy) exactly like any other run. The area is marked searched either way, so it isn't
// searched again on every visit.
func (p *Pipeline) SearchArea(ctx context.Context, cov CoverageStore, disc Discoverer, area CoverageArea) (RunResult, error) {
	if err := cov.MarkAreaSearching(ctx, area.Cell); err != nil {
		return RunResult{}, err
	}
	finish := func(status string, sources, projects int, err error) {
		msg := ""
		if err != nil {
			msg = err.Error()
		}
		if ferr := cov.FinishArea(context.WithoutCancel(ctx), area.Cell, status, sources, projects, msg); ferr != nil {
			p.logf("  recording coverage for %s: %v", area.Cell, ferr)
		}
	}

	domains, err := cov.OfficialDomains(ctx)
	if err != nil {
		finish("failed", 0, 0, err)
		return RunResult{}, err
	}
	domainList := make([]string, 0, len(domains))
	for d := range domains {
		domainList = append(domainList, d)
	}
	sort.Strings(domainList)
	found, err := disc.Discover(ctx, area.PlaceName, domainList)
	if err != nil {
		finish("failed", 0, 0, err)
		return RunResult{}, fmt.Errorf("discovering sources near %s: %w", area.PlaceName, err)
	}
	official := FilterOfficial(found, domains)
	p.logf("discover %s — %d candidate URLs, %d official", area.PlaceName, len(found), len(official))
	if len(official) == 0 {
		finish("searched", 0, 0, nil)
		return RunResult{}, nil
	}

	byAgency := map[string][]DiscoveredSource{}
	urls := make([]string, 0, len(official))
	for _, o := range official {
		byAgency[o.Agency] = append(byAgency[o.Agency], DiscoveredSource{URL: o.URL, Kind: SourceProjectPage})
		urls = append(urls, o.URL)
	}
	for agency, srcs := range byAgency {
		if _, err := p.Store.AddDiscoveredSources(ctx, uuid.Nil, agency, srcs); err != nil {
			finish("failed", 0, 0, err)
			return RunResult{}, err
		}
	}

	res, runErr := p.Run(ctx, RunOptions{Trigger: TriggerOnDemand, SourceURLs: urls, MaxDiscovered: 20})
	status := "searched"
	if runErr != nil {
		status = "failed"
	}
	finish(status, len(official), res.Stats.Approved+res.Stats.Pending, runErr)
	return res, runErr
}
