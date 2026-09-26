# Khadakpada source pilot — 21 September 2026

## Locality definition

Target: Khadakpada in Kalyan, Maharashtra, as specified in the 21 September plan. Normalize case and whitespace in `Khadakpada`; `Khadak Pada` and `Khadak-pada` are spelling candidates for review, not independently verified aliases. Do not equate all of Kalyan, Kalyan West, Gandhar Nagar, Shahad, Godrej Hill or nearby recommendations with the target.

Keep the requested market, source address/locality, portal search locality and independently resolved locality separate. No administrative boundary or parcel boundary was obtained in this run. `resolved_locality` remains null. The portal's `mumbai` city field is its own broad market label; retain it without silently replacing it with Kalyan.

The captured search and detail addresses explicitly name Khadakpada for two direct results. The third names Gandhar Nagar while its portal classification says Khadakpada: preserve the disagreement. Two pins are explicitly labelled LANDMARK in source attributes despite `accurateLocation=true`; the third is unverified. None supports parcel-distance features.

Independent geographic discovery leads were the Maharashtra election counting-centre list (Khadakpada/Kalyan West) and an MMRDA corridor document. Both full-document retrievals failed in the research tool; search snippets are not accepted as boundary verification:

- https://ceoelection.maharashtra.gov.in/Downloads/AC2019/AC2019CountingCentres.pdf
- https://www.mmrda.maharashtra.gov.in/sites/default/files/2026-05/extended_metro_line_5_to_strengthen_connectivity_across_thane_bhiwandi_kalyan_and_ulhasnagar.pdf

Earlier NoBroker exploration did not extract HTML listing content. This pilot used the following published exact-locality route:

https://www.nobroker.in/residential-land-plots-for-sale-in-khadakpada_mumbai

Discovery query on 21 September: `site:nobroker.in residential land plots Khadakpada Kalyan`. Search results were used only for route discovery. All diagnostic listing values come from directly captured HTML, not search snippets.

## Limits and stop conditions

Minimum export fields: source and listing ID, observation date, plot address/locality, total asking price/currency, area and explicit unit, property category, project, and available ownership/date/coordinate evidence. Include coordinate precision, listing-history semantics, duplicate/parcel references and source provenance where available; leave missing fields explicit.
