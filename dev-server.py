#!/usr/bin/env python3
"""
Local dev server for the Zentallio site.

Mimics the Vercel config in vercel.json (cleanUrls + trailingSlash: false)
so that links like /about, /contact and /fashion/sector-solutions resolve
to about.html, contact.html and fashion/sector-solutions.html.

It also proxies /api/* to the Node API (api-server.js, port 3001) so the
booking chat works from the same origin -- one URL in the browser, exactly
like production. Start the API separately:  node api-server.js

It ALSO emulates middleware.js -- the mobile routing. The MOBILE_READY list
is read straight out of middleware.js, so there is only one source of truth.

    python3 dev-server.py              # http://localhost:8000
    python3 dev-server.py 8000 --lan   # phone se test karne ke liye LAN par bhi
    python3 dev-server.py 8000 --mdot  # production jaisa 302 -> m.<host> flow

On localhost the mobile page is served inline (no redirect), because there is
no m.localhost to redirect to. Use DevTools device emulation, or open the page
on a real phone with --lan. Force a version any time with ?view=mobile
or ?view=desktop.

Default: koi bhi host (localhost, LAN IP, adb reverse, VS Code tunnel, ngrok)
mobile page inline serve karta hai -- kyunki in URLs ka koi m. sibling nahi hota.
Production jaisa 302 flow chahiye to --mdot do, aur /etc/hosts mein
m.local.zentallio.com daal lo. m.<host> par aayi request hamesha mobile deti hai.
"""

import os
import re
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

# ---------------------------------------------------------------- mobile
# middleware.js se hi padhte hain -- list do jagah maintain nahi karni padti.
MOBILE_UA = re.compile(
    r"iPhone|iPod|Android.*Mobile|Windows Phone|BlackBerry|BB10|Opera Mini|IEMobile",
    re.I)


def load_mobile_ready():
    mw = os.path.join(ROOT, "middleware.js")
    if not os.path.isfile(mw):
        return set()
    src = open(mw, encoding="utf-8").read()
    block = re.search(r"MOBILE_READY:START(.*?)MOBILE_READY:END", src, re.S)
    if not block:
        return set()
    return set(re.findall(r"'([^']+)'", block.group(1)))


MOBILE_READY = load_mobile_ready()

# --mdot: production jaisa 302 flow (m.<host>). Default off, kyunki tunnel aur
# LAN URLs ka koi m. sibling nahi hota.
MDOT_REDIRECT = False


