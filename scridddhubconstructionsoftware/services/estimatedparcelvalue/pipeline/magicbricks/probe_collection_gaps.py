"""Small sequential browser pilot using published routes; saves evidence separately.

Saves diagnostic evidence separately from the dataset; uses published locality routes.
"""
import argparse
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError
import magicbricks_residential_plot_crawler as crawler

ROOT = Path(__file__).resolve().parent.parent



def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--headed", action="store_true")
    parser.add_argument("--source", choices=("magicbricks", "housing"), required=True)
    args = parser.parse_args()
    run = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out = ROOT / "magicbricks_mmr_data" / "pilots" / (run + "_" + args.source)
    out.mkdir(parents=True)
    if args.source == "magicbricks":
        targets = [("thane", crawler.URL_TEMPLATE.format(slug="thane")),
                   ("shahad_navigation", "https://www.magicbricks.com/east-facing-plots-land-for-sale-in-shahad-beyond-thane-pppfs"),
                   *[(market, crawler.URL_TEMPLATE.format(slug=crawler.MARKET_URL_SLUGS.get(market, market)))
                     for market in ("kamothe", "rasayani", "vasind", "kalyan")]]
    else:
        targets = [("kalyan", "https://housing.com/in/buy/thane/kalyan-gid/plots-fid/")]
    report = {"source": args.source, "run_id": run, "results": [], "unattempted": targets.copy()}
    def save():
        (out / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    save()
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=not args.headed)
        try:
            page = browser.new_context().new_page()
            index = 0
            while index < len(targets) and index < 10:
                label, url = targets[index]
                if index:
                    time.sleep(10)
                index += 1
                result = {"label": label, "url": url, "observed_at": datetime.now(timezone.utc).isoformat()}
                print(f"Checking {label}: {url}", flush=True)
                try:
                    response = page.goto(url, wait_until="domcontentloaded", timeout=45000)
                    status = response.status if response else None
                    outcome, reason = crawler.classify_response(status, page)
                    if outcome == "ok" and args.source == "magicbricks":
                        try:
                            page.wait_for_function("() => window.SERVER_PRELOADED_STATE_ != null", timeout=15000)
                        except PlaywrightTimeoutError:
                            pass
                        outcome, reason = crawler.classify_response(status, page)
                    result.update(status=status, outcome=outcome, reason=reason, final_url=page.url)
                    (out / f"{label}.html").write_text(page.content(), encoding="utf-8")
                    if outcome == "ok":
                        links = page.locator("a[href]").evaluate_all("els => els.map(e => ({text:e.innerText, url:e.href}))")
                        (out / f"{label}_links.json").write_text(json.dumps(links, indent=2), encoding="utf-8")
                        if args.source == "magicbricks":
                            data = page.evaluate("() => window.SERVER_PRELOADED_STATE_ || null")
                            (out / f"{label}.json").write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
                            if isinstance(data, dict):
                                result["direct_cards"] = len(data.get("searchResult") or [])
                                result["metadata"] = {k:(data.get("searchAdditionalDataBean") or {}).get(k)
                                                      for k in ("resultCount", "pageCount", "h1TagText")}
                            for link in links:
                                candidate = link["url"]
                                if urlsplit(candidate).hostname != "www.magicbricks.com":
                                    continue
                                if label == "thane" and candidate.endswith("/page-2") and "/residential-plots-land-for-sale-in-thane-pppfs/" in candidate:
                                    if candidate not in [u for _, u in targets]:
                                        targets.insert(index, ("thane_page2", candidate))
                                if label == "shahad_navigation" and candidate.endswith("/residential-plots-land-for-sale-in-shahad-beyond-thane-pppfs"):
                                    if candidate not in [u for _, u in targets]:
                                        targets.insert(index, ("shahad", candidate))
                                if label == "kalyan" and "residential-plots-land-for-sale-in-khadakpada" in candidate and candidate.endswith("-pppfs"):
                                    if candidate not in [u for _, u in targets]:
                                        targets.append(("khadakpada", candidate))
                        else:
                            scripts = page.locator('script[type="application/ld+json"]').all_text_contents()
                            (out / "structured_data.json").write_text(json.dumps(scripts, indent=2), encoding="utf-8")
                            (out / "page_text.txt").write_text(page.locator("body").inner_text(), encoding="utf-8")
                            if not scripts and not page.locator("body").inner_text().strip():
                                result.update(outcome="extraction_error", reason="HTTP response has no usable listing content")
                except PlaywrightTimeoutError:
                    result["outcome"] = "timeout"
                report["results"].append(result)
                report["unattempted"] = targets[index:]
                save()
                print(json.dumps(result), flush=True)
                if result["outcome"] in ("blocked", "timeout", "server_error"):
                    break
        finally:
            browser.close()
    print(f"Report: {out / 'report.json'}", flush=True)


if __name__ == "__main__":
    main()
