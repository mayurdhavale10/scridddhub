// Package reportpdf turns a Parcel Due-Diligence Report into a printable document: an HTML page
// (html/template, so every value is escaped) rendered to A4 PDF by headless Chrome. Chrome is
// used because it shapes Devanagari correctly — owner names on a 7/12 are in Marathi — which the
// pure-Go PDF libraries don't. On a Linux server, install Chromium and Noto Sans Devanagari.
package reportpdf

import (
	"bytes"
	"context"
	"embed"
	"errors"
	"fmt"
	"html/template"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/scridddhub/backend/internal/domain"
	"github.com/scridddhub/backend/internal/usecase"
)

//go:embed report.html
var files embed.FS

// Document is everything the page shows.
type Document struct {
	ReportID    string
	Tier        string // quick | full
	Status      string // draft | signed | issued
	FinalisedAt *time.Time
	OpenItems   []string
	Sections    *usecase.ReportSections
	GeneratedAt time.Time
}

var tmpl = template.Must(template.New("report.html").Funcs(template.FuncMap{
	"crore": crore,
	"day": func(t *time.Time) string {
		if t == nil {
			return ""
		}
		return t.Format("2 Jan 2006")
	},
	"dayv": func(t time.Time) string { return t.Format("2 Jan 2006") },
	"f4":   func(v float64) string { return fmt.Sprintf("%.4f", v) },
	"f2":   func(v float64) string { return strings.TrimRight(strings.TrimRight(fmt.Sprintf("%.2f", v), "0"), ".") },
	"deref": func(v *float64) float64 {
		if v == nil {
			return 0
		}
		return *v
	},
	"sqft": func(v *int64) string {
		if v == nil {
			return ""
		}
		return indian(*v) + " sq ft"
	},
	"upper":        strings.ToUpper,
	"tenure":       tenureLabel,
	"occ":          occupancyLabel,
	"na":           naLabel,
	"risk":         riskLabel,
	"who":          whoLabel,
	"verdictLabel": verdictLabel,
	"authority":    authorityLabel,
	"mutationType": domain.MutationTypeLabel,
}).ParseFS(files, "report.html"))

// HTML renders the report page.
func HTML(d Document) ([]byte, error) {
	var b bytes.Buffer
	if err := tmpl.Execute(&b, d); err != nil {
		return nil, err
	}
	return b.Bytes(), nil
}

// ErrNoChrome: no Chrome/Chromium/Edge found to render the PDF.
var ErrNoChrome = errors.New("no Chrome or Edge found to render the PDF; set CHROME_PATH")

// PDF renders the page to A4 PDF with headless Chrome.
func PDF(ctx context.Context, page []byte) ([]byte, error) {
	chrome := findChrome()
	if chrome == "" {
		return nil, ErrNoChrome
	}
	dir, err := os.MkdirTemp("", "ddreport-*")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(dir)
	in, out := filepath.Join(dir, "report.html"), filepath.Join(dir, "report.pdf")
	if err := os.WriteFile(in, page, 0o600); err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, chrome,
		"--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run",
		"--user-data-dir="+filepath.Join(dir, "profile"),
		"--no-pdf-header-footer", "--print-to-pdf="+out,
		"file:///"+filepath.ToSlash(in))
	if msg, err := cmd.CombinedOutput(); err != nil {
		return nil, fmt.Errorf("chrome: %v: %s", err, strings.TrimSpace(string(msg)))
	}
	return os.ReadFile(out)
}

func findChrome() string {
	if p := os.Getenv("CHROME_PATH"); p != "" {
		return p
	}
	var candidates []string
	if runtime.GOOS == "windows" {
		for _, base := range []string{os.Getenv("ProgramFiles"), os.Getenv("ProgramFiles(x86)"), os.Getenv("LOCALAPPDATA")} {
			if base == "" {
				continue
			}
			candidates = append(candidates,
				filepath.Join(base, `Google\Chrome\Application\chrome.exe`),
				filepath.Join(base, `Microsoft\Edge\Application\msedge.exe`))
		}
	} else {
		for _, name := range []string{"chromium", "chromium-browser", "google-chrome", "google-chrome-stable"} {
			if p, err := exec.LookPath(name); err == nil {
				candidates = append(candidates, p)
			}
		}
	}
	for _, c := range candidates {
		if _, err := os.Stat(c); err == nil {
			return c
		}
	}
	return ""
}

// ---- labels ---------------------------------------------------------------------------------

func crore(v *int64) string {
	if v == nil {
		return ""
	}
	cr := float64(*v) / 1e7
	if cr >= 10 {
		return fmt.Sprintf("₹%.1f Cr", cr)
	}
	return fmt.Sprintf("₹%.2f Cr", cr)
}

// indian formats 304920 as 3,04,920.
func indian(n int64) string {
	s := fmt.Sprintf("%d", n)
	if len(s) <= 3 {
		return s
	}
	head, tail := s[:len(s)-3], s[len(s)-3:]
	var parts []string
	for len(head) > 2 {
		parts = append([]string{head[len(head)-2:]}, parts...)
		head = head[:len(head)-2]
	}
	if head != "" {
		parts = append([]string{head}, parts...)
	}
	return strings.Join(parts, ",") + "," + tail
}

func tenureLabel(t string) string {
	switch t {
	case "class_1":
		return "Class I"
	case "class_2":
		return "Class II"
	case "govt_lease":
		return "Government lease"
	}
	return "Not readable"
}

func occupancyLabel(o string) string {
	switch o {
	case "class_1":
		return "Class I"
	case "class_2":
		return "Class II"
	}
	return ""
}

func naLabel(n string) string {
	switch n {
	case "na_granted":
		return "NA order granted"
	case "in_process":
		return "NA applied, in process"
	case "not_na":
		return "Agricultural, no NA"
	case "not_needed":
		return "Not needed (zone allows it)"
	}
	return ""
}

func riskLabel(r string) string {
	switch r {
	case "low":
		return "Low"
	case "medium":
		return "Medium"
	case "high":
		return "High"
	}
	return "Not checked"
}

func whoLabel(w string) string {
	switch w {
	case "team":
		return "ScridddHub team"
	case "advocate":
		return "Advocate"
	case "builder":
		return "Buyer / seller"
	}
	return w
}

func verdictLabel(v string) string {
	switch v {
	case "go":
		return "Go"
	case "fix_first":
		return "Fix first, then buy"
	case "no_go":
		return "Don’t buy"
	}
	return ""
}

func authorityLabel(a string) string {
	switch a {
	case "municipal_corporation":
		return "Municipal corporation"
	case "other":
		return "Council / PMRDA / MMRDA area"
	case "regional_plan_no_pa":
		return "Regional Plan area, no planning authority"
	case "mumbai":
		return "Mumbai (DCPR 2034)"
	case "cidco_naina":
		return "CIDCO / NAINA"
	}
	return ""
}
