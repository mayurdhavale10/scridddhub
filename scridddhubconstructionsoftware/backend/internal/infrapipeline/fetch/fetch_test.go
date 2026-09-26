package fetch

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/scridddhub/backend/internal/infrapipeline"
)

const page = `<!doctype html><html><head><title>T</title><style>.x{}</style></head><body>
<header><div class="menu">Home About Projects Metro Line 1 Metro Line 2A</div></header>
<nav>Sitemap</nav>
<main><h1>Metro Line - 12</h1><p>Length: 23.57 Km (Fully Elevated)</p>
<table><tr><td>Pile Works</td><td>37.12% completed</td></tr></table>
<script>var tracking=1;</script></main>
<footer>Copyright MMRDA</footer></body></html>`

type site struct {
	robots       string
	robotsStatus int
	hits         atomic.Int32
	handler      http.HandlerFunc
}

func newSite(t *testing.T, s *site) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/robots.txt" {
			if s.robotsStatus != 0 {
				w.WriteHeader(s.robotsStatus)
				return
			}
			w.Write([]byte(s.robots))
			return
		}
		s.hits.Add(1)
		if s.handler != nil {
			s.handler(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write([]byte(page))
	}))
	t.Cleanup(srv.Close)
	return srv
}

func fastFetcher() *Fetcher {
	f := New()
	f.MinInterval = 50 * time.Millisecond
	return f
}

func TestFetch_OKExtractsMainContentOnly(t *testing.T) {
	s := &site{robots: "User-agent: *\nAllow: /\n"}
	srv := newSite(t, s)
	res, err := fastFetcher().Fetch(context.Background(), srv.URL+"/en/projects/metro-line-12")
	if err != nil || res.Status != infrapipeline.FetchOK {
		t.Fatalf("status %s (%s), err %v", res.Status, res.Detail, err)
	}
	for _, want := range []string{"Metro Line - 12", "Length: 23.57 Km (Fully Elevated)", "Pile Works", "37.12% completed"} {
		if !strings.Contains(res.Text, want) {
			t.Errorf("text missing %q:\n%s", want, res.Text)
		}
	}
	for _, unwanted := range []string{"Metro Line 2A", "Sitemap", "Copyright", "tracking", ".x{}"} {
		if strings.Contains(res.Text, unwanted) {
			t.Errorf("text should not contain %q:\n%s", unwanted, res.Text)
		}
	}
	if res.HTTPStatus != 200 || len(res.ContentHash) != 64 || len(res.Raw) == 0 {
		t.Errorf("unexpected result metadata: %+v", res)
	}
}

func TestFetch_SameContentSameHash(t *testing.T) {
	srv := newSite(t, &site{robots: ""})
	f := fastFetcher()
	a, _ := f.Fetch(context.Background(), srv.URL+"/a")
	b, _ := f.Fetch(context.Background(), srv.URL+"/a")
	if a.ContentHash == "" || a.ContentHash != b.ContentHash {
		t.Fatalf("identical content must hash identically: %q vs %q", a.ContentHash, b.ContentHash)
	}
}

func TestFetch_RobotsDisallowIsBlockedWithoutRequest(t *testing.T) {
	s := &site{robots: "User-agent: *\nDisallow: /private/\n"}
	srv := newSite(t, s)
	res, err := fastFetcher().Fetch(context.Background(), srv.URL+"/private/page")
	if err != nil || res.Status != infrapipeline.FetchBlocked || res.HTTPStatus != 0 {
		t.Fatalf("want blocked with no request made, got %+v, %v", res, err)
	}
	if s.hits.Load() != 0 {
		t.Fatal("a disallowed page must never be requested")
	}
}

