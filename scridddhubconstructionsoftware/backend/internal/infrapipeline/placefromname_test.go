package infrapipeline

import "testing"

// Titles from MSRDC's real pages (2026-09-28 dry run), all skipped then for "no location".
func TestPlaceFromName(t *testing.T) {
	cases := map[string]string{
		"Flyovers at Barfiwala Lane Junction, Andheri":                                                          "Andheri",
		"Flyovers at Santacruz airport Junction on Western Express Highway":                                     "Santacruz airport",
		"Flyover at Times Of India Building,Malad junction on Western Express Highway":                          "Malad",
		"Flyovers at Dindoshi Junction, Goregaon on Western Express Highway":                                    "Goregaon",
		"Kanjurmarg ROB - Widening of existing ROB at kms 24/4-5 on Jogeshwari Vikroli Link Road at Kanjurmarg": "Kanjurmarg",
		// No place in the title: stays skipped rather than guessing.
		"Jogeshwari Vikroli Link Road": "",
		"Panvel Elevant Road":          "",
		// A chainage is not a place.
		"Widening of ROB at kms 24/4-5": "",
	}
	for name, want := range cases {
		if got := PlaceFromName(name); got != want {
			t.Errorf("PlaceFromName(%q) = %q, want %q", name, got, want)
		}
	}
}

func TestAddPlaceFromName_NeedsTheVerifiedTitleQuote(t *testing.T) {
	vp := VerifiedProject{
		Project:       ExtractedProject{Name: "Flyovers at Barfiwala Lane Junction, Andheri"},
		FieldEvidence: map[string]string{"name": "Flyovers at Barfiwala Lane Junction, Andheri"},
	}
	if !addPlaceFromName(&vp) || len(vp.Project.Localities) != 1 || vp.Project.Localities[0].Name != "Andheri" {
		t.Fatalf("want Andheri from the title, got %+v", vp.Project.Localities)
	}
	if vp.FieldEvidence["locality:Andheri"] == "" {
		t.Error("the added place must carry the title quote as evidence")
	}

	// Title not verified against the page: nothing is added.
	unverified := VerifiedProject{Project: ExtractedProject{Name: "Flyover at Malad"}, FieldEvidence: map[string]string{}}
	if addPlaceFromName(&unverified) {
		t.Error("a place must not come from an unverified title")
	}
	// Verified quote doesn't contain the place (model's name differs from the page's): nothing added.
	differs := VerifiedProject{
		Project:       ExtractedProject{Name: "Flyover at Malad"},
		FieldEvidence: map[string]string{"name": "Flyover on Western Express Highway"},
	}
	if addPlaceFromName(&differs) {
		t.Error("the place must appear in the quoted title")
	}
}
