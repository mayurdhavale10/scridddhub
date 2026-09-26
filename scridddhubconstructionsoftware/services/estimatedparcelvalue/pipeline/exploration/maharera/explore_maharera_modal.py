"""
One-off exploration script — NOT the real scraper. Click "View Details" the way a real user
would (from within the search-results page, where its "click-projectmodal" JS class is active)
rather than navigating directly to the subdomain URL, which loaded only an empty app shell.
"""

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

URL = "https://maharera.maharashtra.gov.in/projects-search-result"

api_calls = []


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36")
        page = context.new_page()
        page.on("response", lambda r: api_calls.append((r.status, r.url)) if "json" in r.headers.get("content-type", "").lower() else None)

        print(f"Navigating to: {URL}")
        page.goto(URL, wait_until="domcontentloaded", timeout=60000)
        try:
            page.wait_for_load_state("networkidle", timeout=15000)
        except PlaywrightTimeoutError:
            pass

        page.select_option("#edit-project-state", label="MAHARASHTRA")
        try:
            page.wait_for_load_state("networkidle", timeout=15000)
        except PlaywrightTimeoutError:
            pass
        page.click("#edit-submit")
        try:
            page.wait_for_load_state("networkidle", timeout=20000)
        except PlaywrightTimeoutError:
            pass
        page.wait_for_timeout(1000)

        print("Clicking first 'View Details' link...")
        page.click("a.click-projectmodal >> nth=0")
        page.wait_for_timeout(1500)

        # A confirmation dialog appears: "You are about to proceed to an external website."
        print("Clicking 'Yes' on the external-site confirmation dialog...")
        try:
            with context.expect_page(timeout=10000) as new_page_info:
                page.click("text=Yes", timeout=5000)
            new_page = new_page_info.value
        except PlaywrightTimeoutError:
            print("No new page opened after Yes — checking current page instead.")
            new_page = page

        # Attach listeners immediately — before any wait — so early events aren't missed.
        new_page.on("response", lambda r: api_calls.append((r.status, r.request.method, r.url)))
        new_page.on("console", lambda msg: print(f"[CONSOLE:{msg.type}] {msg.text}"))
        new_page.on("pageerror", lambda exc: print(f"[PAGE ERROR] {exc}"))

        new_page.wait_for_load_state("networkidle", timeout=20000)
        new_page.wait_for_timeout(15000)

        print(f"Detail page URL: {new_page.url}")
        body_text = new_page.inner_text("body")
        print(f"Body text length: {len(body_text)}")

        with open("maharera_modal_detail.txt", "w", encoding="utf-8") as f:
            f.write(body_text)
        new_page.screenshot(path="maharera_modal_detail.png", full_page=True)

        for kw in ["price", "Price", "Rs.", "carpet area", "Carpet Area", "cost", "Cost", "sq", "amount", "Amount"]:
            count = body_text.count(kw)
            if count:
                print(f"  keyword {kw!r}: {count} occurrence(s)")

        print(f"\nAll requests made by the detail page ({len(api_calls)}):")
        for entry in api_calls[-40:]:
            print(f"  {entry}")

        browser.close()


if __name__ == "__main__":
    main()
