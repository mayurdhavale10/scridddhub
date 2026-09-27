package infrapipeline

import "testing"

var testDomains = map[string]string{
	"mmrda.maharashtra.gov.in": "MMRDA",
	"cidco.maharashtra.gov.in": "CIDCO",
	"mmrcl.com":                "MMRCL",
	"gov.in":                   "Government of India / Maharashtra",
}

func TestFilterOfficial(t *testing.T) {
	got := FilterOfficial([]string{
		"https://mmrda.maharashtra.gov.in/en/projects/transport/metro-line-9/overview",
		"https://mmrda.maharashtra.gov.in/en/projects/transport/metro-line-9/overview#status", // dup after fragment
		"https://www.mmrcl.com/project/line-3",                                                // subdomain of allowlisted
		"https://vvcmc.gov.in/projects/ring-road",                                             // generic gov.in
		"https://www.magicbricks.com/vasai-metro",                                             // portal — dropped
		"https://timesofindia.indiatimes.com/city/mumbai/metro-9",                             // news — dropped
		"https://notgov.in.example.com/x",                                                     // lookalike — dropped
		"ftp://mmrda.maharashtra.gov.in/file",                                                 // not http(s)
		"not a url",
	}, testDomains)

	want := map[string]string{
		"https://mmrda.maharashtra.gov.in/en/projects/transport/metro-line-9/overview": "MMRDA",
		"https://mmrcl.com/project/line-3":                                             "MMRCL", // www. stripped
		"https://vvcmc.gov.in/projects/ring-road":                                      "Government of India / Maharashtra",
	}
	if len(got) != len(want) {
		t.Fatalf("want %d official sources, got %d: %+v", len(want), len(got), got)
	}
	for _, s := range got {
		if want[s.URL] != s.Agency {
			t.Errorf("%s: agency %q, want %q", s.URL, s.Agency, want[s.URL])
		}
	}
}

func TestFilterOfficial_NormalisesToRegisteredURL(t *testing.T) {
	// Real Exa results for Alibag (2026-09-27).
	got := FilterOfficial([]string{
		"https://www.mmrda.maharashtra.gov.in/en/projects/transport/metro-line-2b/overview?page=1",
		"https://mmrda.maharashtra.gov.in/projects/transport/mumbai-trans-harbor-link%E2%80%93metro-link/overview", // Marathi copy
		"https://cidco.maharashtra.gov.in/Page?Token=36AF9200291",
	}, testDomains)
	if len(got) != 2 {
		t.Fatalf("want 2 (Marathi duplicate dropped), got %+v", got)
	}
	if got[0].URL != "https://mmrda.maharashtra.gov.in/en/projects/transport/metro-line-2b/overview" {
		t.Errorf("www and ?page must be stripped to match the registered source, got %s", got[0].URL)
	}
	if got[1].URL != "https://cidco.maharashtra.gov.in/Page?Token=36AF9200291" {
		t.Errorf("addressing query parameters must be kept, got %s", got[1].URL)
	}
}

func TestFilterOfficial_MostSpecificDomainWins(t *testing.T) {
	got := FilterOfficial([]string{"https://cidco.maharashtra.gov.in/metro"}, testDomains)
	if len(got) != 1 || got[0].Agency != "CIDCO" {
		t.Fatalf("CIDCO's own domain must beat generic gov.in: %+v", got)
	}
}
