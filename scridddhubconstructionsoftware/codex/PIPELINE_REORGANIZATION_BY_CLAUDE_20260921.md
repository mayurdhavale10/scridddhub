# Pipeline directory reorganization — done by Claude (2026-09-21)

## Why

`services/estimatedparcelvalue/pipeline/` had accumulated into a single flat
directory: 14 production/processing/ML/test scripts, 13 one-off throwaway
exploration scripts (99acres/Housing.com/MagicBricks/MahaRERA/NoBroker/
SquareYards recon), their saved evidence files (HTML/PNG/JSON dumps sitting
loose at the top level), a scraping-investigation doc, and four separate
data directories — all as siblings with no separation between "code you'd
actually run in production" and "one-off scripts kept only for provenance."
This made it hard to tell at a glance what was safe to run, what was
historical record, and what was live data.

**No files were renamed** — only moved — specifically to minimize churn
against Codex's in-flight work and the existing `codex/*.md` docs that
already reference these files by path.

## What changed

| Before (flat, pipeline root) | After |
|---|---|
| `magicbricks_residential_plot_crawler.py`, `collect_magicbricks_markets.py`, `audit_magicbricks_data.py`, `build_clean_land_data.py`, `probe_collection_gaps.py`, `review_land_baseline.py`, `run_land_ml_experiment.py`, `review_khadakpada_pilot.py`, `check_khadakpada_source.py`, `sample_full_record.json`, `test_*.py` (4 files) | `magicbricks/` — kept together in one flat package (see "why one folder" below) |
| `explore_magicbricks*.py` + their saved evidence (`sample_listing.json`, `seo_*.json/html/png`, `homepage.png`, etc.) | `exploration/magicbricks/` |
| `explore_maharera*.py`, `maharera_diagnostic.py` + saved evidence + `maharera_diagnostic/` output dir + `diagnostic_console_output.txt` | `exploration/maharera/` |
| `explore_nobroker*.py` + saved evidence | `exploration/nobroker/` |
| `explore_squareyards.py` + saved evidence | `exploration/squareyards/` |
| `SCRAPING_INVESTIGATION.md` | `docs/SCRAPING_INVESTIGATION.md` |
| `magicbricks_mmr_data/`, `residential_land_pilots/`, `ml_experiments/`, `raw_data/` | **Unchanged, left exactly where they were** — moving live data risked silently breaking hardcoded relative paths across many scripts for comparatively low benefit, since these were already reasonably distinct, clearly-named folders |

## Why `magicbricks/` is one flat folder, not split further

The production/processing/ML cluster sibling-imports itself directly
(`import magicbricks_residential_plot_crawler as crawler`,
`from build_clean_land_data import clean`, etc.) — Python resolves these
against the importing script's own directory, not a package root. Splitting
this cluster further (e.g. separate `collectors/` / `processing/` / `ml/`
folders) would require converting every import to a proper relative-package
form and changing the run convention from `python script.py` to
`python -m package.module` throughout — real churn without a real payoff at
this codebase size. Kept them together as the pragmatic choice; worth
revisiting if this cluster keeps growing.

## What had to be fixed for the move to be safe

Four files compute their data-directory root from their own file location
(`ROOT = Path(__file__).resolve().parent`), which would have pointed one
level too deep after moving one directory down. Fixed by adding one more
`.parent` in each:
- `magicbricks/build_clean_land_data.py` (`DEFAULT_DATA`)
- `magicbricks/probe_collection_gaps.py` (`ROOT`)
- `magicbricks/review_khadakpada_pilot.py` (`ROOT`)
- `magicbricks/run_land_ml_experiment.py` (`ROOT`)

The main collector (`magicbricks_residential_plot_crawler.py`) uses a
cwd-relative path (`Path("magicbricks_mmr_data")`, no `__file__`), which
needed no code change — it resolves correctly as long as everything is still
invoked with the working directory set to `pipeline/` (already the existing
convention throughout this project, now stated explicitly in the new
`pipeline/README.md`).

One stale comment (a path reference to `sample_full_record.json`) was also
updated to match its new location. It was a comment, not code — no
functional effect either way.

## Verification performed before calling this done

- `py_compile` on every moved `.py` file (production + all four exploration
  subfolders) — clean, no syntax/import errors.
- Ran all four test files directly (the same way they were already being
  run, `python magicbricks/test_*.py`, no `pytest` needed): **26/26 tests
  pass** across `test_clean_land_data.py` (9), `test_khadakpada_pilot.py`
  (4), `test_land_ml_experiment.py` (5), `test_review_land_baseline.py` (8).
- Explicitly imported the four `ROOT`-fixed modules plus the crawler and
  confirmed every data-path constant (`DEFAULT_DATA`, `ROOT / "magicbricks_mmr_data"`,
  crawler's `OUT_DIR`) resolves to the real, existing data — not a fresh
  empty folder — confirming no silent data-path breakage.
- Cross-checked every `codex/*.md` document for stale path references and
  fixed all 7 found, across `RESIDENTIAL_LAND_AVM_ROADMAP.md`,
  `RESIDENTIAL_LAND_NEXT_STEPS_PLAN.md`, `RESIDENTIAL_LAND_BASELINE_REVIEW_20260920.md`,
  and `RESIDENTIAL_LAND_SCRAPING_STATUS_20260920.md`.

## What this does NOT do

This is a filesystem/import-hygiene cleanup, not a move toward microservices
or a rewrite of anything's logic. Recommended reading before considering
microservices for this project at all: a monolith with clear internal
module boundaries is the right shape at this stage — splitting services
prematurely adds real operational cost (service discovery, inter-service
auth, distributed debugging) that only pays off at a scale/team-size this
project isn't at yet. If `magicbricks/`'s sibling-import style becomes a
real constraint as the pipeline grows, that's the next thing worth revisiting
— not a service split.