func TestFetch_RobotsOwnGroupOverridesStar(t *testing.T) {
	s := &site{robots: "User-agent: *\nDisallow: /\n\nUser-agent: ScridddHub-InfraPipeline\nAllow: /projects/\nDisallow: /\n"}
	srv := newSite(t, s)
	f := fastFetcher()
	if r, _ := f.Fetch(context.Background(), srv.URL+"/projects/x"); r.Status != infrapipeline.FetchOK {
		t.Errorf("our group allows /projects/: %+v", r)
	}
	if r, _ := f.Fetch(context.Background(), srv.URL+"/admin"); r.Status != infrapipeline.FetchBlocked {
		t.Errorf("our group disallows everything else: %+v", r)
	}
}

func TestFetch_NoRobotsFileMeansAllowed(t *testing.T) {
	srv := newSite(t, &site{robotsStatus: http.StatusNotFound})
	if r, _ := fastFetcher().Fetch(context.Background(), srv.URL+"/x"); r.Status != infrapipeline.FetchOK {
		t.Fatalf("missing robots.txt means allowed: %+v", r)
	}
}

func TestFetch_ForbiddenRobotsMeansNothingFetched(t *testing.T) {
	s := &site{robotsStatus: http.StatusForbidden}
	srv := newSite(t, s)
	r, _ := fastFetcher().Fetch(context.Background(), srv.URL+"/x")
	if r.Status != infrapipeline.FetchBlocked || s.hits.Load() != 0 {
		t.Fatalf("unreadable robots.txt must block the host: %+v hits=%d", r, s.hits.Load())
	}
}

func TestFetch_403And429AreBlockedAndNotRetried(t *testing.T) {
	for _, code := range []int{http.StatusForbidden, http.StatusTooManyRequests} {
		s := &site{handler: func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(code) }}
		srv := newSite(t, s)
		r, _ := fastFetcher().Fetch(context.Background(), srv.URL+"/x")
		if r.Status != infrapipeline.FetchBlocked || r.HTTPStatus != code {
			t.Errorf("HTTP %d must be blocked: %+v", code, r)
		}
		if s.hits.Load() != 1 {
			t.Errorf("HTTP %d must not be retried, got %d requests", code, s.hits.Load())
		}
	}
}

func TestFetch_ChallengePageIsBlocked(t *testing.T) {
	s := &site{handler: func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		w.Write([]byte(`<html><body><div id="cf-chl-widget">Checking your browser before accessing</div></body></html>`))
	}}
	srv := newSite(t, s)
	if r, _ := fastFetcher().Fetch(context.Background(), srv.URL+"/x"); r.Status != infrapipeline.FetchBlocked {
		t.Fatalf("challenge page must be blocked: %+v", r)
	}
}

func TestFetch_ServerErrorIsError(t *testing.T) {
	srv := newSite(t, &site{handler: func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(503) }})
	if r, _ := fastFetcher().Fetch(context.Background(), srv.URL+"/x"); r.Status != infrapipeline.FetchError {
		t.Fatalf("503 is an error, not a block: %+v", r)
	}
}

func TestFetch_RedirectToDisallowedPathIsBlocked(t *testing.T) {
	s := &site{robots: "User-agent: *\nDisallow: /secret\n"}
	s.handler = func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/moved" {
			http.Redirect(w, r, "/secret/page", http.StatusFound)
			return
		}
		w.Write([]byte("should not be reached"))
	}
	srv := newSite(t, s)
	r, _ := fastFetcher().Fetch(context.Background(), srv.URL+"/moved")
	if r.Status != infrapipeline.FetchBlocked {
		t.Fatalf("redirect into a disallowed path must be blocked: %+v", r)
	}
}

func TestFetch_BinaryGeodataKeepsRawAndNoText(t *testing.T) {
	kml := `<?xml version="1.0"?><kml><Document><Placemark><name>A</name><Point><coordinates>73.1,19.2,0</coordinates></Point></Placemark></Document></kml>`
	srv := newSite(t, &site{handler: func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/vnd.google-earth.kml+xml")
		w.Write([]byte(kml))
	}})
	r, _ := fastFetcher().Fetch(context.Background(), srv.URL+"/line.kml")
	if r.Status != infrapipeline.FetchOK || string(r.Raw) != kml || r.Text != "" {
		t.Fatalf("geodata must be kept raw with no text: %+v", r)
	}
}

