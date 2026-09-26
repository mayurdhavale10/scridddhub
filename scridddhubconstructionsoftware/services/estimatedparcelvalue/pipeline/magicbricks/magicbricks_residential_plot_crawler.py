"""
MagicBricks residential-plot collector — ONE market per invocation.

PURPOSE
-------
Collector for ONE land category — residential buildable/vacant plots
(MagicBricks' own "Residential Plot" label, confirmed via a real sample: see
seo_state.json, 30/30 records tagged "Residential Plot") — one MMR market at
a time, by explicit operator choice. Deliberately residential-only for V1:
agricultural/commercial/industrial land are different price regimes and need
separate datasets/models later; a location alone does not define a single
land price without a land-use dimension.

USAGE
-----
    python magicbricks_residential_plot_crawler.py --market kalyan
    python magicbricks_residential_plot_crawler.py --market dombivli

Compare one page in installed Chrome (fresh session, no pagination or dataset writes):
    python magicbricks_residential_plot_crawler.py --market kalyan --browser chrome --headed --diagnose

Deliberately NOT a "loop through all markets automatically" tool. Run it once
per market, manually, whenever you choose — that keeps traffic low-impact
and city-by-city, gives a clean per-market picture of what was collected,
and avoids generating a large request burst in one process. See MARKETS
below for every slug that's been verified (HTTP 200) so far; --market only
accepts one of these, not an arbitrary/guessed string.

Every market slug in MARKETS was verified with a live HTTP status check
before being added — none are guessed. Agricultural and commercial land use
a DIFFERENT MagicBricks URL pattern that was checked and found to be
state-level only (not per-city) for agricultural, and unconfirmed for
commercial — those are out of scope for this file; do not extend MARKETS
with a guessed URL pattern without checking it first (curl the URL, confirm
200, same as every source in SCRAPING_INVESTIGATION.md was checked by hand).

This collector saves timestamped raw evidence and crawl progress, uses sequential
pages with pacing, and distinguishes HTTP failures from successful listing pages.
"""

import argparse
import json
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

from playwright.sync_api import (
    sync_playwright,
    TimeoutError as PlaywrightTimeoutError,
)


DOMAIN = "https://www.magicbricks.com"
URL_TEMPLATE = DOMAIN + "/residential-plots-land-for-sale-in-{slug}-pppfs"

# Every slug below returned HTTP 200 on a direct check on 2026-09-20 — see
# the curl loops in the conversation this was built from. This list is used
# only to validate --market; the crawler processes exactly one of these per
# invocation, never all of them automatically.
MARKETS = [
    "mumbai", "thane", "navi-mumbai",
    "kalyan", "dombivli", "ulhasnagar", "ambernath", "badlapur", "shahad", "titwala",
    "mira-bhayandar", "vasai", "virar", "naigaon",
    "bhiwandi",
    "panvel", "new-panvel", "taloja", "kharghar",
    "karjat", "neral", "khopoli",
    "palghar", "boisar",
    "alibag", "pen", "uran",
    "shahapur", "asangaon", "vasind", "murbad", "nalasopara",
    "dronagiri", "kalamboli", "kamothe", "rasayani",
]

LAND_CATEGORY = "residential_plot"

# Exact locality routes observed in MagicBricks navigation/search results.
# Keep the requested market separate from the site's URL slug.
MARKET_URL_SLUGS = {
    "dombivli": "dombivli-kalyan",
    "vasai": "vasai-mumbai",
    "virar": "virar-mumbai",
    "panvel": "panvel-navi-mumbai",
    "new-panvel": "new-panvel-navi-mumbai",
    "kharghar": "kharghar-navi-mumbai",
    "khopoli": "khopoli-navi-mumbai",
    "uran": "uran-navi-mumbai",
    "dronagiri": "dronagiri-navi-mumbai",
    "kalamboli": "kalamboli-navi-mumbai",
    "karjat": "karjat-beyond-thane",
    "neral": "neral-beyond-thane",
    "shahapur": "shahapur-beyond-thane",
    "murbad": "murbad-beyond-thane",
    "taloja": "taloja-navi-mumbai",
    "ambernath": "ambernath-beyond-thane",
    "asangaon": "asangaon-beyond-thane",
    "boisar": "boisar-palghar",
    "ulhasnagar": "ulhas-nagar-beyond-thane",
    "titwala": "titwala-beyond-thane",
    "kamothe": "kamothe-navi-mumbai",
    "rasayani": "rasayani-navi-mumbai",
    "vasind": "vasind-beyond-thane",
    "naigaon": "palghar-naigaon-mumbai",
    "nalasopara": "nalasopara-mumbai",
    "mira-bhayandar": "mira-bhayandar-mumbai",
}

