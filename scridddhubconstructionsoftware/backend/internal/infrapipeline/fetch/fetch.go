// Package fetch is stage 2 of the planned-infrastructure pipeline (PIPELINE_PLAN.md, task T1.2):
// it downloads one official page politely and returns it as an infrapipeline.FetchResult.
//
// Politeness rules, all enforced here rather than left to callers:
//   - robots.txt is read once per host per Fetcher and obeyed, including on redirects;
//   - at most one request per host every MinInterval (default 5 s), across concurrent callers;
//   - the app identifies itself in the User-Agent (no personal contact details);
//   - 401/403/429 and bot-challenge pages are recorded as blocked and never retried around —
//     no header, user-agent or proxy rotation.
package fetch

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/scridddhub/backend/internal/infrapipeline"
)

const (
	DefaultUserAgent   = "ScridddHub-InfraPipeline/1.0 (+https://scridddhub.example/bot)"
	robotsAgentToken   = "scridddhub-infrapipeline"
	DefaultMinInterval = 5 * time.Second
	maxBodyBytes       = 20 << 20 // 20 MB — official KML/PDF files can be large, pages are not
)

type Fetcher struct {
	UserAgent   string
	MinInterval time.Duration
	client      *http.Client

	mu       sync.Mutex
	robots   map[string]robotsRules // host -> rules, cached for the Fetcher's lifetime (one run)
	nextSlot map[string]time.Time   // host -> earliest time the next request may start
}

var _ infrapipeline.Fetcher = (*Fetcher)(nil)

func New() *Fetcher {
	f := &Fetcher{
		UserAgent:   DefaultUserAgent,
		MinInterval: DefaultMinInterval,
		robots:      map[string]robotsRules{},
		nextSlot:    map[string]time.Time{},
	}
	f.client = &http.Client{
		Timeout: 45 * time.Second,
		// Redirects are followed only to URLs robots.txt allows; each hop respects the rate limit.
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 5 {
				return errors.New("too many redirects")
			}
			if !f.robotsAllow(req.Context(), req.URL) {
				return errRobotsDisallowed
			}
			return f.wait(req.Context(), req.URL.Host)
		},
	}
	return f
}

var errRobotsDisallowed = errors.New("disallowed by robots.txt")

