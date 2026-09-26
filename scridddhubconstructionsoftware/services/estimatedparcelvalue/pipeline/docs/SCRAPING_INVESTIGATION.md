# Residential land collection investigation

Technical summary, updated 22 September 2026. Dated raw evidence remains in the
source-specific exploration and pilot directories.

| Source | Observed technical result |
|---|---|
| MagicBricks | Installed Chrome with Playwright and a visible window collected 889 observations, 574 source IDs. Thane page 2 and Shahad navigation returned 404; Khadakpada coverage unresolved. |
| NoBroker | Khadakpada search yielded three direct and seven nearby cards; three direct details captured. Locality, geometry, dates and parcel identity still need review. |
| 99acres | HTTP 403 response; no listings captured. |
| Housing.com | HTTP 200 challenge response rather than listing data. |
| Square Yards | Historical browser request returned HTTP 403; no normalized listings. |
| MahaRERA | Maharashtra/Thane project-search samples including Kalyan; no established plot-price dataset. |

A successful browser configuration is an observation, not proof of why another
configuration failed. HTTP 200 alone does not establish usable listing content.

Run production scripts from `pipeline/`. The sibling-imported collector, audit,
ML and test scripts remain together in `magicbricks/`. Exploratory scripts are in
`exploration/<source>/`; original data directories remain unchanged.

Keep collection sequential and bounded. Save source URL, timestamps, raw
responses, listing IDs and outcomes. Distinguish direct results from nearby
recommendations. Preserve source-qualified identities, explicit units, missing
values and unresolved locality; do not treat repeat ads as independent parcels.