def mobile_file_path(path):
    """URL path -> m/ ke andar ka path, bilkul middleware.js ki tarah."""
    return "/m/home" if path == "/" else "/m" + path


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

    # ---- mobile routing (middleware.js ka local version) ----

    def _cookies(self):
        raw = self.headers.get("Cookie") or ""
        out = {}
        for part in raw.split(";"):
            if "=" in part:
                k, _, v = part.partition("=")
                out[k.strip()] = v.strip()
        return out

    def _view_override(self):
        """?view=mobile / ?view=desktop -- UA ke bina test karne ke liye."""
        q = self.path.split("?", 1)[1] if "?" in self.path else ""
        m = re.search(r"(?:^|&)view=(mobile|desktop)", q)
        return m.group(1) if m else None

    def _route_mobile(self):
        """True = request handle ho gayi. Rewrite ke liye self.path badal deta hai."""
        path = self._clean_path()
        if path.startswith("/api/") or re.search(r"\.[A-Za-z0-9]+$", path):
            return False

        host = (self.headers.get("Host") or "").split(":")[0].lower()
        ready = path in MOBILE_READY
        override = self._view_override()
        cookie = self._cookies().get("zv")
        wants_desktop = override == "desktop" or (override is None and cookie == "desktop")
        wants_mobile = override == "mobile" or (override is None and cookie == "mobile")

        # --- m.<host> par request
        if host.startswith("m."):
            if wants_desktop or not ready:
                self._redirect_302("http://%s%s" % (host[2:] + self._port_suffix(), path))
                return True
            self._serve_as = "mobile"
            self.path = mobile_file_path(path) + self._query_suffix()
            return False

        ua = self.headers.get("User-Agent") or ""
        is_phone = wants_mobile or bool(MOBILE_UA.search(ua))
        if not ready or wants_desktop or not is_phone:
            return False

        # m.<host> par redirect sirf tab jab --mdot diya gaya ho AUR host ke
        # aage m. lagana maani rakhta ho. Warna mobile page inline serve karo --
        # localhost, LAN IP, adb reverse, VS Code tunnel, ngrok: sab chalte hain.
        # (Pehle ye har host par redirect karta tha, jo tunnel URLs tor deta tha.)
        if MDOT_REDIRECT and not self._is_ip(host) and host not in (
                "localhost", "127.0.0.1", "0.0.0.0", "::1"):
            self._redirect_302("http://m.%s%s" % (host + self._port_suffix(), path))
            return True

        self._serve_as = "mobile"
        self.path = mobile_file_path(path) + self._query_suffix()
        return False

    @staticmethod
    def _is_ip(host):
        return bool(re.fullmatch(r"\d{1,3}(\.\d{1,3}){3}", host))

    def _port_suffix(self):
        hostport = self.headers.get("Host") or ""
        return ":" + hostport.split(":")[1] if ":" in hostport else ""

    def _query_suffix(self):
        return "?" + self.path.split("?", 1)[1] if "?" in self.path else ""

    def _redirect_302(self, location):
        self.send_response(302)
        self.send_header("Location", location)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def _handle_common(self):
        """Redirects, mobile routing and API proxying. True = request done."""
        self._serve_as = "desktop"
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

        if self._route_mobile():
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
        self.send_header("Vary", "User-Agent")
        self.send_header("X-Zentallio-View", getattr(self, "_serve_as", "desktop"))
        super().end_headers()

    def log_message(self, fmt, *a):
        # kaun sa version gaya -- phone par test karte waqt yahi sab se
        # zyada kaam ka sawal hota hai
        tag = {"mobile": "[M]", "desktop": "[D]"}.get(getattr(self, "_serve_as", ""), "   ")
        sys.stderr.write("  %s %s\n" % (tag, fmt % a))


def api_is_up():
    try:
        with urllib.request.urlopen(API_ORIGIN + "/health", timeout=1) as r:
            return json.loads(r.read()).get("ok") is True
    except Exception:
        return False


def lan_ip():
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return None
    finally:
        s.close()


def main():
    global MDOT_REDIRECT
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    lan = "--lan" in sys.argv
    MDOT_REDIRECT = "--mdot" in sys.argv
    port = int(args[0]) if args else 8000

    handler = functools.partial(CleanUrlHandler, directory=ROOT)
    bind = "0.0.0.0" if lan else "127.0.0.1"
    server = ThreadingHTTPServer((bind, port), handler)

    print(f"\n  Zentallio dev server  →  http://localhost:{port}")
    print(f"  mobile pages          →  {len(MOBILE_READY)} paths routed from middleware.js")
    if lan:
        ip = lan_ip()
        if ip:
            print(f"  phone par kholo       →  http://{ip}:{port}")
        else:
            print(f"  LAN mode on (IP detect nahi hui)")
    else:
        print(f"  phone se test karna?  →  python3 dev-server.py {port} --lan")
    if api_is_up():
        print(f"  API                   →  {API_ORIGIN}  (connected)")
    else:
        print(f"  API                   →  not running")
        print(f"                           booking chat needs:  node api-server.js")
    print()
    if MDOT_REDIRECT:
        print(f"  m-dot mode            →  phone UA 302 -> m.<host>:{port}")
        print(f"                           /etc/hosts mein m.<host> hona chahiye")
    print(f"  Desktop UA            →  desktop version")
    print(f"  Phone UA / DevTools   →  mobile version (X-Zentallio-View header dekho)")
    print(f"  Force karna ho        →  ?view=mobile   ya   ?view=desktop")
    print("\n  Ctrl+C to stop\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  stopped\n")


if __name__ == "__main__":
    main()
