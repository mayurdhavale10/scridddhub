"""
One-off exploration script — NOT the real scraper. Test with minimal/no filters and capture
network responses to see whether "No Records Found" is systemic (e.g., a bot check silently
failing) or genuinely district-specific.
"""

from playwright.sync_api import sync_playwright

URL = "https://maharera.maharashtra.gov.in/projects-search-result"

captured = []


def handle_response(response):
    if "search" in response.url.lower() or "project" in response.url.lower():
        captured.append((response.request.method, response.status, response.url))


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36")
        page.on("response", handle_response)

        print(f"Navigating to: {URL}")
        page.goto(URL, wait_until="networkidle", timeout=45000)
        page.wait_for_timeout(2000)

        print("Selecting state = MAHARASHTRA only, no district, clicking Search...")
        page.select_option("#edit-project-state", label="MAHARASHTRA")
        page.wait_for_timeout(3000)
        page.click("#edit-submit", timeout=10000)
        page.wait_for_timeout(4000)

        body_text = page.inner_text("body")
        print(f"\n'No Records Found' present (state-only filter): {'No Records Found' in body_text}")

        print(f"\nCaptured {len(captured)} search/project-related network calls:")
        for method, status, url in captured:
            print(f"  {method} [{status}] {url}")

        page.screenshot(path="maharera_state_only.png", full_page=True)
        browser.close()


if __name__ == "__main__":
    main()
