# Deploy brief — Booking feature ("Book a walkthrough / call")

**For:** whoever manages the server + git
**Site:** zentallio.com (nginx, static files from a git clone on `main`)
**Status:** code is merged to `main`. Two tasks below: (1) pull the code, (2) run the small booking API service so real Cal.com bookings work.

---

## What changed
A booking widget now backs every "Book a walkthrough" / "Book a call with our consultant" CTA site-wide (chat + quick form, with a visitor timezone picker). It talks to three tiny serverless-style endpoints under `/api/*`, which are served by a small dependency-free Node process (`api-server.js`). nginx serves the static site as today and just proxies `/api/*` to that process.

- New files: `booking.js`, `booking.css`, `lib/booking-core.js`, `api/*.js`, `api-server.js`, `deploy/*`.
- No build step, no npm dependencies. **Node 18+ required** (uses built-in `fetch`).
- Without the API service, the widget still renders but uses demo slots. With it + a Cal.com key, bookings are real (Cal.com sends the invite/email + video link).

---

## Task 1 — Deploy the code
On the server, in the site's repo:
```bash
cd <REPO>            # nginx web root, the existing git clone
git checkout main
git pull origin main
```
That alone makes the widget appear. Hard-refresh a page (e.g. /food-beverage) to confirm the "Book a walkthrough" button opens a modal.

## Task 2 — Run the booking API + wire the Cal.com key

**Prereq:** `node -v` ≥ 18. If missing, install Node 18+ first.

**2a. Store secrets** (root-owned, not in the repo):
```bash
sudo mkdir -p /etc/zentallio
sudo tee /etc/zentallio/api.env >/dev/null <<'ENV'
CALCOM_API_KEY=__CAL_KEY_HERE__
# optional (real AI chat; omit for scripted fallback):
# ANTHROPIC_API_KEY=__ANTHROPIC_KEY_HERE__
ENV
sudo chown root:www-data /etc/zentallio/api.env
sudo chmod 640 /etc/zentallio/api.env
```
> The Cal.com key will be sent to you separately (a `cal_live_...` string). Do **not** commit it or paste it into chat/tickets.

**2b. Install the systemd service:**
```bash
sudo cp <REPO>/deploy/zentallio-api.service /etc/systemd/system/zentallio-api.service
sudoedit /etc/systemd/system/zentallio-api.service
```
Edit three lines to match this box:
- `WorkingDirectory=<REPO>`
- `ExecStart=<full path to node> <REPO>/api-server.js`   (`which node` for the path)
- `ReadOnlyPaths=<REPO>`

Start it:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now zentallio-api
curl -s localhost:3001/health        # expect {"ok":true,"ai":false}   (ai:true if Anthropic key set)
```

**2c. Proxy `/api` in nginx** — add inside the zentallio.com `server { … }` block:
```nginx
location ^~ /api/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_read_timeout 120s;
}
```
(Full reference: `deploy/nginx.conf`.) Then:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

## Verify
```bash
curl -s https://zentallio.com/api/availability | head -c 120   # JSON slots, not 404/HTML
```
Then on the site: **Book a walkthrough → pick a slot → Confirm** → invite/email should arrive from Cal.com.

---

## Notes
- **Cal.com account prerequisites** (already set up by the marketing owner, just confirm): the Microsoft 365 / Outlook calendar is connected in Cal.com, and event type `6503154` has a video location + availability. Event id is baked into the code; override only via `CALCOM_EVENT_TYPE_ID` in `api.env` if needed.
- **Updates later:** `git pull` on `main`, then `sudo systemctl restart zentallio-api`.
- **Logs / troubleshooting:** `journalctl -u zentallio-api -e`. More detail + a troubleshooting table in `deploy/README.md`.
- **Rollback:** stop the service (`sudo systemctl disable --now zentallio-api`) and the site returns to static-only; the widget falls back to demo slots.
