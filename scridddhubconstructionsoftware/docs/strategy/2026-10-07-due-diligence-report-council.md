# Parcel Due-Diligence Report: price, data and value (council, 2026-10-07)

**Questions (owner):**
1. Where did the report prices come from?
2. Can a real parcel's report be filled without "not found"?
3. Why would builders pay?

**Method:** three independent researchers (pricing, data sources, skeptic), each citing sources.
This is not legal advice.

## 1. Price: not decided, hidden in the app

- **Where the old numbers came from.**
  - The ₹7,500 and ₹35,000 were placeholders chosen while wireframing, not researched.
  - The 2026-10-02 council's "₹25–50k" had no source.
  - The app now shows no prices. The owner will set them after showing the report to clients.
- **Sourced price points:**

| What | Price | Source |
|---|---|---|
| Landeed raw documents (8A / deeds) | from ₹199 / ₹599 | [Landeed](https://web.landeed.com/maharashtra/eight-a-8a) |
| Bank of Maharashtra panel advocate, title search | ₹2–5k; project ₹15–25k | [BoM circular, Nov 2024](https://bankofmaharashtra.bank.in/writereaddata/documentlibrary/9f603210-420b-4eac-b710-34b4213c4df2.pdf) |
| Canara Bank legal scrutiny + NEC | ₹6–9k per property | [Canara](https://www.canarabank.bank.in/documents/d/guest/9-advocate-fee-schedule-7122) |
| ezyLegal Maharashtra document verification | from ₹6–9k | [ezyLegal](https://www.ezylegal.in/blogs/online-property-paper-verification-lawyer-in-maharashtra) |
| Mumbai advocate, 25–30 year title report (flat) | ₹30–75k | [LawRato](https://lawrato.com/documentation-legal-advice/cost-of-title-report-report-in-mulund-132456) |
| Agricultural land, complex chain / commercial due diligence | ₹50k–2 lakh / ₹50k–3 lakh+ | blogs, no source given |
| Landeed property report, NoBroker, LegalKart | no public price | — |
| Builder spend on diligence as % of deal | **no source found** | — |

- **What the pricing member suggests testing (not final):**
  - **Quick Screen:** ₹7.5–15k per parcel, or about ₹50k for a 5-parcel pack.
  - **Full Report:** ₹75k–1.5 lakh for up to about 3 survey numbers, plus a fee for each extra survey number. Keep at least a 40% margin over the advocate's fee.
  - **Credit the Quick Screen toward the Full Report** for the same parcel.
- **How to test with clients:**
  - Show three price cards in a different order for different clients.
  - Ask the four Van Westendorp questions (at what price it's too cheap to trust, a bargain, getting expensive, too expensive).
  - Ask what they last paid their advocate, and for how many survey numbers.
  - Ask for a deposit on a pilot. A deposit is the real test; a verbal "interested" isn't.

## 2. Filling a real parcel's report

- **No government land source can be read automatically and lawfully.** The 7/12, Ferfar,
  Index-II, eCourts and CERSAI all sit behind a captcha or a login. There are two lawful routes:
  - **a person on our team** fetches them (a signed 7/12 costs ₹15 and takes minutes);
  - **a vendor**: Landeed sells documents and has an API; TEAL sells to banks. Get written
    confirmation of how they source the data before signing with either.
- **The key change:** make **survey/gat number, village and taluka mandatory at order time.**
  With them, the team fetches the 7/12. That fills owner names, occupancy class, tenancy remarks
  and charges.

| Section | Quick Screen (no lawyer) | Full Report (we fetch it, so there are no blanks) | Builder gives at order |
|---|---|---|---|
| Identity | pin, area, price, Bhunaksha outline | signed 7/12 + 8A, measurement if disputed | **survey no., village, taluka** |
| Title | owners + class read from the 7/12 | Ferfar, Index-II chain, advocate's 30-year search | seller name, deeds if any |
| Tenure / NA / tenancy | as written on the 7/12, labelled "as recorded" | advocate's opinion (Class II, NA under the Dec 2025 amendment) | NA order or sanad if any |
| Encumbrance / litigation | charges on the 7/12 | CERSAI, eCourts + High Court on every owner | all co-owner names |
| Zoning / FSI | DP/RP zone where a map layer exists; FSI **band** only | zone certificate + architect's FSI working | road width (optional) |
| Environment | CRZ / ESZ map overlay, labelled "map-based" | MCZMA / forest-department check near a boundary | — |
| Infra / acquisition | our infra pipeline + acquisition note on the 7/12 | gazette and district-notice check for the village | — |
| Valuation / RERA | our valuation + MahaRERA (already automatic) | + ready-reckoner rate | — |

- **Notes on specific items:**
  - **NA:** the Dec 2025 Second Amendment Act scrapped separate NA permission where the use
    matches the DP or Regional Plan; a one-time premium of 0.1–0.5% applies instead
    ([K S & K](https://ksandk.com/newsletter/a-legal-analysis-of-the-maharashtra-land-revenue-code-second-amendment-act-2025/)).
  - **FSI** under UDCPR depends on road width, which can't be read reliably from maps. Show a
    band; an architect confirms the number.

## 3. Why builders would pay (skeptic)

- **Not for the title search itself.** Their own advocate already does it and they trust them.
- **Pay for what an advocate doesn't do:**
  - screening many parcels fast;
  - checking papers against the official record (forged permissions, Pune 2026;
    [FPJ](https://www.freepressjournal.in/pune/pune-crime-19-booked-for-using-fake-pmrda-pmc-documents-to-register-22-sale-deeds));
  - DP reservation and FSI;
  - the seller's or JV partner's MahaRERA record.
- **Pitch:** a second opinion and screening layer next to their advocate.
- **Gaps must not be hidden.** That is how a land report gets sued. Write each gap like a US
  title commitment's "requirements": what's not yet checked, what we'll fetch, from which office,
  and by when. The Full Report closes them before it's signed.
  - A search we ran that found nothing (for example no court case) is a finding, not a gap.
- **Risks and cheapest tests:**

| Risk | Test |
|---|---|
| Bar Council rules on fee-sharing and solicitation; our liability for an AI-drafted verdict | a few hours with a Maharashtra lawyer **before the first paid report** |
| Accuracy of DP/FSI flags | 10 parcels with known outcomes; if more than 1 in 10 flags is wrong, it's not ready |
| Willingness to pay | 5 land heads, asked for money upfront |
| Advocate supply | one advocate delivers one paid Full Report on time |
