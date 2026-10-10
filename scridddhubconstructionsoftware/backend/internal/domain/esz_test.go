package domain

import "testing"

func TestCheckESZ_TalukaMattersAndSpellingsFold(t *testing.T) {
	n := []ESZNotification{{ID: "matheran", Name: "Matheran ESZ"}}
	v := []ESZVillage{
		{NotificationID: "matheran", District: "Raigad", Taluka: "Panvel", Village: "Dhamani", Coverage: "partial"},
		{NotificationID: "matheran", District: "Raigad", Taluka: "Karjat", Village: "Wanjale", Coverage: "partial"},
		{NotificationID: "matheran", District: "Raigad", Taluka: "Karjat", Village: "Mangaon Tarf Waredi", Coverage: "partial"},
		{NotificationID: "matheran", District: "Thane", Taluka: "Ulhasnagar", Village: "Vangani", Coverage: "partial"},
	}
	cases := []struct {
		district, taluka, village string
		listed, exact             bool
	}{
		{"Raigad", "Karjat", "Dhamni", false, false}, // Dhamani is in Panvel, not Karjat
		{"Raigad", "Panvel", "Dhamni", true, false},  // same taluka, one letter off: flag for a person
		{"Raigad", "Karjat", "Vanjale", true, true},  // w/v spelling
		{"Raigad", "Karjat", "Mangaon T. Waredi", true, true},
		{"Thane", "Ambernath", "Vangani", true, true}, // Ulhasnagar tehsil of 2003 = Ambernath today
		{"Pune", "Karjat", "Wanjale", false, false},   // wrong district
	}
	for _, c := range cases {
		got := CheckESZ(n, v, c.district, c.taluka, c.village)
		if len(got) != 1 || got[0].Listed != c.listed || (c.listed && got[0].Exact != c.exact) {
			t.Errorf("%s/%s/%s: got %+v, want listed=%v exact=%v", c.district, c.taluka, c.village, got, c.listed, c.exact)
		}
	}
}
