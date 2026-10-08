package domain

import (
	"math"
	"testing"
)

func TestParseMapLink(t *testing.T) {
	cases := []struct {
		link     string
		lat, lng float64
		ok       bool
	}{
		// The pin (!3d/!4d) wins over where the view was centred (@).
		{"https://www.google.com/maps/place/Khadakpada/@19.2551,73.1350,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d19.2553!4d73.1347", 19.2553, 73.1347, true},
		{"https://www.google.com/maps/@19.0760,72.8777,15z", 19.0760, 72.8777, true},
		{"https://maps.google.com/?q=19.2553,73.1347", 19.2553, 73.1347, true},
		{"https://www.google.com/maps/search/?api=1&query=19.2553%2C73.1347", 19.2553, 73.1347, true},
		{"https://www.google.com/maps/search/19.2553,+73.1347?entry=tts", 19.2553, 73.1347, true},
		{"geo:19.2553,73.1347?z=17", 19.2553, 73.1347, true},
		// No coordinates in the link: never guessed.
		{"https://maps.app.goo.gl/AbCdEf123", 0, 0, false},
		{"https://www.google.com/maps/place/Khadakpada,+Kalyan", 0, 0, false},
		{"not a link", 0, 0, false},
	}
	for _, c := range cases {
		lat, lng, ok := ParseMapLink(c.link)
		if ok != c.ok || math.Abs(lat-c.lat) > 1e-9 || math.Abs(lng-c.lng) > 1e-9 {
			t.Errorf("ParseMapLink(%q) = %v,%v,%v; want %v,%v,%v", c.link, lat, lng, ok, c.lat, c.lng, c.ok)
		}
	}
}

func TestValidateParcelLocation(t *testing.T) {
	if err := ValidateParcelLocation(19.2553, 73.1347, "pin"); err != nil {
		t.Errorf("Khadakpada pin rejected: %v", err)
	}
	if ValidateParcelLocation(73.1347, 19.2553, "pin") == nil {
		t.Error("swapped latitude/longitude must be rejected (it's outside India)")
	}
	if ValidateParcelLocation(19.2553, 73.1347, "guess") == nil {
		t.Error("unknown location_source must be rejected")
	}
}
