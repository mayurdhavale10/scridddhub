package infrapipeline

import "testing"

func TestCanonicalKey(t *testing.T) {
	same := []string{
		"Metro Line 12 (Kalyan–Taloja)",
		"Metro Line-12",
		"Mumbai Metro Line 12",
		"metro line 12",
		"Line 12",
	}
	want := "mmrda:metro line 12"
	for _, n := range same {
		if got := CanonicalKey("MMRDA", n); got != want {
			t.Errorf("CanonicalKey(%q) = %q, want %q", n, got, want)
		}
	}
	if CanonicalKey("MMRDA", "Metro Line 4A") == CanonicalKey("MMRDA", "Metro Line 4") {
		t.Error("4A and 4 are different projects")
	}
	if CanonicalKey("CIDCO", "Metro Line 1") == CanonicalKey("MMRDA", "Metro Line 1") {
		t.Error("same name from different agencies must not collide")
	}
	if got := CanonicalKey("MSRDC", "Versova–Bandra Sea Link"); got != "msrdc:versova bandra sea link" {
		t.Errorf("got %q", got)
	}
}
