"""
One-off exploration script — NOT the real scraper. Verify the clean path-based URL
(no "proptype=" query string, discovered by driving the real search UI) actually loads
Residential Plot listing data.
"""

from playwright.sync_api import sync_playwright

URL = "https://www.magicbricks.com/property-for-sale-rent-in-Thane/Plots-Land-Thane"


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36")

        print(f"Navigating to: {URL}")
        response = page.goto(URL, wait_until="networkidle", timeout=45000)
        print(f"HTTP status: {response.status if response else 'no response'}")
        print(f"Final URL: {page.url}")

        page.screenshot(path="clean_url_result.png", full_page=True)
        print(f"Page title: {page.title()}")
        print(f"Body text sample: {page.inner_text('body')[:500]!r}")

        state = page.evaluate("() => window.SERVER_PRELOADED_STATE_")
        if state is None:
            print("No SERVER_PRELOADED_STATE_ found.")
            browser.close()
            return

        results = state.get("searchResult", [])
        print(f"searchResult entries: {len(results)}")
        prop_types = {}
        for r in results:
            t = r.get("propTypeD")
            prop_types[t] = prop_types.get(t, 0) + 1
        print(f"propTypeD distribution: {prop_types}")

        if results:
            r = results[0]
            print(f"\nSample: price={r.get('price')}, la={r.get('la')} {r.get('landAreaUnitD')}, "
                  f"loc={r.get('scdloc')}, userType={r.get('userType')}, pmtSource={r.get('pmtSource')}, "
                  f"lat/long=({r.get('pmtLat')},{r.get('pmtLong')})")

        browser.close()


if __name__ == "__main__":
    main()
