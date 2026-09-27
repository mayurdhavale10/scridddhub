package infrapipeline

import (
	"regexp"
	"strings"
)

var (
	parenthetical = regexp.MustCompile(`\([^)]*\)`)
	nonAlnum      = regexp.MustCompile(`[^a-z0-9]+`)
	// "Metro Line-12", "Metro Line 12", "Line 12" and "Mumbai Metro Line 12" name the same project.
	metroLine = regexp.MustCompile(`^(mumbai )?(metro )?line ([0-9]+[a-z]?)$`)
)

// CanonicalKey is the stable identity used to dedupe a project across sources and runs:
// "<agency>:<normalized name>". Route descriptions in parentheses are dropped, so
// "Metro Line 12 (Kalyan–Taloja)" and "Metro Line-12" from the same agency collide on purpose.
// Hand-seeded rows must use the same key (see backend/seeds/infrastructure_projects.sql).
//
// Returns "" when the name has no Latin letters or digits (e.g. a Marathi-only name): such a name
// would otherwise reduce to "<agency>:" and every non-English name would collide into one project
// (happened 2026-09-27 with "मुंबई पारबंदर प्रकल्प"). Callers must skip "" keys.
func CanonicalKey(agency, name string) string {
	n := strings.ToLower(parenthetical.ReplaceAllString(name, " "))
	n = strings.TrimSpace(nonAlnum.ReplaceAllString(n, " "))
	if n == "" {
		return ""
	}
	if m := metroLine.FindStringSubmatch(n); m != nil {
		n = "metro line " + m[3]
	}
	return strings.ToLower(strings.TrimSpace(agency)) + ":" + n
}
