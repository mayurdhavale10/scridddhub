package search

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"slices"
	"testing"
	"time"
)

func TestExaDiscover_RequestAndFiltering(t *testing.T) {
	var got exaRequest
	var gotKey string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotKey = r.Header.Get("x-api-key")
		json.NewDecoder(r.Body).Decode(&got)
		// Shapes taken from a real Exa response for Alibag (2026-09-27).
		w.Write([]byte(`{"results":[
			{"url":"https://cidco.maharashtra.gov.in/Page?Token=36AF9200291","title":"Ulwe Road"},
			{"url":"https://www.mpcb.gov.in/sites/default/files/public_hearing/exe_summary/2026-02/Summary_English.pdf","title":"Summary"},
			{"url":"https://forestsclearance.nic.in/DownloadPdfFile.aspx?FileName=x.pdf","title":""},
			{"url":"https://raigad.gov.in/en/notice/land-acquisition-bridge-road/","title":"Land acquisition"}
		],"costDollars":{"total":0.012}}`))
	}))
	defer srv.Close()

	d := NewExaDiscoverer("test-key")
	d.endpoint = srv.URL
	urls, err := d.Discover(context.Background(), "Alibag, Raigad", []string{"cidco.maharashtra.gov.in", "gov.in"})
	if err != nil {
		t.Fatal(err)
	}
	if gotKey != "test-key" {
		t.Error("api key must be sent in x-api-key")
	}
	if !slices.Contains(got.IncludeDomains, "*.gov.in") || !slices.Contains(got.IncludeDomains, "gov.in") {
		t.Errorf("domains must be sent exactly and as wildcards: %v", got.IncludeDomains)
	}
	want := []string{"https://cidco.maharashtra.gov.in/Page?Token=36AF9200291", "https://raigad.gov.in/en/notice/land-acquisition-bridge-road/"}
	if !slices.Equal(urls, want) {
		t.Errorf("PDFs must be skipped; got %v", urls)
	}
}

func TestExaDiscover_ErrorStatus(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"error":"Invalid API key"}`))
	}))
	defer srv.Close()
	d := NewExaDiscoverer("bad")
	d.endpoint = srv.URL
	if _, err := d.Discover(context.Background(), "x", nil); err == nil {
		t.Fatal("non-200 must be an error")
	}
}

// Live check against Exa, skipped without EXA_API_KEY.
func TestExaDiscover_Live(t *testing.T) {
	key := os.Getenv("EXA_API_KEY")
	if key == "" {
		t.Skip("EXA_API_KEY not set")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	urls, err := NewExaDiscoverer(key).Discover(ctx, "Alibag, Raigad, Maharashtra", []string{"mmrda.maharashtra.gov.in", "cidco.maharashtra.gov.in", "gov.in", "nic.in"})
	if err != nil {
		t.Fatal(err)
	}
	t.Logf("%d URLs: %v", len(urls), urls)
	if len(urls) == 0 {
		t.Error("expected some official results for Alibag")
	}
}
