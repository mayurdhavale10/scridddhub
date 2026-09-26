"""
One-off exploration script — NOT the real scraper. Load a real project detail page on
maharerait.maharashtra.gov.in and check whether it discloses unit-wise pricing / financial
figures, or only construction/registration status.
"""

from playwright.sync_api import sync_playwright

URL = "https://maharerait.maharashtra.gov.in/public/project/view/1"

api_calls = []


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36")
        page.on("response", lambda r: api_calls.append((r.status, r.url)) if "json" in r.headers.get("content-type", "").lower() else None)

        print(f"Navigating to: {URL}")
        response = page.goto(URL, wait_until="networkidle", timeout=45000)
        print(f"HTTP status: {response.status if response else 'no response'}")

        page.wait_for_timeout(6000)
        print(f"\nJSON API calls made ({len(api_calls)}):")
        for status, url in api_calls:
            print(f"  [{status}] {url}")
        page.screenshot(path="maharera_project_detail.png", full_page=True)

        body_text = page.inner_text("body")
        with open("maharera_project_detail.txt", "w", encoding="utf-8") as f:
            f.write(body_text)
        print(f"Body text length: {len(body_text)}")

        # Look for price/financial keywords
        for kw in ["price", "Price", "₹", "Rs.", "carpet area", "sale", "cost", "per sq", "amount"]:
            count = body_text.count(kw)
            if count:
                print(f"  keyword {kw!r}: {count} occurrence(s)")

        browser.close()


if __name__ == "__main__":
    main()
