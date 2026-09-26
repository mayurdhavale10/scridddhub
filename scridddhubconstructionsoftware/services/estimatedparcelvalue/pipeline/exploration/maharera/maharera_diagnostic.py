"""
MahaRERA diagnostic exploration.

Purpose:
- Determine exactly what the project-search form submits.
- Capture XHR/fetch/document requests and responses.
- Check whether state/district AJAX actually completes.
- Detect validation messages.
- Compare page state before and after Search.
- Save HAR + Playwright trace for inspection.

This is NOT a scraper.
"""

import json
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError


URL = "https://maharera.maharashtra.gov.in/projects-search-result"

OUT = Path("maharera_diagnostic")
OUT.mkdir(exist_ok=True)

network_log = []


def shorten(value, n=1500):
    if value is None:
        return None

    value = str(value)

    if len(value) <= n:
        return value

    return value[:n] + "... <truncated>"


def main():
    with sync_playwright() as p:

        # Kept headless=True (not opening a visible window on the desktop unprompted) —
        # screenshots + network/console logs give the same diagnostic value.
        browser = p.chromium.launch(
            headless=True,
        )

        context = browser.new_context(
            record_har_path=str(OUT / "network.har"),
        )

        context.tracing.start(
            screenshots=True,
            snapshots=True,
            sources=True,
        )

        page = context.new_page()

        # ---------------------------------------------------------
        # Browser-side diagnostics
        # ---------------------------------------------------------

        page.on(
            "console",
            lambda msg: print(
                f"[CONSOLE:{msg.type}] {msg.text}"
            ),
        )

        page.on(
            "pageerror",
            lambda exc: print(
                f"[PAGE ERROR] {exc}"
            ),
        )

        page.on(
            "requestfailed",
            lambda request: print(
                f"[REQUEST FAILED] "
                f"{request.method} "
                f"{request.resource_type} "
                f"{request.url} "
                f"{request.failure}"
            ),
        )

        # ---------------------------------------------------------
        # Network capture
        # ---------------------------------------------------------

        def handle_request(request):

            if request.resource_type not in {
                "document",
                "xhr",
                "fetch",
            }:
                return

            entry = {
                "event": "request",
                "method": request.method,
                "resource_type": request.resource_type,
                "url": request.url,
                "post_data": shorten(request.post_data),
            }

            network_log.append(entry)

            print(
                f"\n>>> REQUEST "
                f"[{request.resource_type}] "
                f"{request.method} "
                f"{request.url}"
            )

            if request.post_data:
                print(
                    "POST DATA:",
                    shorten(request.post_data),
                )

        def handle_response(response):

            request = response.request

            if request.resource_type not in {
                "document",
                "xhr",
                "fetch",
            }:
                return

            content_type = response.headers.get(
                "content-type",
                "",
            )

            entry = {
                "event": "response",
                "status": response.status,
                "resource_type": request.resource_type,
                "method": request.method,
                "url": response.url,
                "content_type": content_type,
            }

            # Capture small textual responses.
            if (
                "json" in content_type.lower()
                or "text" in content_type.lower()
                or "html" in content_type.lower()
            ):
                try:
                    text = response.text()
                    entry["body"] = shorten(text, 4000)

                except Exception as exc:
                    entry["body_error"] = str(exc)

            network_log.append(entry)

            print(
                f"<<< RESPONSE "
                f"[{response.status}] "
                f"[{request.resource_type}] "
                f"{response.url}"
            )

        page.on("request", handle_request)
        page.on("response", handle_response)

        # ---------------------------------------------------------
        # Load page
        # ---------------------------------------------------------

        print("\n========================================")
        print("OPENING MAHARERA")
        print("========================================")

        page.goto(
            URL,
            wait_until="domcontentloaded",
            timeout=60000,
        )

        try:
            page.wait_for_load_state(
                "networkidle",
                timeout=15000,
            )
        except PlaywrightTimeoutError:
            print(
                "[INFO] networkidle not reached; continuing."
            )

        page.screenshot(
            path=str(OUT / "01_initial.png"),
            full_page=True,
        )

        print("\nURL after initial load:")
        print(page.url)

        # ---------------------------------------------------------
        # Check whether "No Records Found" ALREADY exists
        # ---------------------------------------------------------

        body_initial = page.inner_text("body")

        print(
            "\n'No Records Found' present BEFORE search:",
            "No Records Found" in body_initial,
        )

        no_records_locator = page.get_by_text(
            "No Records Found",
            exact=False,
        )

        print(
            "'No Records Found' locator count:",
            no_records_locator.count(),
        )

        if no_records_locator.count():
            for i in range(
                min(no_records_locator.count(), 5)
            ):
                try:
                    print(
                        f"  occurrence {i}: "
                        f"visible="
                        f"{no_records_locator.nth(i).is_visible()}"
                    )
                except Exception:
                    pass

        # ---------------------------------------------------------
        # Inspect STATE dropdown
        # ---------------------------------------------------------

        state = page.locator("#edit-project-state")

        print("\n========================================")
        print("STATE CONTROL")
        print("========================================")

        print("State control count:", state.count())

        if state.count() == 0:
            raise RuntimeError(
                "#edit-project-state does not exist."
            )

        state_options = state.locator("option").all()

        print(
            "Number of state options:",
            len(state_options),
        )

        for option in state_options:
            print(
                repr(option.inner_text()),
                "=>",
                repr(option.get_attribute("value")),
            )

        # ---------------------------------------------------------
        # Select Maharashtra
        # ---------------------------------------------------------

        print("\nSelecting MAHARASHTRA...")

        page.select_option(
            "#edit-project-state",
            label="MAHARASHTRA",
        )

        print(
            "Selected state value:",
            state.input_value(),
        )

        # Wait for AJAX caused by state selection.
        try:
            page.wait_for_load_state(
                "networkidle",
                timeout=15000,
            )
        except PlaywrightTimeoutError:
            print(
                "[INFO] State-change network did "
                "not become completely idle."
            )

        # ---------------------------------------------------------
        # Inspect district AFTER state AJAX
        # ---------------------------------------------------------

        district = page.locator(
            "#edit-project-district"
        )

        print("\n========================================")
        print("DISTRICT CONTROL AFTER STATE CHANGE")
        print("========================================")

        print(
            "District locator count:",
            district.count(),
        )

        if district.count():

            options = district.locator(
                "option"
            ).all()

            print(
                "District option count:",
                len(options),
            )

            for option in options[:50]:
                print(
                    repr(option.inner_text()),
                    "=>",
                    repr(
                        option.get_attribute(
                            "value"
                        )
                    ),
                )

        else:
            print(
                "WARNING: expected district "
                "control was not found."
            )

        page.screenshot(
            path=str(
                OUT /
                "02_after_state_selection.png"
            ),
            full_page=True,
        )

        # ---------------------------------------------------------
        # Inspect submit button
        # ---------------------------------------------------------

        submit = page.locator("#edit-submit")

        print("\n========================================")
        print("SEARCH BUTTON")
        print("========================================")

        print(
            "Submit count:",
            submit.count(),
        )

        if submit.count() == 0:
            raise RuntimeError(
                "#edit-submit does not exist."
            )

        print(
            "Visible:",
            submit.is_visible(),
        )

        print(
            "Enabled:",
            submit.is_enabled(),
        )

        print(
            "Button text:",
            repr(submit.inner_text()),
        )

        # ---------------------------------------------------------
        # Capture form fields before submitting
        # ---------------------------------------------------------

        print("\n========================================")
        print("FORM FIELDS")
        print("========================================")

        form_data = page.evaluate(
            """
            () => {
                const button =
                    document.querySelector('#edit-submit');

                if (!button) {
                    return {
                        error: 'submit button not found'
                    };
                }

                const form = button.closest('form');

                if (!form) {
                    return {
                        error: 'parent form not found'
                    };
                }

                const fields =
                    [...form.elements].map(el => ({
                        tag: el.tagName,
                        type: el.type || null,
                        name: el.name || null,
                        id: el.id || null,
                        value: el.value || null,
                        checked:
                            typeof el.checked === 'boolean'
                            ? el.checked
                            : null
                    }));

                return {
                    action: form.action,
                    method: form.method,
                    fields: fields
                };
            }
            """
        )

        print(
            json.dumps(
                form_data,
                indent=2,
            )
        )

        with open(
            OUT / "form_fields.json",
            "w",
            encoding="utf-8",
        ) as fh:
            json.dump(
                form_data,
                fh,
                indent=2,
            )

        # ---------------------------------------------------------
        # Search: Maharashtra only
        # ---------------------------------------------------------

        print("\n========================================")
        print("SUBMITTING STATE-ONLY SEARCH")
        print("========================================")

        requests_before = len(network_log)

        url_before = page.url

        submit.click()

        # Allow either full navigation or AJAX.
        try:
            page.wait_for_load_state(
                "networkidle",
                timeout=20000,
            )

        except PlaywrightTimeoutError:
            print(
                "[INFO] Search did not reach "
                "networkidle within 20 seconds."
            )

        # Small pause only after network processing;
        # not being used as the primary synchronization.
        page.wait_for_timeout(1000)

        url_after = page.url

        print("\nURL before search:")
        print(url_before)

        print("\nURL after search:")
        print(url_after)

        print(
            "\nNetwork events generated by search:",
            len(network_log) - requests_before,
        )

        # ---------------------------------------------------------
        # Results diagnosis
        # ---------------------------------------------------------

        body_after = page.inner_text("body")

        print("\n========================================")
        print("RESULT")
        print("========================================")

        print(
            "'No Records Found' present AFTER search:",
            "No Records Found" in body_after,
        )

        print(
            "Body text length:",
            len(body_after),
        )

        # Look for common validation/error text.
        possible_errors = [
            "required",
            "invalid",
            "error",
            "please select",
            "captcha",
            "verification",
            "access denied",
            "forbidden",
        ]

        print("\nPotential validation/error indicators:")

        lower_body = body_after.lower()

        for term in possible_errors:
            if term.lower() in lower_body:
                print(
                    f"  FOUND: {term!r}"
                )

        page.screenshot(
            path=str(
                OUT /
                "03_after_search.png"
            ),
            full_page=True,
        )

        # Save complete body text.
        with open(
            OUT / "page_after_search.txt",
            "w",
            encoding="utf-8",
        ) as fh:
            fh.write(body_after)

        # Save network data.
        with open(
            OUT / "network.json",
            "w",
            encoding="utf-8",
        ) as fh:
            json.dump(
                network_log,
                fh,
                indent=2,
            )

        # Save HTML for offline inspection.
        with open(
            OUT / "page_after_search.html",
            "w",
            encoding="utf-8",
        ) as fh:
            fh.write(page.content())

        # Playwright trace.
        context.tracing.stop(
            path=str(
                OUT /
                "trace.zip"
            )
        )

        context.close()
        browser.close()

        print("\n========================================")
        print("DIAGNOSTIC COMPLETE")
        print("========================================")

        print(
            f"""
Generated:

{OUT}/
    01_initial.png
    02_after_state_selection.png
    03_after_search.png
    form_fields.json
    network.json
    network.har
    page_after_search.html
    page_after_search.txt
    trace.zip
"""
        )


if __name__ == "__main__":
    main()
