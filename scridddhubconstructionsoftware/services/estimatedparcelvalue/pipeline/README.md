# estimatedparcelvalue data pipeline

Reorganized 2026-09-21 (see `codex/PIPELINE_REORGANIZATION_BY_CLAUDE_20260921.md`
in the repo root for the full before/after and why). Nothing was renamed —
only moved — so every import and data path still resolves to the exact same
files as before.

## Layout

- `magicbricks/`: collector, audit, cleaning, baseline, ML and tests; sibling imports require keeping these together.
- `exploration/<source>/`: exploratory scripts and saved diagnostic evidence.
- `docs/`: technical investigation notes.
- `magicbricks_mmr_data/`: observations, raw evidence and derived datasets.
- `residential_land_pilots/`: additional-source pilot evidence.
- `ml_experiments/`: research models, predictions and metrics.
- `raw_data/`: Maharashtra geography snapshots.
- `.venv/`: local Python environment.

## Running anything here

**Always run from this directory (`pipeline/`), not from a subfolder** — the
data paths are resolved relative to this root:

```bash
cd services/estimatedparcelvalue/pipeline
source .venv/Scripts/activate   # or .venv/bin/activate
python magicbricks/magicbricks_residential_plot_crawler.py --market kalyan
python magicbricks/test_clean_land_data.py   # runs standalone, no pytest needed
```

## Why one flat `magicbricks/` package instead of further splitting it

The collector, batch runner, audit, cleaning, baseline, and ML-experiment
scripts all import each other directly by module name (e.g.
`import magicbricks_residential_plot_crawler as crawler`,
`from build_clean_land_data import clean`). Python resolves these via the
importing script's own directory, so splitting this cluster further (e.g.
`collectors/` vs `processing/` vs `ml/`) would require converting every one
of these to proper package-relative imports and changing how each script is
invoked (`python -m package.module` instead of `python script.py`) — real
churn for a codebase this size, without a real payoff yet. Revisit this if
the pipeline grows enough that "everything imports everything" stops
scaling; for now, the meaningful, low-risk win was separating **production**
from **throwaway exploration** and giving data its own clearly-named homes,
which this reorganization does.
