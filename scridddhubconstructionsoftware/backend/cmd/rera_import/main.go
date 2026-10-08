// rera_import collects MahaRERA's public project list and promoter-wise complaint list into
// rera_projects / rera_promoter_complaints. One page every 4 s by default; a full state run is
// about 5,000 project pages (~8 hours) and 542 complaint pages (~1 hour). Re-running
// updates rows in place; -from resumes an interrupted run, -pages refetches skipped pages.
//
//	go run ./cmd/rera_import -district 517            # Thane only (~700 pages)
//	go run ./cmd/rera_import                          # whole state
//	go run ./cmd/rera_import -complaints              # complaint list only
//	go run ./cmd/rera_import -pincodes pins.txt       # statewide, pincode by pincode (recommended)
//
// MahaRERA's site stops returning rows on very deep pages (Thane pages ~650+ of 697 came back
// empty), so a whole-state run can't reach every project. Pincode searches stay a few pages
// deep; services/legalcheck/maharashtra_pincodes.txt (GeoNames, CC BY 4.0) lists 1,583.
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
	"github.com/scridddhub/backend/internal/repository/postgres"
	"github.com/scridddhub/backend/internal/rera"
)

func main() {
	district := flag.String("district", "0", `MahaRERA district code; "0" = whole state, "517" = Thane, "518" = Mumbai Suburban, "519" = Mumbai City, "521" = Pune`)
	from := flag.Int("from", 1, "first page (to resume)")
	maxPages := flag.Int("max", 0, "stop after this many pages (0 = all)")
	complaints := flag.Bool("complaints", false, "collect the promoter-wise complaint list instead of projects")
	delay := flag.Duration("delay", 4*time.Second, "wait between requests")
	only := flag.String("pages", "", "comma-separated pages to fetch instead of a range (to refetch skipped pages)")
	finishes := flag.String("finishes", "", `with -pages: the run whose gaps these are ("complaints" or "projects_state"); marks it complete if all succeed`)
	pincodeFile := flag.String("pincodes", "", "file with one Maharashtra pincode per line: collect projects pincode by pincode (the statewide list breaks on deep pages)")
	flag.Parse()

	// Which collection this run can complete: the complaint list, or the statewide project list.
	kind := ""
	switch {
	case *complaints:
		kind = "complaints"
	case *district == "0":
		kind = "projects_state"
	}

	_ = godotenv.Load()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL is required")
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	pool, err := postgres.NewPool(ctx, dsn)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()
	repo := postgres.NewRERARepository(pool)
	client := rera.NewClient()
	client.Delay = *delay

	if *pincodeFile != "" {
		runPincodes(ctx, repo, client, *pincodeFile)
		return
	}

	// fetchParsed gets one page and parses it. MahaRERA randomly answers "No Records Found" for
	// a page that loads fine a moment later, so an empty page is retried after 10 s and 30 s.
	fetchParsed := func(page int) (projects, total int, err error) {
		backoff := 10 * time.Second
		for attempt := 1; ; attempt++ {
			var body string
			if *complaints {
				body, err = client.ComplaintPage(ctx, page)
			} else {
				body, err = client.ProjectPage(ctx, *district, page)
			}
			if err == nil {
				now := time.Now()
				if *complaints {
					list, pages := rera.ParseComplaintPage(body, now)
					if len(list) > 0 {
						return len(list), pages * 10, repo.UpsertComplaints(ctx, list)
					}
				} else {
					list, t := rera.ParseProjectPage(body, now)
					if len(list) > 0 {
						return len(list), t, repo.UpsertProjects(ctx, list)
					}
				}
				err = fmt.Errorf("page had no rows")
				_ = os.WriteFile(filepath.Join(os.TempDir(), "rera_empty_page.html"), []byte(body), 0o644)
			}
			if ctx.Err() != nil || attempt == 3 {
				return 0, 0, err
			}
			log.Printf("page %d attempt %d: %v; waiting %s", page, attempt, err, backoff)
			select {
			case <-ctx.Done():
				return 0, 0, ctx.Err()
			case <-time.After(backoff):
			}
			backoff *= 3
		}
	}

	// Either the listed pages (-pages, to refetch ones a run skipped) or from -from to the end.
	var listed []int
	for _, s := range strings.Split(*only, ",") {
		if n, err := strconv.Atoi(strings.TrimSpace(s)); err == nil {
			listed = append(listed, n)
		}
	}

	fetched, rows, inARow := 0, 0, 0
	var skipped []string
	last := 0
	if len(listed) > 0 {
		last = len(listed)
	}
	for i, page := 0, *from; ; i, page = i+1, page+1 {
		if len(listed) > 0 {
			if i >= len(listed) {
				break
			}
			page = listed[i]
		} else if last > 0 && page > last {
			break
		}
		if *maxPages > 0 && fetched >= *maxPages {
			break
		}
		n, total, err := fetchParsed(page)
		if ctx.Err() != nil {
			log.Printf("stopped; resume with -from %d", page)
			break
		}
		if err != nil {
			skipped = append(skipped, strconv.Itoa(page))
			inARow++
			log.Printf("page %d skipped: %v", page, err)
			// Many failures in a row means the site is down or has changed, not just flaky.
			if inARow >= 10 {
				log.Printf("10 pages in a row failed; stopping. Resume with -from %d", page+1)
				break
			}
			continue
		}
		inARow = 0
		fetched++
		if last == 0 {
			last = (total + 9) / 10
		}
		rows += n
		if page%25 == 0 || page == *from {
			log.Printf("page %d/%d, %d rows so far", page, last, rows)
		}
	}
	log.Printf("done: %d pages, %d rows", fetched, rows)
	if len(skipped) > 0 {
		log.Printf("skipped %d pages; refetch with -pages %s -finishes %s", len(skipped), strings.Join(skipped, ","), kind)
		return
	}
	if ctx.Err() != nil || kind == "" {
		return
	}
	// A run is complete when it covered every page with no gaps: a full run from page 1, or a
	// -pages run that refetched the gaps of one (-finishes says which).
	fullRun := len(listed) == 0 && *from == 1 && *maxPages == 0 && last > 0 && fetched == last
	gapsRun := len(listed) > 0 && *finishes == kind
	if fullRun || gapsRun {
		if err := repo.MarkComplete(context.Background(), kind, time.Now()); err != nil {
			log.Fatal(err)
		}
		log.Printf("marked %s collection complete", kind)
	}
}
