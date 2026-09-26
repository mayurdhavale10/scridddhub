"""Historical source-navigation diagnostic; retains page evidence for inspection."""

import json
from playwright.sync_api import sync_playwright

HOMEPAGE = "https://www.squareyards.com/"


def main():
    calls = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        def on_response(response):
            url = response.url
            ct = response.headers.get("content-type", "")
            if "json" in ct and "squareyards" in url:
                calls.append((response.status, url))

        page.on("response", on_response)

        response = page.goto(HOMEPAGE, wait_until="domcontentloaded", timeout=45000)
        print(f"Homepage status: {response.status if response else None}")

        hrefs = page.eval_on_selector_all("a", "els => els.map(e => e.href)")
        plot_links = sorted(set(
            h for h in hrefs
            if h and ("plot" in h.lower() or "land" in h.lower())
        ))
        print(f"Plot/land-related links found: {len(plot_links)}")
        for h in plot_links[:20]:
            print(" ", h)

        print(f"\nJSON responses captured on homepage load: {len(calls)}")
        for status, url in calls[:20]:
            print(f"  {status}  {url}")

        with open("squareyards_homepage_links.json", "w", encoding="utf-8") as f:
            json.dump(plot_links, f, indent=2)

        browser.close()


if __name__ == "__main__":
    main()
