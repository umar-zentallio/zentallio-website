#!/usr/bin/env python3
"""
Local dev server for the Zentallio site.

Mimics the Vercel config in vercel.json (cleanUrls + trailingSlash: false)
so that links like /about, /contact and /fashion/sector-solutions resolve
to about.html, contact.html and fashion/sector-solutions.html.

Usage:  python3 dev-server.py [port]     (default port 8000)
"""

import os
import sys
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))

# from vercel.json "redirects"
REDIRECTS = {
    "/fashion/Zentallio-Fashion-Sector-Solutions-v7.0.html": "/fashion/sector-solutions",
    "/fashion/Zentallio-Fashion-Sector-Solutions-v7.0": "/fashion/sector-solutions",
}


class CleanUrlHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?", 1)[0].split("#", 1)[0]

        if path in REDIRECTS:
            self.send_response(308)
            self.send_header("Location", REDIRECTS[path])
            self.end_headers()
            return

        # trailingSlash: false -> /about/ redirects to /about
        if len(path) > 1 and path.endswith("/"):
            self.send_response(308)
            self.send_header("Location", path.rstrip("/"))
            self.end_headers()
            return

        if path.startswith("/api/"):
            self.send_error(
                501,
                "API routes need `vercel dev` (these are serverless functions)",
            )
            return

        return super().do_GET()

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


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    handler = functools.partial(CleanUrlHandler, directory=ROOT)
    server = ThreadingHTTPServer(("127.0.0.1", port), handler)
    print(f"\n  Zentallio dev server → http://localhost:{port}\n")
    print("  Ctrl+C to stop\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  stopped\n")


if __name__ == "__main__":
    main()
