package main

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	"github.com/scridddhub/backend/internal/infrapipeline"
	"github.com/scridddhub/backend/internal/infrapipeline/fetch"
)

var (
	dashes = strings.NewReplacer("–", "-", "—", "-", "‑", "-")
	spaces = regexp.MustCompile(`\s+`)
)

// normText makes page text and a pasted quote comparable: case, runs of whitespace and dash styles
// differ between what a browser shows and what the page's HTML holds.
func normText(s string) string {
	return strings.TrimSpace(spaces.ReplaceAllString(strings.ToLower(dashes.Replace(s)), " "))
}

// quoteOnPage reports whether the quote appears on the page, word for word.
func quoteOnPage(pageText, quote string) bool {
	q := normText(quote)
	return len(q) >= 12 && strings.Contains(normText(pageText), q)
}

// sentenceWith returns the page's own line containing the name as a whole word, as evidence.
func sentenceWith(pageText, name string) (string, bool) {
	re := regexp.MustCompile(`(?i)\b` + regexp.QuoteMeta(normText(name)) + `\b`)
	for _, line := range strings.Split(pageText, "\n") {
		if re.MatchString(normText(line)) {
			return strings.TrimSpace(line), true
		}
	}
	return "", false
}

// fetchText fetches an official page politely (robots.txt, rate limit) and returns its readable
// text, the same text the pipeline checks its evidence against.
func fetchText(ctx context.Context, f *fetch.Fetcher, u string) (string, error) {
	res, err := f.Fetch(ctx, u)
	if err != nil {
		return "", err
	}
	if res.Status != infrapipeline.FetchOK {
		return "", fmt.Errorf("%s: %s (%s)", u, res.Status, res.Detail)
	}
	return res.Text, nil
}
