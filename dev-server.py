#!/usr/bin/env python3
"""
Local dev server for the Zentallio site.

Mimics the Vercel config in vercel.json (cleanUrls + trailingSlash: false)
so that links like /about, /contact and /fashion/sector-solutions resolve
to about.html, contact.html and fashion/sector-solutions.html.

It also proxies /api/* to the Node API (api-server.js, port 3001) so the
booking chat works from the same origin -- one URL in the browser, exactly
like production. Start the API separately:  node api-server.js

Usage:  python3 dev-server.py [port]     (default port 8000)
"""

import os
import sys
import json
import functools
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
API_ORIGIN = os.environ.get("API_ORIGIN", "http://127.0.0.1:3001")

# from vercel.json "redirects"
REDIRECTS = {
    "/fashion/Zentallio-Fashion-Sector-Solutions-v7.0.html": "/fashion/sector-solutions",
    "/fashion/Zentallio-Fashion-Sector-Solutions-v7.0": "/fashion/sector-solutions",
}

# headers that belong to the proxy connection, not the payload
HOP_BY_HOP = {
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailers", "transfer-encoding", "upgrade",
}


class CleanUrlHandler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    # ---- routing ----

    def do_GET(self):
        if self._handle_common():
            return
        return super().do_GET()

    def do_HEAD(self):
        if self._handle_common():
            return
        return super().do_HEAD()

    def do_POST(self):
        if self._is_api():
            return self._proxy_api()
        self.send_error(405, "POST only supported on /api/*")

    def do_OPTIONS(self):
        if self._is_api():
            return self._proxy_api()
        self.send_error(405)

    # ---- helpers ----

    def _clean_path(self):
        return self.path.split("?", 1)[0].split("#", 1)[0]

    def _is_api(self):
        return self._clean_path().startswith("/api/")

    def _handle_common(self):
        """Redirects and API proxying. Returns True if the request is done."""
        path = self._clean_path()

        if path in REDIRECTS:
            self._redirect(REDIRECTS[path])
            return True

        # trailingSlash: false -> /about/ redirects to /about
        if len(path) > 1 and path.endswith("/"):
            self._redirect(path.rstrip("/"))
            return True

        if path.startswith("/api/"):
            self._proxy_api()
            return True

        return False

    def _redirect(self, location):
        self.send_response(308)
        self.send_header("Location", location)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def _proxy_api(self):
        """Forward the request to api-server.js and stream the reply back."""
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else None

        req = urllib.request.Request(
            API_ORIGIN + self.path,
            data=body,
            method=self.command,
        )
        for name, value in self.headers.items():
            if name.lower() not in HOP_BY_HOP and name.lower() != "host":
                req.add_header(name, value)

        try:
            # generous: api/chat.js may run a multi-hop Claude tool loop
            with urllib.request.urlopen(req, timeout=120) as upstream:
                self._relay(upstream.status, upstream.headers, upstream.read())
        except urllib.error.HTTPError as e:
            # 4xx/5xx from the API are real responses -- pass them through
            self._relay(e.code, e.headers, e.read())
        except urllib.error.URLError as e:
            self._api_down(e)

    def _relay(self, status, headers, payload):
        self.send_response(status)
        for name, value in headers.items():
            if name.lower() not in HOP_BY_HOP and name.lower() != "content-length":
                self.send_header(name, value)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(payload)

    def _api_down(self, err):
        payload = json.dumps({
            "error": "api_unreachable",
            "message": f"No API at {API_ORIGIN} — start it with:  node api-server.js",
            "detail": str(getattr(err, "reason", err)),
        }).encode()
        self.send_response(502)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)
        sys.stderr.write(f"\n  !! {self.path} -> API not running. Start it:  node api-server.js\n\n")

    # ---- static file resolution ----

    def translate_path(self, path):
        fs_path = super().translate_path(path)

        # cleanUrls: /about -> about.html
        # Also covers /fashion, where a fashion/ directory *and* fashion.html
        # both exist -- the .html wins, same as on Vercel.
        if not os.path.isfile(fs_path) and not fs_path.endswith(".html"):
            if os.path.isfile(fs_path + ".html"):
                return fs_path + ".html"

        return fs_path

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *a):
        sys.stderr.write("  %s\n" % (fmt % a))


def api_is_up():
    try:
        with urllib.request.urlopen(API_ORIGIN + "/health", timeout=1) as r:
            return json.loads(r.read()).get("ok") is True
    except Exception:
        return False


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    handler = functools.partial(CleanUrlHandler, directory=ROOT)
    server = ThreadingHTTPServer(("127.0.0.1", port), handler)

    print(f"\n  Zentallio dev server  →  http://localhost:{port}")
    if api_is_up():
        print(f"  API                   →  {API_ORIGIN}  (connected)")
    else:
        print(f"  API                   →  not running")
        print(f"                           booking chat needs:  node api-server.js")
    print("\n  Ctrl+C to stop\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  stopped\n")


if __name__ == "__main__":
    main()
