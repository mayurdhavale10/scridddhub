"""Historical source-navigation diagnostic; retains page evidence for inspection."""

from playwright.sync_api import sync_playwright

URL = "https://www.magicbricks.com/residential-plots-land-for-sale-in-thane-pppfs"


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36")

        print(f"Navigating to: {URL}")
        response = page.goto(URL, wait_until="networkidle", timeout=45000)
        print(f"HTTP status: {response.status if response else 'no response'}")
        print(f"Final URL: {page.url}")

        html = page.content()
        with open("seo_page.html", "w", encoding="utf-8") as f:
            f.write(html)
        print(f"Saved rendered HTML: {len(html)} chars")

        page.screenshot(path="seo_page.png", full_page=True)
        print(f"Page title: {page.title()}")

        state = page.evaluate("() => window.SERVER_PRELOADED_STATE_")
        print(f"SERVER_PRELOADED_STATE_ present: {state is not None}")
        if state is not None:
            import json
            with open("seo_state.json", "w", encoding="utf-8") as f:
                json.dump(state, f, ensure_ascii=False, indent=2)
            print(f"Top-level keys: {list(state.keys())}")
            results = state.get("searchResult") or state.get("resultList") or []
            print(f"searchResult-like entries: {len(results) if isinstance(results, list) else 'n/a'}")
            if isinstance(results, list) and results:
                r = results[0]
                print(f"Sample record keys: {list(r.keys())[:30]}")
                print(f"Sample: price={r.get('price')}, la={r.get('la')}, sqFtPrice={r.get('sqFtPrice')}, "
                      f"loc={r.get('scdloc') or r.get('locSeoName')}, lat/long=({r.get('pmtLat')},{r.get('pmtLong')})")

        ld_json = page.eval_on_selector_all(
            "script[type='application/ld+json']",
            "els => els.map(e => e.textContent)"
        )
        print(f"JSON-LD blocks found: {len(ld_json)}")
        for i, block in enumerate(ld_json):
            with open(f"seo_ldjson_{i}.json", "w", encoding="utf-8") as f:
                f.write(block)

        body_sample = page.inner_text("body")[:1000].encode("ascii", "replace").decode("ascii")
        print(f"Body text sample:\n{body_sample!r}")

        browser.close()


if __name__ == "__main__":
    main()
