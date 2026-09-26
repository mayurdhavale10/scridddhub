"""One-request evidence capture for the Khadakpada pilot (no automatic retries).

Run each page check separately; inspect evidence before the next request.
Redirects are recorded, not followed. Does not execute JavaScript or call APIs.
"""
import argparse
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url")
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=False)
    listing = re.search(r"/([a-f0-9]{32})/detail$", args.url)
    report = {"url": args.url, "observed_at": datetime.now(timezone.utc).isoformat(),
              "transport": "urllib; default Python user agent; no redirects/retries/JavaScript",
              "listing_id": listing[1] if listing else None}
    request = Request(args.url)
    try:
        try:
            response = build_opener(NoRedirect).open(request, timeout=40)
        except HTTPError as exc:
            response = exc
        with response:
            body = response.read()
            report.update(status=response.code, final_url=response.url,
                          headers=dict(response.headers.items()), bytes=len(body),
                          sha256=hashlib.sha256(body).hexdigest())
        (args.output / "body.bin").write_bytes(body)
        text = body.decode("utf-8", errors="replace")
        (args.output / "body.txt").write_text(text, encoding="utf-8")
        markers = [m for m in ("sec-if-cpt-container", "access denied", "verify you are human",
                               "security challenge", "just a moment", "captcha", "security alert")
                   if m in text.lower()]
        report["challenge_markers_for_review"] = markers
        report["outcome"] = ("stop_http_error" if response.code >= 400 else
                             "stop_redirect" if 300 <= response.code < 400 else
                             "stop_challenge_review" if markers else "received_requires_review")
    except (URLError, TimeoutError, OSError) as exc:
        report.update(outcome="transport_error", error=str(exc))
    (args.output / "response.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    if report["outcome"] == "transport_error":
        raise SystemExit(2)


if __name__ == "__main__":
    main()
