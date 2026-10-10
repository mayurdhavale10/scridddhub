package domain

import (
	"strings"
	"time"
)

// Eco-sensitive zones (ESZ): areas around protected areas where MoEFCC notifications restrict
// building, land-use change and industry. Each notification lists its villages; a parcel is
// checked against those lists by district + taluka + village. Only notifications loaded into
// esz_notifications are checked, so "not listed" always names which ones were checked.

type ESZNotification struct {
	ID         string
	Name       string
	SONumber   string
	NotifiedOn time.Time
	Status     string // final | draft
	SourceURL  string
	Summary    string
}

type ESZVillage struct {
	NotificationID string
	District       string
	Taluka         string
	Village        string
	Coverage       string // full | partial
}

// ESZResult is the outcome for one notification.
type ESZResult struct {
	Notification ESZNotification
	Listed       bool   // the parcel's village is on the list
	Coverage     string // full | partial, when listed
	Exact        bool   // false = spelling differs slightly; a person should confirm
	ListedAs     string // the village as spelled in the notification
}

// talukaAliases: talukas renamed or split since a notification was issued. Ulhasnagar tehsil's
// villages in the 2003 Matheran list are in today's Ambernath taluka.
var talukaAliases = map[string][]string{
	"ulhasnagar": {"ambernath", "ulhasnagar"},
}

func sameTaluka(listed, parcel string) bool {
	l, p := normalizePlace(listed), normalizePlace(parcel)
	if l == p {
		return true
	}
	for _, a := range talukaAliases[l] {
		if normalizePlace(a) == p {
			return true
		}
	}
	return false
}

// normalizePlace folds the usual English spellings of Marathi place names together:
// "Wanjale"/"Vanjale", "Bhutiwali"/"Bhutivali", "Pali Tarf Waredi"/"Pali T. Waredi".
func normalizePlace(s string) string {
	s = strings.ToLower(s)
	s = strings.NewReplacer("tarf", "t", " t.", " t", ".", "", "bk", "bk", "budruk", "bk", "khurd", "kh").Replace(s)
	var b strings.Builder
	for _, r := range s {
		if r >= 'a' && r <= 'z' {
			b.WriteRune(r)
		}
	}
	out := b.String()
	out = strings.NewReplacer("w", "v", "ee", "i", "oo", "u", "aa", "a", "sh", "s", "z", "j").Replace(out)
	return out
}

// CheckESZ checks one parcel's village against every loaded notification. A near spelling
// (one letter off, names of 6+ letters) counts as listed but not exact, so a person confirms it.
func CheckESZ(notifications []ESZNotification, villages []ESZVillage, district, taluka, village string) []ESZResult {
	var out []ESZResult
	pv := normalizePlace(village)
	for _, n := range notifications {
		res := ESZResult{Notification: n}
		for _, v := range villages {
			if v.NotificationID != n.ID || !strings.EqualFold(strings.TrimSpace(v.District), strings.TrimSpace(district)) ||
				!sameTaluka(v.Taluka, taluka) {
				continue
			}
			lv := normalizePlace(v.Village)
			if lv == pv {
				res = ESZResult{Notification: n, Listed: true, Coverage: v.Coverage, Exact: true, ListedAs: v.Village}
				break
			}
			if !res.Listed && len(pv) >= 6 && editDistance(lv, pv) == 1 {
				res = ESZResult{Notification: n, Listed: true, Coverage: v.Coverage, Exact: false, ListedAs: v.Village}
			}
		}
		out = append(out, res)
	}
	return out
}

func editDistance(a, b string) int {
	ra, rb := []rune(a), []rune(b)
	prev := make([]int, len(rb)+1)
	for j := range prev {
		prev[j] = j
	}
	for i := 1; i <= len(ra); i++ {
		cur := make([]int, len(rb)+1)
		cur[0] = i
		for j := 1; j <= len(rb); j++ {
			cost := 1
			if ra[i-1] == rb[j-1] {
				cost = 0
			}
			cur[j] = min(prev[j]+1, cur[j-1]+1, prev[j-1]+cost)
		}
		prev = cur
	}
	return prev[len(rb)]
}
