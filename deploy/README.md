# nginx deployment — Zentallio website

The site is static HTML plus three API endpoints. nginx serves the pages and
reverse-proxies `/api/*` to a small Node process.

```
browser ──▶ nginx :443 ──┬──▶ static files      (/, /about, /fashion, …)
                         └──▶ 127.0.0.1:3001    (/api/chat, /api/book, /api/availability)
                                   │
                                   └── api-server.js  (systemd: zentallio-api)
```

**Why the Node process exists:** the handlers in `api/` were written for Vercel
and use `res.status().json()`, which plain Node does not have.
[`api-server.js`](../api-server.js) wraps them so they run unchanged — no
rewrite, no Express, **no npm install**. It only needs Node 18+ (`api/chat.js`
uses global `fetch`).

## Files

| File | Purpose |
|---|---|
| `../api-server.js` | Node server hosting the three API handlers |
| `nginx.conf` | site config — cleanUrls, redirects, proxy, caching |
| `zentallio-api.service` | systemd unit (auto-restart, hardened) |
| `deploy.sh` | rsync the site up and restart the API |

---

## 1. Server prerequisites

```bash
sudo apt update
sudo apt install -y nginx rsync

# Node 18+ — the distro package is often too old, so use NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v          # must be >= 18
which node       # note this path — you need it in step 4
```

## 2. Upload the site

```bash
sudo mkdir -p /var/www/zentallio
sudo chown -R $USER:$USER /var/www/zentallio
```

Then from your machine, in the repo root:

```bash
./deploy/deploy.sh user@your-server-ip
```

(First run will fail at the restart step — the service does not exist yet.
That is expected; continue to step 3.)

## 3. API keys

```bash
sudo mkdir -p /etc/zentallio
sudo nano /etc/zentallio/api.env
```

```ini
# Real Iris AI chat (optional — scripted fallback works without it)
ANTHROPIC_API_KEY=sk-ant-...
BOOKING_MODEL=claude-sonnet-5

# Cal.com — real availability + bookings; Cal.com sends the invite/email itself.
# Connect your Microsoft 365 calendar inside Cal.com first. See BOOKING.md.
CALCOM_API_KEY=cal_live_...
# Event type id defaults to 6503154 (baked in); only set this to override:
# CALCOM_EVENT_TYPE_ID=6503154
# or separate event types per kind:
# CALCOM_EVENT_ID_WALKTHROUGH=6503154
# CALCOM_EVENT_ID_CALL=6503155

# Contact form -> Google Sheet (api/lead.js). See the service-account setup
# notes in the repo's own .env template for how to get these three values.
GOOGLE_SHEET_ID=1am5C51B_lfQIWp1aGdhYCxXpXobhD2GAn_1IVYStHdU
GOOGLE_SERVICE_ACCOUNT_EMAIL=...@....iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Radar CRM (Frappe CRM at pm.lucrumerp.com) — Iris pushes qualified leads into
# the CRM Lead pipeline. Without the key/secret this is a safe no-op (logs only).
# Create an API key/secret in Radar: User menu -> Settings -> API Access.
RADAR_URL=https://pm.lucrumerp.com
RADAR_API_KEY=...
RADAR_API_SECRET=...
RADAR_LEAD_DOCTYPE=CRM Lead
RADAR_LEAD_SOURCE=Website
```

No separate email service is needed — Cal.com emails both parties. Full
step-by-step (Cal.com account, calendar connect, event type, keys) is in
`BOOKING.md`.

```bash
sudo chown root:www-data /etc/zentallio/api.env
sudo chmod 640 /etc/zentallio/api.env
```

Without `ANTHROPIC_API_KEY` the booking assistant still works — `api/chat.js`
falls back to a scripted flow. Check which mode is live with
`curl localhost:3001/health` → `{"ok":true,"ai":true}`.

## 4. API service

```bash
sudo cp /var/www/zentallio/deploy/zentallio-api.service \
        /etc/systemd/system/zentallio-api.service
```

**Check the `ExecStart` path** against the `which node` output from step 1 —
if Node is not at `/usr/bin/node`, edit it. systemd does not use your shell's
PATH, so a bare `node` (or an nvm install under `~/.nvm`) will not be found.

```bash
sudo chown -R www-data:www-data /var/www/zentallio
sudo systemctl daemon-reload
sudo systemctl enable --now zentallio-api
sudo systemctl status zentallio-api      # should be active (running)
curl localhost:3001/health               # {"ok":true,"ai":true}
```

## 5. nginx

Edit `server_name` in `nginx.conf` to your real domain first, then:

```bash
sudo cp /var/www/zentallio/deploy/nginx.conf \
        /etc/nginx/sites-available/zentallio
sudo ln -s /etc/nginx/sites-available/zentallio /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default    # drop the "Welcome to nginx" page

sudo nginx -t          # MUST pass before reloading
sudo systemctl reload nginx
```

## 6. HTTPS

Point the domain's A record at the server, wait for DNS, then:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d zentallio.com -d www.zentallio.com
```

certbot edits the config in place: adds the 443 block, the certificate paths,
and an http→https redirect. Renewal is automatic via a systemd timer —
verify with `sudo certbot renew --dry-run`.

## 7. Firewall

```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
```

Port 3001 stays closed — `api-server.js` binds to `127.0.0.1` only, so it is
reachable through nginx and nothing else.

---

## Verify

```bash
for p in / /about /contact /fashion /food-beverage /meet-iris \
         /privacy /terms /cookies /fashion/sector-solutions; do
  printf "%-30s %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code}' https://zentallio.com$p)"
done

curl -s https://zentallio.com/api/availability | head -c 200
curl -s -X POST https://zentallio.com/api/chat \
     -H 'content-type: application/json' \
     -d '{"messages":[{"role":"user","content":"I want a call"}]}'

curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' https://zentallio.com/about/   # 301 → /about
curl -s -o /dev/null -w '%{http_code}\n' https://zentallio.com/vercel.json              # 403
```

All pages `200`, `/about/` redirects, `vercel.json` blocked.

## Updating the site later

```bash
./deploy/deploy.sh user@your-server-ip
```

## Troubleshooting

| Symptom | Cause |
|---|---|
| `502 Bad Gateway` on `/api/*` | API down — `sudo systemctl status zentallio-api`, `sudo journalctl -u zentallio-api -n 50` |
| API service won't start | Wrong `ExecStart` node path in the unit file (step 4) |
| `/about` gives 404 | `try_files $uri.html …` missing, or webroot path wrong |
| `/fashion` shows a file listing | `$uri.html` must come **first** in `try_files` — a `fashion/` directory exists alongside `fashion.html` |
| Chat replies but ignores the AI | `ANTHROPIC_API_KEY` not reaching the process — check `/health`, then `sudo systemctl show zentallio-api -p Environment` |
| Chat times out | `proxy_read_timeout` too low; the Claude tool loop can take up to 6 hops |
| Edits don't show up | Browser cache — assets are sent with `expires 30d` |

## Local testing

The site cannot be opened over `file://` — links like `/about` are
root-absolute and the browser resolves them against your disk root. Run two
processes, in two terminals:

```bash
node api-server.js          # terminal 1 — API on :3001
python3 dev-server.py       # terminal 2 — site on :8000
```

Then open **http://localhost:8000** only. `dev-server.py` proxies `/api/*` to
:3001, so the browser talks to one origin — the same shape as nginx in
production. You never open :3001 directly.

The API is optional: without it the pages all render fine and the dev server
returns a clear `api_unreachable` message instead of a confusing 404. Only the
booking chat needs it.

`dev-server.py` is dev-only and is excluded from deploys.
