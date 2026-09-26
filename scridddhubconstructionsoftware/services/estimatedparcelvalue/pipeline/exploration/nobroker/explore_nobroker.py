"""Historical source-navigation diagnostic; retains page evidence for inspection."""

from playwright.sync_api import sync_playwright

HOMEPAGE = "https://www.nobroker.in/"


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        print(f"Navigating to: {HOMEPAGE}")
        response = page.goto(HOMEPAGE, wait_until="domcontentloaded", timeout=45000)
        print(f"HTTP status: {response.status if response else 'no response'}")

        page.screenshot(path="nobroker_homepage.png", full_page=False)
        print(f"Page title: {page.title()}")

        # Try to find a Buy/Plot flow via visible text — print whatever
        # navigation options actually exist so nothing is guessed.
        try:
            body_text = page.inner_text("body")[:2000].encode("ascii", "replace").decode("ascii")
            print(f"Body text sample:\n{body_text}")
        except Exception as e:
            print(f"Could not read body text: {e}")

        browser.close()


if __name__ == "__main__":
    main()