func TestFetch_RateLimitsPerHost(t *testing.T) {
	srv := newSite(t, &site{robots: ""})
	f := New()
	f.MinInterval = 150 * time.Millisecond
	ctx := context.Background()
	start := time.Now()
	for i := 0; i < 3; i++ { // robots.txt + 3 pages = 4 requests -> at least 3 intervals
		if r, _ := f.Fetch(ctx, srv.URL+"/p"); r.Status != infrapipeline.FetchOK {
			t.Fatalf("fetch %d: %+v", i, r)
		}
	}
	if elapsed := time.Since(start); elapsed < 3*150*time.Millisecond {
		t.Fatalf("4 requests to one host finished in %s; rate limit not applied", elapsed)
	}
}

func TestFetch_ContextCancelled(t *testing.T) {
	srv := newSite(t, &site{robots: ""})
	f := fastFetcher()
	if r, _ := f.Fetch(context.Background(), srv.URL+"/first"); r.Status != infrapipeline.FetchOK {
		t.Fatalf("first fetch: %+v", r)
	}
	// Reserve the host's next slot an hour out, so the next request would have to wait.
	host := strings.TrimPrefix(srv.URL, "http://")
	f.mu.Lock()
	f.nextSlot[host] = time.Now().Add(time.Hour)
	f.mu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()
	start := time.Now()
	if _, err := f.Fetch(ctx, srv.URL+"/second"); err == nil {
		t.Fatal("cancelled context must return an error rather than wait")
	}
	if time.Since(start) > 2*time.Second {
		t.Fatal("cancellation must return promptly")
	}
}

func TestFetch_InvalidURL(t *testing.T) {
	if r, err := fastFetcher().Fetch(context.Background(), "ftp://x/y"); err != nil || r.Status != infrapipeline.FetchError {
		t.Fatalf("non-http URL must be an error result: %+v %v", r, err)
	}
}

// testdata/mmrda_metro_line_12.html is MMRDA's real page, saved 2026-09-27. Its content sits in a
// Drupal block classed "region-sidebar-second" — an earlier, broader chrome filter stripped it and
// left 98 characters. This pins the fix.
func TestHTMLToText_RealMMRDAPageKeepsContentDropsMenu(t *testing.T) {
	raw, err := os.ReadFile("testdata/mmrda_metro_line_12.html")
	if err != nil {
		t.Fatal(err)
	}
	text := HTMLToText(raw)
	for _, want := range []string{
		"Metro Line 12 connection through Kalyan, Dombivali MIDC",
		"Length: 23.57 Km (Fully Elevated)",
		"Stations: 19 Nos.",
		"Updated as on 31st August 2026",
		"37.12% completed",
	} {
		if !strings.Contains(text, want) {
			t.Errorf("missing %q", want)
		}
	}
	// The site-wide projects menu (which lists every other metro line) must be gone.
	if strings.Contains(text, "Metro Line- 2A") || strings.Contains(text, "Mumbai Trans Harbour Link") {
		t.Error("site navigation menu leaked into the text")
	}
	if len(text) > 5000 {
		t.Errorf("text is %d chars; menu/chrome probably leaked", len(text))
	}
}

func TestParseRobots_Wildcards(t *testing.T) {
	r := parseRobots("User-agent: *\nDisallow: /*.pdf$\nDisallow: /search\nAllow: /search/about\n", robotsAgentToken)
	cases := map[string]bool{
		"/docs/a.pdf":   false,
		"/docs/a.pdfx":  true,
		"/search?q=1":   false,
		"/search/about": true, // longer Allow beats shorter Disallow
		"/projects":     true,
	}
	for path, want := range cases {
		if got := r.allowed(path); got != want {
			t.Errorf("allowed(%q) = %v, want %v", path, got, want)
		}
	}
}
