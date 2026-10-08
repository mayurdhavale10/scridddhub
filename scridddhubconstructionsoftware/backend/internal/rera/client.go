package rera

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

const baseURL = "https://www.maharera.maharashtra.gov.in"

// MaharashtraStateCode is MahaRERA's project_state value for Maharashtra.
const MaharashtraStateCode = "27"

// Client fetches MahaRERA's public list pages one at a time, waiting Delay between requests so
// a full collection never loads the site (about one page every 2-5 s).
type Client struct {
	HTTP      *http.Client
	Delay     time.Duration
	UserAgent string
	last      time.Time
}

func NewClient() *Client {
	return &Client{
		HTTP:      &http.Client{Timeout: 60 * time.Second},
		Delay:     2 * time.Second,
		UserAgent: "ScridddHub land due-diligence collector",
	}
}

func (c *Client) get(ctx context.Context, u string) (string, error) {
	if wait := c.Delay - time.Since(c.last); wait > 0 {
		select {
		case <-ctx.Done():
			return "", ctx.Err()
		case <-time.After(wait):
		}
	}
	defer func() { c.last = time.Now() }()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", c.UserAgent)
	req.Header.Set("Accept", "text/html")
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("GET %s: HTTP %d", u, resp.StatusCode)
	}
	body, err := io.ReadAll(resp.Body)
	return string(body), err
}

// ProjectPageURL is one page (1-based) of registered projects in Maharashtra. district is
// MahaRERA's district code ("0" for the whole state; Thane is "517", the Census 2011 code).
func ProjectPageURL(district string, page int) string {
	q := url.Values{
		"project_name":     {""},
		"project_location": {""},
		"project_state":    {MaharashtraStateCode},
		"project_district": {district},
		"page":             {strconv.Itoa(page)},
		"op":               {"Search"},
	}
	return baseURL + "/projects-search-result?" + q.Encode()
}

// PincodePageURL is one page (1-based) of registered projects in one Maharashtra pincode. Pincode
// searches stay a few pages deep; the site stops returning rows on very deep pages of a
// whole-district or whole-state search.
func PincodePageURL(pincode string, page int) string {
	q := url.Values{
		"project_name":     {""},
		"project_location": {pincode},
		"project_state":    {MaharashtraStateCode},
		"project_district": {"0"},
		"page":             {strconv.Itoa(page)},
		"op":               {"Search"},
	}
	return baseURL + "/projects-search-result?" + q.Encode()
}

func (c *Client) PincodePage(ctx context.Context, pincode string, page int) (string, error) {
	return c.get(ctx, PincodePageURL(pincode, page))
}

// ComplaintPageURL is one page (1-based) of the promoter-wise complaint list.
func ComplaintPageURL(page int) string {
	q := url.Values{
		"promoter_complaint_division": {"0"},
		"promoter_complaint_district": {"0"},
		"promoter_complaint_name":     {""},
		"page":                        {strconv.Itoa(page)},
	}
	return baseURL + "/promoter-complaint-report?" + q.Encode()
}

func (c *Client) ProjectPage(ctx context.Context, district string, page int) (string, error) {
	return c.get(ctx, ProjectPageURL(district, page))
}

func (c *Client) ComplaintPage(ctx context.Context, page int) (string, error) {
	return c.get(ctx, ComplaintPageURL(page))
}
