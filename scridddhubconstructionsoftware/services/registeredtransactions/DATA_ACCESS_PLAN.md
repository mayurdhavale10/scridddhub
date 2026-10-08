# Getting real sale data: plan, research and RTI draft

Written 2026-10-01. The Nearby Registered Transactions feature is built (see [README.md](README.md))
but has no sales loaded. This is how we get real data in, what each route costs, and who does
what.

## Routes, best first

| # | Route | Who | Status |
|---|---|---|---|
| 1 | **Assisted IGR search in the app.** A team member opens the official E-Display search inside the app, picks the village and year, and types the captcha themselves. The app reads the results that person retrieved and saves them as sales. | Build: Claude. Searches: the team | Next to build. Needs one real results page from the owner to build the reader. |
| 2 | **RTI request to IGR** for registered sale data of the Kalyan sub-registrar offices | Owner submits (draft below) | Ready to file |
| 3 | **Licensed data provider** | Owner decides and contracts | Research below |
| 4 | **Index-II copies** from users, brokers and advocates, read by the app | Build: Claude. Copies: owner and partners | Import tool exists (`cmd/transaction_import`); needs 1–2 real copies to test a PDF reader |
| 5 | CIDCO / MIDC tender results | — | Low yield, not now (research below) |

## Research (2026-10-01)

### Licensed providers
- **PropEquity** (listed on NSE SME). Over 6 million registration records across 13 years,
  covering Mumbai, **Thane**, Navi Mumbai, Pune, NCR, Chennai, Hyderabad and Bengaluru. Its
  focus is residential and commercial, so its land-parcel coverage needs to be asked about.
  [Investor presentation](https://archives.nseindia.com/corporate/PROPEQUITY_31072023123842_InvestorPresentationQ1202324.pdf),
  [annual report 2024–25](https://archives.nseindia.com/annual_reports/SME_AR_27885_PROPEQUITY_2024_2025_A_14626605_29082025171712.pdf).
- **Square Yards.** Its data intelligence platform has digitised over 100 million property
  registration records, including Maharashtra, and is working with the RBI Innovation Hub on
  e-valuation.
  [News](https://therealtytoday.com/news/technology/square-yards-teams-up-with-rbi-innovation-hub-to-digitise-100m-property-records-enable-e-valuation-title-services/).
- **Zapkey.** Built on over 30 lakh Maharashtra registration records, but it now runs its own
  home-sales platform; no public data API was found.
  [Profile](https://app.dealroom.co/companies/zapkey).
- **Ask each provider:** coverage of land and plot sales (not just flats) in Kalyan, Thane and
  Raigad villages; whether records carry survey number and area; latitude/longitude or village
  codes; update frequency; API or file delivery; price; and whether we may show individual
  sales to our users.

### CIDCO / MIDC
- CIDCO publishes plot tenders (for example, 12 logistics-park plots in Pushpak Node, 2026, base
  rate ₹24,711 per sq m), but the **winning prices appear mainly in news**
  ([Sanpada plot ₹5.54 lakh/sq m](https://www.freepressjournal.in/mumbai/cidco-windfall-sanpada-plot-fetches-rs554-lsq-m)),
  not as structured result pages.
- MIDC publishes tender documents with upset (starting) rates, not final prices
  ([example](https://midcindia.org/wp-content/uploads/2025/04/MIDC_Public-NoticeNo.MIDC-MahaTenders-2025-01.pdf)).
- Verdict: a few Navi Mumbai and MIDC data points at best. Not worth building before routes 1–2.

## RTI application (owner to submit)

**Where:** online at **https://rtionline.maharashtra.gov.in**. Choose the Revenue and Forest
Department, then the public authority **Inspector General of Registration and Controller of
Stamps** (or the **Joint District Registrar, Thane**, which covers the Kalyan offices). The fee
is ₹10, paid online via SBI e-Pay. Indian citizens only. A reply is due within 30 days. If it
doesn't come or is refused, a first appeal can be filed on the same portal within 30 days.

**Text to paste:**

> Subject: Information under Section 6(1) of the RTI Act, 2005: registered sale deeds,
> Sub-Registrar offices Kalyan 1 to 5, Thane district
>
> Please provide the following information for all documents registered as **sale deeds /
> conveyance** in the offices of the **Sub-Registrar, Kalyan 1, 2, 3, 4 and 5 (Thane district)**
> between **1 October 2025 and 30 September 2026**:
>
> 1. Document number and year
> 2. Date of registration
> 3. Name of the Sub-Registrar office
> 4. Village / mouje
> 5. Survey number / gat number / CTS number
> 6. Area of the property, with its unit
> 7. Type of property (land, plot, flat, shop or other), as recorded
> 8. Consideration amount stated in the document
> 9. Market value determined for stamp duty
>
> I am **not** asking for the names, addresses, PAN or any other personal details of the parties.
> Please exclude those.
>
> As this information is maintained electronically in the department's registration system,
> I request it under Section 7(9) in electronic form (CSV or Excel spreadsheet) on CD/DVD or by
> e-mail. If any part is not held in this form, please provide it in the form in which it is held
> and tell me any additional fees payable.
>
> If this information is held by another public authority, please transfer this application
> under Section 6(3) and inform me.

**Why it's worded this way:**
- Asking only for non-personal fields avoids the usual refusal ground for third-party personal
  information (Section 8(1)(j)).
- Asking for electronic form matters because a printed copy of a year of deeds would be thousands
  of pages.
- If Kalyan works, the same request can be repeated for other offices (Thane, Bhiwandi, Panvel
  and so on).

## What the owner needs to do

1. **Submit the RTI** above on rtionline.maharashtra.gov.in.
2. **Do one IGR search by hand** on the official
   [E-Display page](https://pay2igr.igrmaharashtra.gov.in/eDisplay/Propertydetails/index): Thane
   district, Kalyan taluka, one village, year 2026. Save the results page (browser: Save page
   as, "Webpage, complete") and send it, so the app's reader is built against the real format.
3. **Share 1–2 real Index-II copies** (PDF or photo) if you have any, to test the Index-II
   reader.
4. **Decide on providers:** contact PropEquity and Square Yards with the questions above if you
   want complete coverage sooner.
