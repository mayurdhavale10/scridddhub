package geo

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/scridddhub/backend/internal/domain"
)

// mapLinkHosts are the only hosts a pasted link may point to or redirect through. The server
// follows redirects on the user's behalf, so an open list would let anyone make it fetch
// arbitrary URLs.
var mapLinkHosts = []string{"maps.app.goo.gl", "goo.gl", "google.com", "google.co.in", "maps.google.com", "maps.google.co.in"}

func allowedMapHost(host string) bool {
	host = strings.ToLower(strings.TrimPrefix(host, "www."))
	for _, h := range mapLinkHosts {
		if host == h || strings.HasSuffix(host, "."+h) {
			return true
		}
	}
	return false
}

// ResolveMapLink returns the coordinates in a pasted Google Maps link. A short link
// (maps.app.goo.gl/...) has none until expanded, so its redirects are followed, one hop at a time,
// staying on Google's map hosts, and without reading any page content.
func ResolveMapLink(ctx context.Context, link string) (float64, float64, error) {
	link = strings.TrimSpace(link)
	if lat, lng, ok := domain.ParseMapLink(link); ok {
		return lat, lng, nil
	}
	client := &http.Client{
		Timeout:       10 * time.Second,
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}
	current := link
	for hop := 0; hop < 5; hop++ {
		u, err := url.Parse(current)
		if err != nil || (u.Scheme != "https" && u.Scheme != "http") || !allowedMapHost(u.Hostname()) {
			return 0, 0, fmt.Errorf("not a Google Maps link")
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodHead, current, nil)
		if err != nil {
			return 0, 0, err
		}
		resp, err := client.Do(req)
		if err != nil {
			return 0, 0, fmt.Errorf("couldn't open the link: %w", err)
		}
		resp.Body.Close()
		next := resp.Header.Get("Location")
		if next == "" {
			break
		}
		nu, err := u.Parse(next)
		if err != nil {
			break
		}
		current = nu.String()
		if lat, lng, ok := domain.ParseMapLink(current); ok {
			return lat, lng, nil
		}
	}
	return 0, 0, fmt.Errorf("that link has no pinned location in it — open it in Google Maps, drop a pin on the land, and share that")
}