# Confirmed real MagicBricks propTypeD value for this URL family (30/30 on a
# real sample). Anything else gets logged to rejected_records.jsonl instead
# of the training dataset — better to under-collect than silently mix in an
# unconfirmed category.
VALID_PROPERTY_CATEGORIES = {"Residential Plot"}

OUT_DIR = Path("magicbricks_mmr_data")
RAW_DIR = OUT_DIR / "raw"

RECORDS_PATH = OUT_DIR / "records.jsonl"
REJECTED_RECORDS_PATH = OUT_DIR / "rejected_records.jsonl"
STATE_PATH = OUT_DIR / "crawl_state.json"
LOG_PATH = OUT_DIR / "crawl.log"

# Conservative fixed pacing between pages of the same market.
REQUEST_INTERVAL_SECONDS = 10

# Prevent accidental runaway crawling within a single market. If a market
# genuinely has more pages than this, it's marked "capped", not "complete" —
# see crawl_market — so a truncated market is never silently mistaken for a
# fully collected one.
MAX_PAGES_PER_MARKET = 25

NAVIGATION_TIMEOUT_MS = 45_000

# A market's run left "in_progress" longer than this is treated as abandoned
# (crashed, machine slept, etc.) rather than resumed — the next invocation
# for the same market starts a fresh run instead of silently comparing
# against stale pagination state.
STALE_RUN_HOURS = 6


# Confirmed real field names from services/estimatedparcelvalue/pipeline/magicbricks/sample_full_record.json
FIELD_MAP = {
    "listing_id": "encId",
    "url": "newUrl",
    "title": "propertyTitle",

    "locality": "scdloc",
    "locality_seo": "locSeoName",
    "city": "ctName",

    "price_rupees": "price",
    "price_display": "priceD",

    "plot_area": "la",
    "plot_area_unit": "landAreaUnitD",
    "price_per_sqft": "sqFtPrice",

    "ownership": "OwnershipTypeD",
    "transaction_type": "transactionTypeD",

    "dimensions": "dimD",
    "road_width": "rdWidth",
    "facing": "facingD",

    "boundary_wall": "boundaryWall",
    "is_corner_plot": "isCornerPlot",

    # Keep category/type, not personally identifying seller name.
    "seller_type": "personType",

    "project_name": "prjname",

    "posted_label": "postedLabelD",
    "posted_date_raw": "postDateT",

    "description": "dtldesc",

    "latitude": "pmtLat",
    "longitude": "pmtLong",

    "source_channel": "pmtSource",
    "property_category": "propTypeD",
}


BLOCK_MARKERS = (
    "security alert",
    "access denied",
    "are you a robot",
    "verify you are human",
    "unusual traffic",
    "temporarily blocked",
    "too many requests",
    "captcha",
)


def utcnow():
    return datetime.now(timezone.utc).isoformat()


def log(message):
    OUT_DIR.mkdir(exist_ok=True)

    line = f"[{utcnow()}] {message}"

    print(line)

    with LOG_PATH.open("a", encoding="utf-8") as f:
        f.write(line + "\n")


