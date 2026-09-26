package fetch

import (
	"bytes"
	"regexp"
	"strings"

	"golang.org/x/net/html"
)

// skipTags never contain page content worth extracting.
var skipTags = map[string]bool{
	"script": true, "style": true, "noscript": true, "template": true, "svg": true,
	"nav": true, "header": true, "footer": true, "aside": true,
	"form": true, "button": true, "select": true, "option": true, "iframe": true,
}

// blockTags end a line of text, so sentences from different blocks never run together.
var blockTags = map[string]bool{
	"p": true, "div": true, "li": true, "ul": true, "ol": true, "br": true, "tr": true,
	"table": true, "section": true, "article": true, "h1": true, "h2": true, "h3": true,
	"h4": true, "h5": true, "h6": true, "dt": true, "dd": true, "td": true, "th": true,
}

// chromeHint marks containers that are site chrome by class or id. Deliberately narrow: only
// names that are almost never content. "sidebar", "header" and "region" are NOT listed — MMRDA's
// Drupal theme puts the actual project content inside "region-sidebar-second", and stripping it
// left 98 characters of a 125 KB page (found on the live site, 2026-09-27).
var chromeHint = regexp.MustCompile(`(?i)(^|[\s_-])(menu|navbar|breadcrumb|footer|cookie|modal)([\s_-]|$)`)

var (
	horizontalSpace = regexp.MustCompile(`[ \t\f\v\x{00a0}]+`)
	blankLines      = regexp.MustCompile(`\n\s*\n+`)
)

// HTMLToText returns the readable text of a page: only the <main> element (or role="main" /
// id="main-content") when the page has one, otherwise the body; minus scripts, styles and site
// chrome; block elements become line breaks. This is the text evidence quotes are checked
// against, so it must preserve the page's wording exactly.
func HTMLToText(raw []byte) string {
	doc, err := html.Parse(bytes.NewReader(raw))
	if err != nil {
		return ""
	}
	root := findMain(doc)
	if root == nil {
		root = doc
	}
	var b strings.Builder
	walk(root, &b)
	text := horizontalSpace.ReplaceAllString(b.String(), " ")
	lines := strings.Split(text, "\n")
	for i := range lines {
		lines[i] = strings.TrimSpace(lines[i])
	}
	return strings.TrimSpace(blankLines.ReplaceAllString(strings.Join(lines, "\n"), "\n"))
}

func findMain(n *html.Node) *html.Node {
	if n.Type == html.ElementNode {
		if n.Data == "main" || attr(n, "role") == "main" || attr(n, "id") == "main-content" {
			return n
		}
	}
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		if m := findMain(c); m != nil {
			return m
		}
	}
	return nil
}

func walk(n *html.Node, b *strings.Builder) {
	switch n.Type {
	case html.TextNode:
		b.WriteString(n.Data)
		return
	case html.ElementNode:
		if skipTags[n.Data] || chromeHint.MatchString(attr(n, "class")) || chromeHint.MatchString(attr(n, "id")) {
			return
		}
		if n.Data == "td" || n.Data == "th" {
			b.WriteString(" ")
		}
	}
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		walk(c, b)
	}
	if n.Type == html.ElementNode && blockTags[n.Data] {
		b.WriteString("\n")
	}
}

func attr(n *html.Node, key string) string {
	for _, a := range n.Attr {
		if a.Key == key {
			return a.Val
		}
	}
	return ""
}

// challengeMarkers identify bot-challenge / access-denied pages served with a 200 status.
var challengeMarkers = []string{
	"cf-chl", "cf_chl_opt", "checking your browser", "attention required! | cloudflare",
	"please enable cookies", "captcha", "access denied", "request unsuccessful. incapsula",
	"are you a robot", "ddos protection",
}

func looksLikeChallenge(raw []byte) bool {
	head := raw
	if len(head) > 20000 {
		head = head[:20000]
	}
	lower := strings.ToLower(string(head))
	for _, m := range challengeMarkers {
		if strings.Contains(lower, m) {
			return true
		}
	}
	return false
}
