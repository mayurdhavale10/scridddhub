"""
One-off exploration script — NOT a scraper. Captures real network requests
made while loading a NoBroker plot-search page, to find where the actual
listing data comes from (JSON-LD on this page was just SEO/FAQ boilerplate,
no real listings).
"""

import json
from playwright.sync_api import sync_playwright

URL = "https://www.nobroker.in/residential-land-plots-for-sale-in-mumbai_mumbai"


def main():
    calls = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        def on_response(response):
            url = response.url
            ct = response.headers.get("content-type", "")
            if "json" in ct and "nobroker" in url:
                calls.append((response.status, url))

        page.on("response", on_response)

        page.goto(URL, wait_until="networkidle", timeout=45000)

        print(f"Captured {len(calls)} JSON responses from nobroker domains:")
        for status, url in calls:
            print(f"  {status}  {url}")

        with open("nobroker_network_calls.json", "w", encoding="utf-8") as f:
            json.dump([{"status": s, "url": u} for s, u in calls], f, indent=2)

        browser.close()


if __name__ == "__main__":
    main()
