# Nearby Registered Transactions: getting real sale data (parked 2026-10-01)

**Where it stands:** the feature is built (storage, import tool, API, Compare section; see
`services/registeredtransactions/README.md`) but has **no sales loaded**. Each parcel shows "No
registered land sales on record within 3 km yet." Full plan, research and the RTI text:
`services/registeredtransactions/DATA_ACCESS_PLAN.md`.

## Owner (needs you)
- [ ] **Submit the RTI** on https://rtionline.maharashtra.gov.in (₹10). The text is ready in
      DATA_ACCESS_PLAN.md: sale deeds from the Kalyan 1–5 sub-registrar offices, Oct 2025 – Sep 2026,
      as a spreadsheet, without party names.
- [ ] **Do one IGR search by hand** on
      https://pay2igr.igrmaharashtra.gov.in/eDisplay/Propertydetails/index (Thane → Kalyan → one
      village → 2026). Save the results page ("Save page as → Webpage, complete") and send it.
- [ ] **Share 1–2 real Index-II copies** (PDF or photo), if available.
- [ ] **Decide whether to contact data providers** (PropEquity, Square Yards). The questions to ask
      are in DATA_ACCESS_PLAN.md.

## Claude (can do without you)
- [ ] **Assisted IGR search screen:** an admin "Collect sales" screen that opens the official
      search in a WebView. A team member types the captcha; a button saves the retrieved results
      page as raw evidence (`transaction_source_records`).
- [ ] **Results reader:** turns a saved results page into `registered_transactions` rows. Needs
      the owner's saved page first.
- [ ] **Index-II reader:** upload a PDF or photo in the app and read it into a sale record. Needs
      a real copy to test against.
- [ ] **Load the RTI spreadsheet** through `cmd/transaction_import` when it arrives.

## Not doing (and why)
- **Captcha bypass or solver services:** declined.
- **CIDCO/MIDC tender crawler:** winning prices appear mostly in news, not structured result pages;
  too few points to be worth it now.
