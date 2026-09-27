package domain

import "testing"

func strp(s string) *string { return &s }

var testProjects = []InfrastructureProject{
	{Name: "Metro Line 12", Areas: []InfrastructureProjectArea{
		{District: "Thane", Taluka: "Kalyan", Note: "Kalyan APMC station"},
		{District: "Thane", Taluka: "Ambarnath"},
	}},
	{Name: "Pune Ring Road", Areas: []InfrastructureProjectArea{{District: "Pune", Taluka: "Haveli"}}},
}

func TestMatch_StructuredTaluka(t *testing.T) {
	p := PropertyLocation{Text: "anything", District: strp("thane"), Taluka: strp("KALYAN")}
	got := MatchPlannedInfrastructure(p, nil, "", testProjects, DefaultNearbyRadiusKm)
	if len(got) != 1 || got[0].Project.Name != "Metro Line 12" || got[0].MatchBasis != MatchBasisTaluka {
		t.Fatalf("unexpected: %+v", got)
	}
	if got[0].AreaNote != "Kalyan APMC station" {
		t.Fatalf("area note not carried: %q", got[0].AreaNote)
	}
}

func TestMatch_StructuredIgnoresLocationText(t *testing.T) {
	// A structured location is authoritative: free text naming another taluka must not add matches.
	p := PropertyLocation{Text: "near Haveli", District: strp("Thane"), Taluka: strp("Kalyan")}
	if got := MatchPlannedInfrastructure(p, nil, "", testProjects, DefaultNearbyRadiusKm); len(got) != 1 {
		t.Fatalf("expected only the Kalyan match, got %+v", got)
	}
}

func TestMatch_FreeTextWholeWord(t *testing.T) {
	p := PropertyLocation{Text: "Khadakpada kalyan west"}
	got := MatchPlannedInfrastructure(p, nil, "", testProjects, DefaultNearbyRadiusKm)
	if len(got) != 1 || got[0].MatchBasis != MatchBasisLocationText {
		t.Fatalf("unexpected: %+v", got)
	}
}

func TestMatch_FreeTextNoPartialWord(t *testing.T) {
	p := PropertyLocation{Text: "Kalyani Nagar, Pune"}
	if got := MatchPlannedInfrastructure(p, nil, "", testProjects, DefaultNearbyRadiusKm); len(got) != 0 {
		t.Fatalf("Kalyani must not match Kalyan: %+v", got)
	}
}

// Real coordinates: Khadakpada (geocoded) and two MMRDA Metro Line 5 stations (official KML).
var (
	khadakpada = GeoPoint{Latitude: 19.2525, Longitude: 73.1374}
	located    = []InfrastructureProject{
		{Name: "Metro Line 5", Points: []InfrastructurePoint{
			{Label: "Balkum Naka", Latitude: 19.220853, Longitude: 72.988592},
			{Label: "APMC Kalyan", Latitude: 19.235337, Longitude: 73.122788},
		}, Areas: []InfrastructureProjectArea{{District: "Thane", Taluka: "Kalyan"}}},
		{Name: "Far Airport", Points: []InfrastructurePoint{{Label: "Terminal", Latitude: 18.99, Longitude: 73.07}},
			Areas: []InfrastructureProjectArea{{District: "Thane", Taluka: "Kalyan"}}},
		{Name: "Unlocated Line", Areas: []InfrastructureProjectArea{{District: "Thane", Taluka: "Kalyan"}}},
	}
)

func TestHaversine_KnownDistance(t *testing.T) {
	// Khadakpada to APMC Kalyan: ~1.7 km north-south and ~1.5 km east-west, so ~2.3 km straight line.
	if d := HaversineKm(khadakpada, GeoPoint{Latitude: 19.235337, Longitude: 73.122788}); d < 2.0 || d > 2.7 {
		t.Fatalf("unexpected distance %.2f km", d)
	}
}

func TestMatch_DistanceUsesNearestPointAndSkipsFar(t *testing.T) {
	p := PropertyLocation{Text: "Khadakpada kalyan west"}
	got := MatchPlannedInfrastructure(p, &khadakpada, "", located, DefaultNearbyRadiusKm)
	if len(got) != 2 {
		t.Fatalf("want Metro Line 5 by distance + unlocated line by text, got %+v", got)
	}
	if got[0].Project.Name != "Metro Line 5" || got[0].MatchBasis != MatchBasisDistance || got[0].NearestPoint.Label != "APMC Kalyan" {
		t.Fatalf("unexpected first match: %+v", got[0])
	}
	if *got[0].DistanceKm > 3.0 {
		t.Fatalf("distance should be to the nearest station, got %.1f", *got[0].DistanceKm)
	}
	// Far Airport serves Kalyan taluka on paper but is ~29 km away: measured distance wins.
	if got[1].Project.Name != "Unlocated Line" || got[1].MatchBasis != MatchBasisLocationText {
		t.Fatalf("unexpected second match: %+v", got[1])
	}
}

func TestMatch_ResolvedAddressNamesTaluka(t *testing.T) {
	// "Godrej Hill, Khadakpada" names no taluka, but the geocoder resolved it inside Kalyan.
	p := PropertyLocation{Text: "Godrej Hill, Khadakpada"}
	addr := "Khadakpada, Kalyan, Kalyan-Dombivli, Kalyan Subdistrict, Thane, Maharashtra, 421306, India"
	got := MatchPlannedInfrastructure(p, &khadakpada, addr, located, DefaultNearbyRadiusKm)
	if len(got) != 2 || got[1].Project.Name != "Unlocated Line" || got[1].MatchBasis != MatchBasisResolvedArea {
		t.Fatalf("unlocated project should match via the resolved address: %+v", got)
	}
}

func TestMatch_UnresolvedLocationFallsBackToTaluka(t *testing.T) {
	p := PropertyLocation{Text: "Khadakpada kalyan west"}
	got := MatchPlannedInfrastructure(p, nil, "", located, DefaultNearbyRadiusKm)
	if len(got) != 3 {
		t.Fatalf("without coordinates every Kalyan project should match by text, got %d", len(got))
	}
}

func TestCoverageCell(t *testing.T) {
	key, centre := CoverageCell(GeoPoint{Latitude: 19.2525, Longitude: 73.1374}) // Khadakpada
	if key != "19.25,73.10" {
		t.Errorf("key %q, want 19.25,73.10", key)
	}
	if centre.Latitude < 19.27 || centre.Latitude > 19.28 || centre.Longitude < 73.12 || centre.Longitude > 73.13 {
		t.Errorf("centre %+v should be the middle of the cell", centre)
	}
	// Two lookups a few hundred metres apart share an area.
	if k2, _ := CoverageCell(GeoPoint{Latitude: 19.2560, Longitude: 73.1400}); k2 != key {
		t.Errorf("nearby point landed in a different cell: %s vs %s", k2, key)
	}
}

func TestMatch_NoMatch(t *testing.T) {
	p := PropertyLocation{Text: "Godrej Hill, Khadakpada"}
	if got := MatchPlannedInfrastructure(p, nil, "", testProjects, DefaultNearbyRadiusKm); len(got) != 0 {
		t.Fatalf("expected none, got %+v", got)
	}
}
