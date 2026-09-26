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
func CanonicalKey(agency, name string) string {
	n := strings.ToLower(parenthetical.ReplaceAllString(name, " "))
	n = strings.TrimSpace(nonAlnum.ReplaceAllString(n, " "))
	if m := metroLine.FindStringSubmatch(n); m != nil {
		n = "metro line " + m[3]
	}
	return strings.ToLower(strings.TrimSpace(agency)) + ":" + n
}
