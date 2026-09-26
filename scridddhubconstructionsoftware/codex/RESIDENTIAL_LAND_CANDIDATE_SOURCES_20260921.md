# Residential land candidate sources

Updated 22 September 2026. Target: Khadakpada/Kalyan residential plots.

| Site | Technical findings | Dataset contribution |
|---|---|---|
| RealEstateIndia | Earlier HTTP 429; current listing extraction untested. | None |
| CommonFloor | Listing extraction untested. | None |
| PropertyWala | Listing extraction untested. Public developer API describes listing submission and account functions, not a verified price feed. | None |
| 360plot | Homepage available in web research; target-locality listing extraction untested. | None |
| Reeltor | Maharashtra navigation returned regional context. Listing-link check was inconclusive. | None |
| 1acre.in | Paid GIS/geospatial API: potential feature data, not an established listing-price feed. | None |

Next technical work: discover published target-locality routes, capture small
sequential samples, preserve timestamps and evidence, verify price/area units,
resolve locality, and screen duplicates before model integration. No candidate
above has supplied a reviewed training observation.
