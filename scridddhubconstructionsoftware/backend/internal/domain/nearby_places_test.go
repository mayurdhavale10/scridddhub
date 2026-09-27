package domain

import "testing"

func TestMatchNearbyPlaces_RadiusPerKindAndDedupe(t *testing.T) {
	at := GeoPoint{Latitude: 19.255, Longitude: 73.135}
	north := func(km float64) GeoPoint { return GeoPoint{Latitude: at.Latitude + km/111.0, Longitude: at.Longitude} }
	places := []NearbyPlace{
		{Name: "Far School", Kind: "school", Points: []GeoPoint{north(4)}},                  // beyond 3 km
		{Name: "Dumping Ground", Kind: "landfill", Points: []GeoPoint{north(4)}},            // within 5 km
		{Name: "Line", Kind: "high_tension_line", Points: []GeoPoint{north(3), north(0.5)}}, // nearest vertex counts
		{Name: "Line", Kind: "high_tension_line", Points: []GeoPoint{north(0.8)}},           // same line, farther segment
		{Name: "Near School", Kind: "school", Points: []GeoPoint{north(1)}},
	}
	got := MatchNearbyPlaces(at, places)
	var names []string
	for _, m := range got {
		names = append(names, m.Place.Name)
	}
	want := []string{"Line", "Near School", "Dumping Ground"}
	if len(names) != len(want) {
		t.Fatalf("got %v, want %v", names, want)
	}
	for i := range want {
		if names[i] != want[i] {
			t.Fatalf("got %v, want %v", names, want)
		}
	}
	if got[0].DistanceKm != 0.5 {
		t.Errorf("line distance %v, want 0.5 (nearest vertex)", got[0].DistanceKm)
	}
}

func TestNearbyCell(t *testing.T) {
	key, centre := NearbyCell(GeoPoint{Latitude: 19.2555, Longitude: 73.1351})
	if key != "19.25,73.13" {
		t.Errorf("key %q", key)
	}
	if d := HaversineKm(GeoPoint{Latitude: 19.2555, Longitude: 73.1351}, centre); d > NearbyCellHalfDiagonalKm {
		t.Errorf("point %.2f km from its cell centre", d)
	}
}
