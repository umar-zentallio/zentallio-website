# Deploy — zentallio.com + m.zentallio.com

## Hosting: apna VPS, Vercel nahi

Site Hetzner box par chalti hai (`135.181.228.217`), nginx + pm2 ke sath:

```
        zentallio.com ─┐
      www.zentallio.com├─→  nginx  ──→  /var/www/zentallio   (static pages)
      m.zentallio.com ─┘        └────→  127.0.0.1:3001       (api-server.js, pm2)
```

Mobile **alag domain** par hai magar **wahi server, wahi webroot, wahi API**.
Pages `m/` folder se serve hote hain; URL nahi badalta.

> Repo mein `middleware.js`, `vercel.json` aur `@vercel/edge` bhi maujood hain.
> Wo Vercel ke liye likhe gaye the aur **is setup mein nahi chalte** -- nginx
> Edge Middleware nahi jaanta. Asal routing `deploy/zentallio-nginx-live.conf`
> mein hai. Vercel wali files sirf tab kaam ki hain agar kabhi Vercel par
> jaayein; warna hata bhi sakte hain.

---

## 1. Local par build + verify

```bash
python3 tools/build_mobile.py                  # m/ dobara banao
python3 dev-server.py 8010 &
python3 tools/audit_mobile.py --port 8010      # overflow audit
python3 tools/check_mobile.py $(find . -name '*.html' -not -path './.git/*' \
    -not -path './m/*' -not -path './tools/*' -not -name 'cookie-banner.html' -printf '%P\n')
```

---

## 2. DNS  ✅ ho chuka

Namecheap par pehle se lag chuka hai:

```
A   @     135.181.228.217
A   m     135.181.228.217
A   www   135.181.228.217
```

`m` ka A record wahi IP par hai -- yahi chahiye tha.

---

## 3. Files server par bhejo

```bash
./deploy/deploy.sh erp@135.181.228.217
```

rsync `--delete` ke sath chalti hai, `.env` / `.git` / `node_modules` chhod kar.
`m/` folder khud chala jaata hai. Phir pm2 API restart karti hai.

---

## 4. nginx config lagao

```bash
ssh erp@135.181.228.217

sudo cp /var/www/zentallio/deploy/zentallio-nginx-live.conf \
        /etc/nginx/sites-enabled/zentallio
sudo nginx -t                    # PEHLE test, phir reload
sudo systemctl reload nginx
```

`nginx -t` pass hona zaroori hai. Fail ho to reload mat karo -- purana config
chalta rahega.

Nayi config mein kya hai:

- `map` blocks: user-agent + `zv` cookie se faisla
- apex par: phone ho aur us page ka mobile version maujood ho to
  `302 -> m.zentallio.com`
- `m.zentallio.com` ka apna server block: `m/<path>.html` serve karta hai
- jo page `m/` mein nahi, ya jis user ne "Desktop site" chuna -- wapas apex par
- `/api/` aur assets dono hosts par seedha serve hote hain, kabhi redirect nahi

**Page list kahin hardcoded nahi.** nginx `-f` se dekh leta hai ke
`m/<path>.html` hai ya nahi, is liye naya page add karne par ye file chhedni
nahi parti.

---

## 5. SSL for m.zentallio.com

```bash
sudo certbot --nginx -d m.zentallio.com
```

Config mein cert ke paths pehle se likhe hain. Agar certbot se pehle
`nginx -t` chalaya aur cert file na hone ki wajah se fail ho, to pehle
certbot chala lo -- wo khud block bana leta hai.

Renewal test:

```bash
sudo certbot renew --dry-run
```

---

## 6. Verify

```bash
# desktop UA -> desktop
curl -sI -A "Mozilla/5.0 (X11; Linux x86_64) Chrome/131" https://zentallio.com/ | head -1

# iPhone UA -> 302 to m.
curl -sI -A "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile/15E148" \
  https://zentallio.com/ | grep -i location

# m. root -> 200 aur mobile CSS
curl -sI https://m.zentallio.com/ | head -1
curl -s  https://m.zentallio.com/ | grep -o '/m/mobile.css'

# jo page mobile par nahi -> wapas apex (404 nahi)
curl -sI https://m.zentallio.com/nope | grep -i location

# cookie se desktop chunna
curl -sI -H "Cookie: zv=desktop" \
  -A "Mozilla/5.0 (iPhone) Mobile" https://zentallio.com/ | head -1

# assets aur API dono hosts par
curl -sI https://m.zentallio.com/booking.css | head -1
curl -sI https://m.zentallio.com/api/availability | head -1

# API zinda hai?
ssh erp@135.181.228.217 "curl -fsS http://127.0.0.1:3001/health"
```

Loop ka test (sab se ahem): phone se `zentallio.com` kholo -- ek hi redirect
hona chahiye, `m.zentallio.com` par ruk jaana chahiye.

---

## 7. Deploy ke baad

- **Google Search Console**: `m.zentallio.com` alag property add karo
- `sitemap.xml` ki 34 entries par mobile `xhtml:link` lag chuka hai
- GTM (`GTM-KZQGBF9K`) 121 pages par hai (61 desktop + 60 mobile)

---

## Naya page add karne ke baad

```bash
python3 tools/build_mobile.py           # mobile page banao
python3 tools/unify_nav.py --apply      # navbar
python3 tools/add_gtm.py --apply        # GTM
python3 tools/link_mobile_seo.py --apply
python3 tools/audit_mobile.py --port 8010
./deploy/deploy.sh erp@135.181.228.217
```

nginx config dobara chhedne ki zaroorat nahi -- wo filesystem se khud dekh
leta hai.

---

## Troubleshooting

**Redirect loop (ERR_TOO_MANY_REDIRECTS)**
Matlab apex phone ko `m.` bhej raha hai magar `m.` wapas apex bhej raha hai.
Wajah hamesha ek hi hoti hai: `m/<path>.html` server par maujood nahi.
Check: `ssh ... "ls /var/www/zentallio/m/home.html"`. Agar nahi, to rsync
`m/` nahi le gaya -- `deploy.sh` dobara chalao.

**m.zentallio.com par 404**
Root `m/home.html` se serve hota hai, `m/index.html` se nahi.
`ls /var/www/zentallio/m/home.html`

**Mobile par desktop aa raha hai** -- isi tarteeb se:
1. Chrome ka "Desktop site" toggle on hai (desktop UA bhejta hai)
2. `zv=desktop` cookie set hai (footer ke link se)
3. `m/<path>.html` server par nahi

**API 502**
`ssh ... "pm2 describe zentallio-api"` aur
`ssh ... "curl -fsS http://127.0.0.1:3001/health"`.
Keys `/etc/zentallio/api.env` mein hain, repo ke `.env` mein nahi.
