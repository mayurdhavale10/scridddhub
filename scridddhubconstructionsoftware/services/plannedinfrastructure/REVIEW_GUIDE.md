# Reviewing pipeline projects — step by step

The pipeline (`cmd/infra_pipeline`) reads official agency pages and saves each project as
**pending**. Pending projects are hidden in the app. A person checks each one and **approves**
(shown in the app), **rejects** (stays hidden), or **fixes and approves**. This guide is that
check, in small steps. Until the review screen (PIPELINE_PLAN.md phase 3) exists, it's done with
the `infra_review` command.

## 0. Before you start (once per session)

1. Start Docker Desktop and wait until `docker ps` works.
2. From `scridddhubconstructionsoftware/`: `docker compose up -d postgres`
3. `cd backend`

All commands below are run from `backend/`.

## 1. See what's waiting

```bash
go run ./cmd/infra_review list
```

For each project you'll see: its **key** (e.g. `mmrda:metro line 4` — you'll type this in the
commands below), name, status, how many points it has, the **source** link, a short summary, and
the exact sentences from the page that back up the name, status and length.

## 2. For ONE project, check the facts (≈2 min)

1. Open the **source** link in a browser.
2. Is the page really about this project? (name matches)
3. Does the **status** match what the page says? ("95% completed" → in progress; "opened for
   public use" → already open)
4. **Is the page out of date?** Government pages are often not updated. If you know the project
   has actually opened but the page still says "planned", don't approve it as planned —
   reject it, or leave it pending and note why.
5. Length / route roughly match the summary? Small differences are fine.

If the facts are wrong → **reject** (step 5). If fine → continue.

## 3. For the same project, check the locations (≈3 min)

```bash
go run ./cmd/infra_review points "mmrda:metro line 4"
```

This lists every point, south to north, like:

```
  Wadala TT        19.03800,72.88000  [station, approximate]
  Pant Nagar       19.08300,72.91200  [station, approximate]
```

1. Copy a point's `19.03800,72.88000` and paste it into Google Maps search.
2. Is the pin near that station / place? **Within ~1 km is fine** — "approximate" points are
   usually a neighbourhood centre, not the station entrance.
3. Look at the whole list: points on one line should move steadily along its route. **A point
   far from all the others is almost always wrong** — the geocoder found a different place
   with the same name (e.g. Thane's "Anand Nagar" instead of the one in Dahisar).
4. Remove each wrong point:

```bash
go run ./cmd/infra_review drop-point "mmrda:metro line 2a" "Anand Nagar"
```

Use the label exactly as `points` printed it (keep the quotes).

5. After removing, are there still enough points to be useful? A long line with only its two
   end points will show misleading distances for places in the middle — better to leave it
   pending until it has proper points.

## 4. Decide

| Situation | Do |
|---|---|
| Facts right, points look right (after removing bad ones) | approve |
| Page out of date, project isn't real/relevant, or points unusable | reject |
| Not sure / needs better points / needs a status fix | leave it pending (do nothing) |

## 5. Record the decision

```bash
go run ./cmd/infra_review approve "mmrda:metro line 4" --by "Mayur Dhavale"
go run ./cmd/infra_review reject  "mmrda:sahar elevated road" --by "Mayur Dhavale"
```

`--by` records who reviewed it and when (internal only — never shown in the app).
Changed your mind? `go run ./cmd/infra_review reopen "<key>" --by "Mayur Dhavale"` puts it back
to pending (hidden).

## 6. Check it in the app

Approved projects show on the Compare screen for parcels within 10 km of their points. To see
what's approved: `go run ./cmd/infra_review list --status approved`.

## Things the pipeline will and won't touch afterwards

- Approved projects never go back to pending on their own, and only points from an **official
  map file** can replace their points — a later run can't sneak geocoded guesses into them.
- Points you removed from an approved project stay removed.
- Pending projects can get new points on the next run (review them again then).

---

## Review log

### 2026-09-27 — MMRDA, first batch (Claude, at Mayur's request)

Recorded as `verified_by = "Claude review 2026-09-27 (requested by Mayur Dhavale)"`. Any
decision can be undone with `reopen`.

**Wrong points removed** (same-named places elsewhere, far from the rest of the line):
Line 2A "Anand Nagar" (Thane, 72.968); Line 2B "MTNL Metro" (Borivali, 19.221) and
"Indira Nagar" (Dharavi/Sion, 19.036); Line 9 "Sai Baba Nagar" (Borivali, 19.217);
MTHL Metro Link "Siddhivinayak" (Bandra, 19.059).

**Approved (10):** Metro Lines 1, 2A, 2B, 4, 4A, 6, 9; Mumbai Monorail; MTHL Metro Link; Orange
Gate–Marine Drive Tunnel. Note: Line 4 only has points on its Mumbai stretch (Wadala–Ghatkopar
East); its Thane stations are missing, so Thane parcels won't match it by distance yet.

**Rejected (3)** — MMRDA's page still calls them planned/proposed, but to my knowledge they're
already open (verify): Sahar Elevated Road (~2014), Extension of Harbour Line to Goregaon
(~2018), Thane–Diva additional lines (~2022; also had a wrong "Thane" point).

**Left pending (4) — for you:**
- Metro Line 7: good points, but the page states no status, so it would show "Planned / in
  progress"; to my knowledge it has been open since 2023. Needs a status correction.
- Atal Setu (MTHL): its points are meaningless ("Mumbai", "Raigad" placed inside Mumbai). Needs
  real points (bridge ends at Sewri and Nhava Sheva) before approval.
- Kurla–CST 5th/6th lines, Borivali–Mumbai Central 6th line: only two end points each on long
  routes — distances would mislead mid-route.

### 2026-09-29 — MSRDC, NHSRCL and area-search results (Claude, at Mayur's request)

Recorded as `verified_by = "Claude review 2026-09-29 (requested by Mayur Dhavale)"`. From the
first successful scheduled run (00:54) plus a re-run of MSRDC's project list. 32 pending before.

**Wrong points removed** (out-of-region names placed on same-named streets/buildings in Mumbai, or
a road's name placed at its far end):
- Bullet train: Sabarmati, Ahmedabad, Anand, Vadodara (all Gujarat) — each put inside Mumbai.
- JVLR and Suman Nagar flyover: "Eastern Express Highway" at 18.94 (CST end, ~20 km off).
- Suman Nagar flyover: "V N Purav Marg" at its Mankhurd end.
- NH 166D: "Alibag", "Raigad" (Raigad placed at 19.147 in Mumbai).
- Samruddhi and Nagpur IRDP: "Mumbai" (city centroid).
- Nagpur–Mumbai road: "Karanja" (Uran, not Washim) and "Amravati" (in Mumbai).
- Both pipelines: "Kune" (near Lonavala, not the Pen/Alibag village).

Root cause fixed the same day in `locate/`.

**Approved (7):**
- Mumbai–Ahmedabad bullet train: BKC and Virar points only for now; Thane and Boisar weren't
  located.
- Mumbai–Pune Missing Link: Khopoli exit, Adoshi tunnel, Khandala exit, Khalapur toll.
- Versova–Bandra Sea Link.
- Mumbai–Pune Expressway: operational.
- JVLR: operational; west end point only.
- Panvel–Karjat rail doubling.
- NH-4B/NH-348 widening around NMIA/JNPT.

**Rejected (18)** — undo with `reopen`:
- Old flyovers and bridges whose own page dates them 2008–2012 but states no status, so they
  would show as "Planned / in progress":
  - Dindoshi (two entries), Burfiwala (Andheri), Santacruz airport, Malad (Times of India),
    Thakur Complex (Kandivali).
  - Kanjurmarg ROB (page says "under construction, 2008").
  - Panvel flyover (2012).
- Suman Nagar flyover: open since 2011, but no reliable point.
- 50 Flyovers programme: a city-wide programme; its points were just road and area names.
- Outside the Mumbai region or no point at all: Kolhapur, Amravati and Nagpur road programmes;
  ROB on LC 90C; ROB on diversion road; Nagpur–Aurangabad–Sinnar–Ghoti–Mumbai road.
- Uran–Usar propane pipeline and MIDC 700 mm pipeline: we have no pipeline kind yet (they'd show
  under Connectivity). Revisit as "pipeline corridor" in Planning & zoning.

**Left pending (7) — for you:**
- Metro Line 7, Atal Setu, Kurla–CST 5th/6th, Borivali–Mumbai Central 6th: same reasons as
  2026-09-27 (Atal Setu now has only a "Navi Mumbai" centroid point).
- Samruddhi Expressway: relevant (its Mumbai end is at Amane, Bhiwandi), but no reliable point.
- NH 166D Pen–Khopoli: real, but needs Pen and Khopoli points.
- Bandra–Worli Sea Link: page states no status, so it would show "Planned / in progress";
  open since 2009. Needs a status correction.

**Fixes the same day, with evidence (new `set-status` and `add-point` commands):**
- Metro Line 7: status set to **operational**, citing MMRDA's own page: "5.8 km with 4 stations
  (Gundavali, Mogra, Jogeshwari(East), Goregaon(East)) is operational from 19th January, 2023."
  The extractor had missed that line. Now **approved**.
- Atal Setu: points **Sewri** and **Nhavasheva** (looked up as "Nhava"), both named in the page
  title "SEWRI – NHAVASHEVA ATAL SETU (MTHL)"; the "Navi Mumbai" centroid removed. Now **approved**.
- NH 166D: points **Pen** and **Khopoli**, from "Pen Khopoli KM 00+000 to KM 33+328". Now
  **approved**.
- Bullet train: **Boisar** station added (named on NHSRCL's overview).
- A made-up quote for Bandra–Worli was refused by `set-status`, as it should be.

**Still pending (4), because no official page supports a fix:**
- Bandra–Worli Sea Link: MSRDC's page never says it opened.
- Samruddhi Expressway: MSRDC's page names neither its Mumbai end nor a status.
- Kurla–CST 5th/6th and Borivali–Mumbai Central 6th: the page lists no stations in between.
