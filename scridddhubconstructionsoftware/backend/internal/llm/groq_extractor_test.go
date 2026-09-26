package llm

import (
	"context"
	"os"
	"testing"
	"time"
)

// Real integration test against the live Groq API — skipped automatically when no key is
// configured (e.g. CI without secrets), not a mock. Run with: go test ./internal/llm/...
func TestGroqSiteExtractor_Extract(t *testing.T) {
	apiKey := os.Getenv("GROQ_API_KEY")
	if apiKey == "" {
		t.Skip("GROQ_API_KEY not set — skipping real API call")
	}

	extractor := NewGroqSiteExtractor(apiKey)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	// The exact text from Screen 7's wireframe — same input, so this test doubles as
	// confirmation the extractor reads that text the way the screen assumes.
	result, err := extractor.Extract(ctx, "2.1 acre residential plot on Wagholi Rd, Pune. "+
		"Inland site, no significant tree cover, planning to use 2 borewells for construction "+
		"water, not near any airport. About 130 units.")
	if err != nil {
		t.Fatalf("Extract failed: %v", err)
	}

	if result.NearAirport {
		t.Errorf("NearAirport = true, want false (text says 'not near any airport')")
	}
	if result.CoastalSite {
		t.Errorf("CoastalSite = true, want false (text says 'inland site')")
	}
	if result.SignificantTreeCover {
		t.Errorf("SignificantTreeCover = true, want false (text says 'no significant tree cover')")
	}
	if !result.UsesGroundwater {
		t.Errorf("UsesGroundwater = false, want true (text mentions borewells)")
	}
	if result.UnitCount != 130 {
		t.Errorf("UnitCount = %d, want 130", result.UnitCount)
	}
}
