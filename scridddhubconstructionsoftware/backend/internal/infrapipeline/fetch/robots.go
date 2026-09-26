package fetch

import (
	"bufio"
	"regexp"
	"strings"
)

// robotsRules is the parsed rule group that applies to our crawler: the group naming our token
// if there is one, otherwise the "*" group (RFC 9309).
type robotsRules struct {
	allowAll    bool // robots.txt missing (404) or no applicable group
	disallowAll bool // robots.txt couldn't be read for access reasons (401/403) — be conservative
	rules       []robotsRule
}

type robotsRule struct {
	allow   bool
	pattern string
	re      *regexp.Regexp
}

// parseRobots extracts the group for agentToken (case-insensitive substring match on the
// User-agent line), falling back to "*".
func parseRobots(body, agentToken string) robotsRules {
	type group struct {
		agents []string
		rules  []robotsRule
	}
	var groups []*group
	var cur *group
	lastWasAgent := false

	sc := bufio.NewScanner(strings.NewReader(body))
	sc.Buffer(make([]byte, 64*1024), 1<<20)
	for sc.Scan() {
		line := sc.Text()
		if i := strings.IndexByte(line, '#'); i >= 0 {
			line = line[:i]
		}
		key, val, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		key = strings.ToLower(strings.TrimSpace(key))
		val = strings.TrimSpace(val)
		switch key {
		case "user-agent":
			if !lastWasAgent || cur == nil {
				cur = &group{}
				groups = append(groups, cur)
			}
			cur.agents = append(cur.agents, strings.ToLower(val))
			lastWasAgent = true
		case "allow", "disallow":
			lastWasAgent = false
			if cur == nil {
				continue
			}
			if key == "disallow" && val == "" {
				continue // "Disallow:" with no path allows everything
			}
			cur.rules = append(cur.rules, robotsRule{allow: key == "allow", pattern: val, re: patternRegexp(val)})
		default:
			lastWasAgent = false
		}
	}

	token := strings.ToLower(agentToken)
	var star *group
	for _, g := range groups {
		for _, a := range g.agents {
			if a != "*" && a != "" && strings.Contains(token, a) {
				return robotsRules{rules: g.rules}
			}
			if a == "*" && star == nil {
				star = g
			}
		}
	}
	if star == nil {
		return robotsRules{allowAll: true}
	}
	return robotsRules{rules: star.rules}
}

// allowed applies the longest matching rule; on a tie Allow wins; no match means allowed.
func (r robotsRules) allowed(pathAndQuery string) bool {
	if r.disallowAll {
		return false
	}
	if r.allowAll {
		return true
	}
	best, bestLen, allow := -1, -1, true
	for i, rule := range r.rules {
		if rule.re.MatchString(pathAndQuery) {
			l := len(rule.pattern)
			if l > bestLen || (l == bestLen && rule.allow) {
				best, bestLen, allow = i, l, rule.allow
			}
		}
	}
	_ = best
	return allow
}

// patternRegexp supports the two robots.txt wildcards: '*' (any run) and a trailing '$' (end).
func patternRegexp(p string) *regexp.Regexp {
	anchorEnd := strings.HasSuffix(p, "$")
	p = strings.TrimSuffix(p, "$")
	parts := strings.Split(p, "*")
	for i := range parts {
		parts[i] = regexp.QuoteMeta(parts[i])
	}
	expr := "^" + strings.Join(parts, ".*")
	if anchorEnd {
		expr += "$"
	}
	return regexp.MustCompile(expr)
}
