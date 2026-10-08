package main

import (
	"bufio"
	"context"
	"log"
	"os"
	"strings"
	"time"

	"github.com/scridddhub/backend/internal/repository/postgres"
	"github.com/scridddhub/backend/internal/rera"
)

// runPincodes collects every registered project pincode by pincode, plus any pincode already
// seen in collected projects.
//
// MahaRERA is flaky in two ways, and neither page can be trusted on first sight:
//   - a page that shows a total but no rows;
//   - a page that says "Unable to find records" (no total) for a pincode that does have
//     projects. On 2026-10-02, Wakad (411057, 646 projects) came back "empty" this way.
//
// So an empty page after page 1 is always retried, and an "empty" page 1 is retried twice
// before the pincode is accepted as having no projects. A pincode whose stored count already
// matches MahaRERA's total is skipped after page 1, so re-runs only fill gaps.
//
// The statewide collection is marked complete only if the collected projects reach 99% of the
// statewide total MahaRERA reports, so "registered projects" is never claimed early.
func runPincodes(ctx context.Context, repo *postgres.RERARepository, client *rera.Client, path string) {
	pins, err := readPincodes(path)
	if err != nil {
		log.Fatal(err)
	}
	seen, err := repo.KnownPincodes(ctx)
	if err != nil {
		log.Fatal(err)
	}
	pins = mergePincodes(pins, seen)
	log.Printf("pincode run: %d pincodes", len(pins))

	// fetch returns one page's row count and the reported total. ok is false when the page
	// couldn't be read after retries.
	fetch := func(pin string, page int) (n, total int, ok bool) {
		backoff := 10 * time.Second
		for attempt := 1; attempt <= 3; attempt++ {
			body, err := client.PincodePage(ctx, pin, page)
			if err == nil {
				list, t := rera.ParseProjectPage(body, time.Now())
				if len(list) > 0 {
					if err := repo.UpsertProjects(ctx, list); err != nil {
						log.Fatal(err)
					}
					return len(list), t, true
				}
				// Page 1 with no total after the last retry: the pincode really is empty.
				if page == 1 && t == 0 && attempt == 3 {
					return 0, 0, true
				}
			}
			if ctx.Err() != nil {
				return 0, 0, false
			}
			select {
			case <-ctx.Done():
				return 0, 0, false
			case <-time.After(backoff):
			}
			backoff *= 3
		}
		return 0, 0, false
	}

	var failed []string
	rows, skipped := 0, 0
	for i, pin := range pins {
		n, total, ok := fetch(pin, 1)
		if ctx.Err() != nil {
			log.Printf("stopped at pincode %d/%d (%s)", i+1, len(pins), pin)
			return
		}
		if !ok {
			failed = append(failed, pin)
			continue
		}
		rows += n
		have, err := repo.CountByPincode(ctx, pin)
		if err != nil {
			log.Fatal(err)
		}
		if total > 0 && have >= total {
			skipped++
		} else {
			pinFailed := false
			for page := 2; page <= (total+9)/10; page++ {
				n, _, ok := fetch(pin, page)
				if ctx.Err() != nil {
					log.Printf("stopped at pincode %d/%d (%s) page %d", i+1, len(pins), pin, page)
					return
				}
				if !ok {
					pinFailed = true // keep going: later pages may still load
					continue
				}
				rows += n
			}
			if pinFailed {
				failed = append(failed, pin)
			}
		}
		if (i+1)%50 == 0 {
			log.Printf("pincode %d/%d, %d rows so far, %d already complete, %d failed", i+1, len(pins), rows, skipped, len(failed))
		}
	}
	log.Printf("done: %d pincodes, %d rows, %d already complete, %d failed", len(pins), rows, skipped, len(failed))
	if len(failed) > 0 {
		f := strings.Join(failed, "\n")
		_ = os.WriteFile(path+".failed", []byte(f+"\n"), 0o644)
		log.Printf("failed pincodes written to %s.failed; rerun with -pincodes %s.failed", path, path)
	}

	// Mark statewide complete only when we hold 99% of what MahaRERA says exists.
	stateTotal := 0
	for attempt := 0; attempt < 3 && stateTotal == 0; attempt++ {
		if body, err := client.ProjectPage(ctx, "0", 1); err == nil {
			_, stateTotal = rera.ParseProjectPage(body, time.Now())
		}
	}
	have, err := repo.ProjectCount(ctx)
	if err != nil {
		log.Fatal(err)
	}
	if stateTotal == 0 {
		log.Printf("collected %d projects; could not read the statewide total", have)
		return
	}
	log.Printf("collected %d of %d statewide projects", have, stateTotal)
	if have*100 >= stateTotal*99 {
		if err := repo.MarkComplete(context.Background(), "projects_state", time.Now()); err != nil {
			log.Fatal(err)
		}
		log.Print("marked projects_state collection complete")
	}
}

func readPincodes(path string) ([]string, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	var pins []string
	s := bufio.NewScanner(f)
	for s.Scan() {
		if p := strings.TrimSpace(s.Text()); len(p) == 6 {
			pins = append(pins, p)
		}
	}
	return pins, s.Err()
}

func mergePincodes(a, b []string) []string {
	set := map[string]bool{}
	var out []string
	for _, p := range append(a, b...) {
		if len(p) == 6 && !set[p] {
			set[p] = true
			out = append(out, p)
		}
	}
	return out
}