func (f *Fetcher) Fetch(ctx context.Context, rawURL string) (infrapipeline.FetchResult, error) {
	res := infrapipeline.FetchResult{FinalURL: rawURL, FetchedAt: time.Now()}
	u, err := url.Parse(rawURL)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		res.Status, res.Detail = infrapipeline.FetchError, fmt.Sprintf("invalid URL %q", rawURL)
		return res, nil
	}

	if !f.robotsAllow(ctx, u) {
		if ctx.Err() != nil {
			return res, ctx.Err()
		}
		res.Status, res.Detail = infrapipeline.FetchBlocked, "disallowed by robots.txt"
		return res, nil
	}
	if err := f.wait(ctx, u.Host); err != nil {
		return res, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		res.Status, res.Detail = infrapipeline.FetchError, err.Error()
		return res, nil
	}
	req.Header.Set("User-Agent", f.UserAgent)
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml,application/vnd.google-earth.kml+xml,application/json;q=0.9,*/*;q=0.8")

	resp, err := f.client.Do(req)
	if err != nil {
		if ctx.Err() != nil {
			return res, ctx.Err()
		}
		if errors.Is(err, errRobotsDisallowed) {
			res.Status, res.Detail = infrapipeline.FetchBlocked, "redirect target disallowed by robots.txt"
			return res, nil
		}
		res.Status, res.Detail = infrapipeline.FetchError, err.Error()
		return res, nil
	}
	defer resp.Body.Close()

	res.FinalURL = resp.Request.URL.String()
	res.HTTPStatus = resp.StatusCode
	res.ContentType = resp.Header.Get("Content-Type")

	switch {
	case resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusTooManyRequests:
		res.Status, res.Detail = infrapipeline.FetchBlocked, fmt.Sprintf("HTTP %d — recorded, not retried", resp.StatusCode)
		return res, nil
	case resp.StatusCode >= 400:
		res.Status, res.Detail = infrapipeline.FetchError, fmt.Sprintf("HTTP %d", resp.StatusCode)
		return res, nil
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, maxBodyBytes+1))
	if err != nil {
		res.Status, res.Detail = infrapipeline.FetchError, "reading body: "+err.Error()
		return res, nil
	}
	if len(body) > maxBodyBytes {
		res.Status, res.Detail = infrapipeline.FetchError, "body larger than 20 MB"
		return res, nil
	}

	sum := sha256.Sum256(body)
	res.Raw, res.ContentHash = body, hex.EncodeToString(sum[:])

	if isHTML(res.ContentType, body) {
		if looksLikeChallenge(body) {
			res.Status, res.Detail = infrapipeline.FetchBlocked, "bot-challenge / access-denied page — recorded, not bypassed"
			return res, nil
		}
		res.Text = HTMLToText(body)
	}
	res.Status = infrapipeline.FetchOK
	return res, nil
}

func isHTML(contentType string, body []byte) bool {
	if mt, _, err := mime.ParseMediaType(contentType); err == nil {
		return mt == "text/html" || mt == "application/xhtml+xml"
	}
	head := strings.ToLower(strings.TrimSpace(string(body[:min(len(body), 512)])))
	return strings.HasPrefix(head, "<!doctype html") || strings.HasPrefix(head, "<html")
}

// wait blocks until this host's next request slot, then reserves the following one.
func (f *Fetcher) wait(ctx context.Context, host string) error {
	f.mu.Lock()
	now := time.Now()
	start := f.nextSlot[host]
	if start.Before(now) {
		start = now
	}
	f.nextSlot[host] = start.Add(f.MinInterval)
	f.mu.Unlock()

	if d := time.Until(start); d > 0 {
		t := time.NewTimer(d)
		defer t.Stop()
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-t.C:
		}
	}
	return nil
}

// robotsAllow fetches (once per host) and applies robots.txt. Missing robots.txt (404/410) means
// allowed; 401/403 means we may not read the rules, so nothing on the host is fetched; server or
// network errors also mean "don't fetch now" (RFC 9309 §2.3.1.4 treats them as full disallow).
func (f *Fetcher) robotsAllow(ctx context.Context, u *url.URL) bool {
	f.mu.Lock()
	rules, ok := f.robots[u.Host]
	f.mu.Unlock()
	if !ok {
		rules = f.loadRobots(ctx, u)
		f.mu.Lock()
		f.robots[u.Host] = rules
		f.mu.Unlock()
	}
	path := u.EscapedPath()
	if path == "" {
		path = "/"
	}
	if u.RawQuery != "" {
		path += "?" + u.RawQuery
	}
	return rules.allowed(path)
}

func (f *Fetcher) loadRobots(ctx context.Context, u *url.URL) robotsRules {
	robotsURL := u.Scheme + "://" + u.Host + "/robots.txt"
	if err := f.wait(ctx, u.Host); err != nil {
		return robotsRules{disallowAll: true}
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, robotsURL, nil)
	if err != nil {
		return robotsRules{disallowAll: true}
	}
	req.Header.Set("User-Agent", f.UserAgent)
	resp, err := (&http.Client{Timeout: 20 * time.Second}).Do(req)
	if err != nil {
		return robotsRules{disallowAll: true}
	}
	defer resp.Body.Close()
	switch {
	case resp.StatusCode == http.StatusOK:
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512<<10))
		return parseRobots(string(body), robotsAgentToken)
	case resp.StatusCode >= 400 && resp.StatusCode < 500 && resp.StatusCode != 401 && resp.StatusCode != 403 && resp.StatusCode != 429:
		return robotsRules{allowAll: true} // no robots.txt published
	default:
		return robotsRules{disallowAll: true}
	}
}