def atomic_json_write(path, obj):
    """Prevents a crash halfway through writing crawl_state.json from
    corrupting the state file."""

    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(
        json.dumps(obj, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    tmp.replace(path)


def load_state():
    if not STATE_PATH.exists():
        return {"markets": {}}

    try:
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except Exception as exc:
        raise RuntimeError(f"Unable to read crawl state: {exc}")


def new_run_id():
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def run_id_to_datetime(run_id):
    return datetime.strptime(run_id, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)


def resolve_market_run(crawl_state, market_slug):
    """
    Decide whether to resume THIS market's in-progress run or start a fresh
    one. Scoped per market, since each invocation now targets exactly one
    market — resuming must never accidentally compare against another
    market's (or another day's) pagination state.

    fetched_pages/last_fingerprint must only ever let a crashed run resume
    mid-market — never cause a genuinely new, later crawl of the same market
    to be skipped, since listing prices change between crawls and that's
    exactly the signal the ML model needs.
    """

    market_state = crawl_state.get("markets", {}).get(market_slug)

    if market_state and market_state.get("status") == "in_progress":
        run_id = market_state.get("run_id")
        try:
            started_at = run_id_to_datetime(run_id)
            age_hours = (datetime.now(timezone.utc) - started_at).total_seconds() / 3600
        except (TypeError, ValueError):
            age_hours = None

        if run_id and age_hours is not None and age_hours <= STALE_RUN_HOURS:
            log(f"[{market_slug}] Resuming in-progress run {run_id} ({age_hours:.1f}h old).")
            return run_id, dict(market_state)

        log(
            f"[{market_slug}] Previous run {run_id} is stale or missing; "
            "starting a fresh run instead of resuming it."
        )

    run_id = new_run_id()
    log(f"[{market_slug}] Starting fresh run {run_id}.")
    return run_id, {"fetched_pages": [], "last_fingerprint": []}


def load_existing_ids(run_id):
    """
    records.jsonl is the source of truth for deduplication — but only within
    the CURRENT run. A listing seen in an earlier run must be recorded again
    (with that run's price/date) rather than silently dropped, otherwise
    price history across crawls is lost.
    """

    ids = set()

    if not RECORDS_PATH.exists():
        return ids

    with RECORDS_PATH.open("r", encoding="utf-8") as f:
        for line_number, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue

            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                log(f"WARNING: malformed JSONL line {line_number}")
                continue

            if record.get("run_id") != run_id:
                continue

            listing_id = record.get("listing_id")
            if listing_id:
                ids.add(str(listing_id))

    return ids


def to_int(value, default=None):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def classify_response(status, page):
    """
    Returns (outcome, reason) where outcome is one of:
      "ok"           - proceed normally
      "not_found"    - HTTP 404: this market's slug/URL is wrong.
      "server_error" - HTTP 5xx: more likely transient/per-request than a
                       security block.
      "blocked"      - a real anti-bot/rate-limit signal (401/403/407/429 or
                       a challenge page). Stop this run immediately — do not
                       retry, do not try again "smarter" in the same
                       invocation.
    """

    if status is None:
        return "blocked", "no HTTP response"

    if status == 404:
        return "not_found", "HTTP 404"

    if status in (401, 403, 407, 429):
        return "blocked", f"HTTP {status}"

    if status in (500, 502, 503, 504):
        return "server_error", f"HTTP {status}"

    if status >= 400:
        # Unexpected/unrecognized status — treat conservatively as a
        # possible block rather than assume it's benign.
        return "blocked", f"HTTP {status} (unrecognized)"

    # Some challenge responses are HTTP 200 with an empty visible body.
    # Detect dedicated challenge containers, not ordinary embedded contact-form CAPTCHAs.
    if page.locator("#sec-if-cpt-container, #challenge-form, iframe[src*='challenges.cloudflare.com']").count():
        return "blocked", "challenge container in response DOM"

    try:
        title = page.title().lower()
    except Exception:
        title = ""

    try:
        body = page.locator("body").inner_text(timeout=5000).lower()
    except Exception:
        body = ""

    text = title + "\n" + body[:20_000]

    for marker in BLOCK_MARKERS:
        if marker in text:
            return "blocked", f"challenge marker: {marker!r}"

    return "ok", None


def save_raw(run_id, market_slug, page_num, html, state_json):
    market_raw_dir = RAW_DIR / run_id / market_slug
    market_raw_dir.mkdir(parents=True, exist_ok=True)

    (market_raw_dir / f"page_{page_num:04d}.html").write_text(html, encoding="utf-8")
    atomic_json_write(market_raw_dir / f"page_{page_num:04d}.json", state_json)


def normalize_record(raw, market_slug, page_num, run_id, crawl_date):
    record = {
        output_key: raw.get(source_key)
        for output_key, source_key in FIELD_MAP.items()
    }
    # SEO cards use different keys from some of the earlier search samples.
    record["url"] = record["url"] or raw.get("seoURL")
    record["seller_type"] = record["seller_type"] or raw.get("userType")
    record["description"] = record["description"] or raw.get("auto_desc")

    listing_id = record.get("listing_id")
    if listing_id is not None:
        record["listing_id"] = str(listing_id)

    url = record.get("url")
    if url:
        record["url"] = urljoin(DOMAIN, str(url))

    record.update({
        "source": "magicbricks",
        "land_category": LAND_CATEGORY,
        "market": market_slug,
        "source_page": page_num,
        "fetched_at": utcnow(),
        # Deliberately NOT deduplicated across runs — one row per
        # (listing_id, run_id) so price changes over time are preserved as
        # real training signal.
        "run_id": run_id,
        "crawl_date": crawl_date,
    })

    return record


def extract_records(state_json, market_slug, page_num, run_id, crawl_date):
    results = state_json.get("searchResult")
    if not isinstance(results, list):
        return []

    return [
        normalize_record(raw, market_slug, page_num, run_id, crawl_date)
        for raw in results
        if isinstance(raw, dict)
    ]


def append_jsonl(path, records):
    if not records:
        return

    with path.open("a", encoding="utf-8") as f:
        for record in records:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
        f.flush()


def listing_fingerprint(records):
    """Detects broken pagination: if consecutive pages return the exact
    same listing-ID set, the `page=` parameter isn't actually doing anything."""

    ids = sorted(str(r["listing_id"]) for r in records if r.get("listing_id"))
    return tuple(ids)


def save_failure_diagnostics(page, response, url, market_slug, page_num, outcome, reason, run_id):
    """Keep rejected responses separate from listing data; never persist cookies/headers wholesale."""
    diagnostic_dir = OUT_DIR / "diagnostics" / run_id / market_slug
    try:
        diagnostic_dir.mkdir(parents=True, exist_ok=True)
        prefix = diagnostic_dir / f"page_{page_num:04d}"
        details = {
            "requested_url": url,
            "final_url": page.url,
            "status": response.status if response else None,
            "outcome": outcome,
            "reason": reason,
            "captured_at": utcnow(),
        }
        # Only noncredential response metadata useful for diagnosing a refusal.
        if response:
            headers = response.headers
            details["response_headers"] = {
                key: headers[key]
                for key in ("server", "content-type", "retry-after", "x-request-id", "cf-ray")
                if key in headers
            }
        atomic_json_write(prefix.with_suffix(".json"), details)
        prefix.with_suffix(".html").write_text(page.content(), encoding="utf-8")
        log(f"[{market_slug}] Failure diagnostics saved to {diagnostic_dir.resolve()}")
    except Exception as exc:
        # A diagnostic failure must not turn a blocked request into a retry or hide its status.
        log(f"[{market_slug}] Could not save failure diagnostics: {exc}")


def fetch_page(page, market_slug, page_num, run_id):
    slug = MARKET_URL_SLUGS.get(market_slug, market_slug)
    url = URL_TEMPLATE.format(slug=slug)
    if page_num > 1:
        url += f"/page-{page_num}"
    log(f"[{market_slug}] Fetching page {page_num}: {url}")

    try:
        response = page.goto(url, wait_until="domcontentloaded", timeout=NAVIGATION_TIMEOUT_MS)
    except PlaywrightTimeoutError:
        log(f"[{market_slug}] Navigation timeout on page {page_num}. Stopping - not retrying.")
        return "timeout", None

    # goto returns a Response even for HTTP errors. Inspect it BEFORE waiting
    # for application data that a denial/error page will never provide.
    status = response.status if response else None
    outcome, reason = classify_response(status, page)
    if outcome != "ok":
        log(f"[{market_slug}] page {page_num}: {outcome} ({reason}).")
        save_failure_diagnostics(page, response, url, market_slug, page_num, outcome, reason, run_id)
        return outcome, None

    try:
        page.wait_for_function(
            "() => window.SERVER_PRELOADED_STATE_ != null",
            timeout=15_000,
        )
    except PlaywrightTimeoutError:
        log(f"[{market_slug}] SERVER_PRELOADED_STATE_ did not appear on page {page_num}.")

    # Also detect challenge pages rendered by JavaScript after navigation.
    outcome, reason = classify_response(status, page)

    if outcome != "ok":
        log(f"[{market_slug}] page {page_num}: {outcome} ({reason}).")
        save_failure_diagnostics(page, response, url, market_slug, page_num, outcome, reason, run_id)
        return outcome, None

    html = page.content()
    state_json = page.evaluate(
        "() => window.SERVER_PRELOADED_STATE_ || null"
    )

    if not isinstance(state_json, dict):
        reason = "No usable SERVER_PRELOADED_STATE_ on a successful HTTP response"
        log(f"[{market_slug}] page {page_num}: extraction_error ({reason}).")
        save_failure_diagnostics(page, response, url, market_slug, page_num, "extraction_error", reason, run_id)
        return "extraction_error", None

    results = state_json.get("searchResult")
    if not isinstance(results, list) or any(not isinstance(item, dict) for item in results):
        reason = "Missing or malformed searchResult list"
        save_failure_diagnostics(page, response, url, market_slug, page_num, "extraction_error", reason, run_id)
        return "extraction_error", None

    return "ok", {"status": status, "html": html, "state": state_json}


def crawl_market(page, market_slug, run_id, crawl_date, market_state, seen_ids, market_appearances, crawl_state_ref):
    """
    Crawls one market fully (or until blocked/exhausted/capped). Returns one
    of: "complete", "capped", "not_found", "timeout", "server_error",
    "blocked", "extraction_error", "pagination_error".
    """

    fetched_pages = set(market_state.get("fetched_pages", []))

    outcome, fetched = fetch_page(page, market_slug, 1, run_id)
    if outcome != "ok":
        return outcome

    search_metadata = fetched["state"].get("searchAdditionalDataBean") or {}
    if not isinstance(search_metadata, dict):
        search_metadata = {}
    page_count = to_int(search_metadata.get("pageCount"))
    result_count = to_int(search_metadata.get("resultCount"), None)
    if page_count == 0 and result_count == 0 and not fetched["state"]["searchResult"]:
        page_count = 1
    if page_count is None or page_count < 1:
        save_raw(run_id, market_slug, 1, fetched["html"], fetched["state"])
        log(f"[{market_slug}] Missing or invalid pageCount; coverage cannot be established.")
        return "extraction_error"
    market_state["reported_page_count"] = page_count
    market_state["reported_result_count"] = result_count
    page_limit = min(page_count, MAX_PAGES_PER_MARKET)
    is_capped = page_count > MAX_PAGES_PER_MARKET

    log(f"[{market_slug}] pageCount={page_count}, resultCount={result_count}"
        + (f" (capped to {MAX_PAGES_PER_MARKET})" if is_capped else ""))

    # Seed the duplicate-pagination fingerprint from whatever was actually
    # last processed, not always page 1 — otherwise resuming after page 7
    # would wrongly compare page 8 against page 1's listings.
    previous_fingerprint = tuple(market_state.get("last_fingerprint", []))

    def process(page_num, fetched_data):
        nonlocal previous_fingerprint

        save_raw(run_id, market_slug, page_num, fetched_data["html"], fetched_data["state"])
        records = extract_records(fetched_data["state"], market_slug, page_num, run_id, crawl_date)
        fingerprint = listing_fingerprint(records)
        if not records and not (page_num == 1 and result_count == 0):
            log(f"[{market_slug}] Unexpected empty results on page {page_num}; coverage is incomplete.")
            return False

        if previous_fingerprint and fingerprint and fingerprint == previous_fingerprint:
            log(f"[{market_slug}] page {page_num} duplicates the previous page's listings. Stopping.")
            return False

        previous_fingerprint = fingerprint

        new_records = []
        page_ids = set()
        rejected = []
        for record in records:
            listing_id = record.get("listing_id")
            if not listing_id:
                log(f"[{market_slug}] page {page_num}: record missing listing_id; retained only in raw data.")
                continue

            market_appearances[listing_id].append(market_slug)

            if record.get("property_category") not in VALID_PROPERTY_CATEGORIES:
                rejected.append(record)
                continue

            if listing_id in seen_ids or listing_id in page_ids:
                continue

            new_records.append(record)
            page_ids.add(listing_id)

        # Persist records FIRST, only then update state — crash safety.
        append_jsonl(RECORDS_PATH, new_records)
        append_jsonl(REJECTED_RECORDS_PATH, rejected)

        for record in new_records:
            seen_ids.add(record["listing_id"])

        fetched_pages.add(page_num)
        market_state["fetched_pages"] = sorted(fetched_pages)
        market_state["last_fingerprint"] = list(fingerprint)
        market_state["status"] = "in_progress"
        market_state["run_id"] = run_id
        crawl_state_ref["markets"][market_slug] = market_state
        atomic_json_write(STATE_PATH, crawl_state_ref)

        log(
            f"[{market_slug}] page {page_num}: {len(records)} parsed, "
            f"{len(new_records)} new, {len(rejected)} rejected (category)."
        )
        return True

    if 1 not in fetched_pages:
        if not process(1, fetched):
            return "pagination_error"
    else:
        log(f"[{market_slug}] page 1 already persisted this run; using stored fingerprint to resume.")

    hit_duplicate_stop = False

    for page_num in range(2, page_limit + 1):
        if page_num in fetched_pages:
            log(f"[{market_slug}] page {page_num} already completed; skipping.")
            continue

        log(f"[{market_slug}] rate-limit wait: {REQUEST_INTERVAL_SECONDS}s")
        time.sleep(REQUEST_INTERVAL_SECONDS)

        outcome, fetched_data = fetch_page(page, market_slug, page_num, run_id)

        if outcome != "ok":
            return outcome

        if not process(page_num, fetched_data):
            hit_duplicate_stop = True
            break

    if hit_duplicate_stop:
        return "pagination_error"

    return "capped" if is_capped else "complete"


def launch_browser(playwright, args):
    options = {"headless": not args.headed}
    if args.browser == "chrome":
        options["channel"] = "chrome"
    return playwright.chromium.launch(**options)


def diagnose_page(args):
    """One navigation only; keep diagnostics out of crawl state and training data."""
    run_id = new_run_id()
    log(f"Diagnostic: browser={args.browser}, headed={args.headed}, fresh session, page 1 only.")
    with sync_playwright() as p:
        browser = launch_browser(p, args)
        try:
            page = browser.new_context().new_page()
            outcome, fetched = fetch_page(page, args.market, 1, run_id)
            if outcome == "ok":
                results = fetched["state"].get("searchResult")
                count = len(results) if isinstance(results, list) else 0
                log(f"Diagnostic: HTTP {fetched['status']}, listing state present, {count} results.")
            log(f"Diagnostic finished: {outcome}. Crawl state and dataset unchanged.")
        finally:
            browser.close()


def main():
    parser = argparse.ArgumentParser(
        description="Collect MagicBricks residential-plot listings for ONE market at a time."
    )
    parser.add_argument(
        "--market",
        required=True,
        choices=MARKETS,
        help="Exactly one verified market slug to crawl this invocation (e.g. kalyan).",
    )
    parser.add_argument(
        "--browser", choices=("chromium", "chrome"), default="chromium",
        help="Bundled Chromium (default), or installed Google Chrome. Uses a fresh session.",
    )
    parser.add_argument("--headed", action="store_true", help="Show the browser window for troubleshooting.")
    parser.add_argument(
        "--diagnose", action="store_true",
        help="Check page 1 once without pagination or changes to crawl state/listing records.",
    )
    args = parser.parse_args()
    if args.diagnose:
        diagnose_page(args)
        return
    market_slug = args.market

    OUT_DIR.mkdir(exist_ok=True)
    RAW_DIR.mkdir(exist_ok=True)

    crawl_state = load_state()
    crawl_state.setdefault("markets", {})

    run_id, market_state = resolve_market_run(crawl_state, market_slug)
    crawl_date = run_id_to_datetime(run_id).date().isoformat()

    market_state["status"] = "in_progress"
    market_state["run_id"] = run_id
    crawl_state["markets"][market_slug] = market_state
    atomic_json_write(STATE_PATH, crawl_state)

    seen_ids = load_existing_ids(run_id)
    market_appearances = defaultdict(list)

    log(f"[{market_slug}] Run {run_id} ({crawl_date}). Already-recorded listings this run: {len(seen_ids)}")

    with sync_playwright() as p:
        browser = launch_browser(p, args)
        # Let Playwright use the browser's actual/default UA — do not claim
        # to be a different browser version than what's actually installed.
        try:
            context = browser.new_context()
            page = context.new_page()

            result = crawl_market(
                page, market_slug, run_id, crawl_date,
                market_state, seen_ids, market_appearances, crawl_state,
            )
        finally:
            browser.close()

    market_state["status"] = result
    market_state["last_run_at"] = utcnow()
    crawl_state["markets"][market_slug] = market_state
    atomic_json_write(STATE_PATH, crawl_state)

    if market_appearances:
        appearances_path = OUT_DIR / f"listing_market_map_{market_slug}_{run_id}.json"
        atomic_json_write(appearances_path, dict(market_appearances))

    log(f"[{market_slug}] Run {run_id} finished (status={result}). Listings recorded this run: {len(seen_ids)}")

    if result == "blocked":
        log(f"[{market_slug}] BLOCKED - response did not contain usable listing data; outcome saved.")


if __name__ == "__main__":
    main()
