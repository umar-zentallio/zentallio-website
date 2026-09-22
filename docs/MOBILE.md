# Mobile site (m.zentallio.com)

Desktop aur mobile ka code **isi repo** mein hai, **ek hi Vercel project** par.
Mobile pages `m/` folder mein hain; `api/`, `lib/`, CSS/JS/images dono share karte hain.

```
middleware.js        device + host routing (sab se pehle chalta hai)
m/                   mobile pages  (generated -- haath se edit mat karo)
m/home.html          root page (m.zentallio.com/) -- index.html nahi
m/mobile.css         mobile design system  (yahan edit karo)
m/mobile.js          menu, reveal, counters, version switch
m/assets/            base64 se nikali gayi images (auto, 1200px tak resize)
tools/build_mobile.py    desktop -> m/ generator
tools/check_mobile.py    content diff (kya kuch gum to nahi gaya)
tools/jsdata.py          inline JS arrays ka parser
tools/link_mobile_seo.py desktop pages par canonical + alternate tags
```

## Rozana ka kaam

Desktop page badla? Mobile dobara generate karo:

```bash
python3 tools/build_mobile.py              # sab pages + middleware ki list update
python3 tools/build_mobile.py about.html   # sirf ek page (middleware nahi chhedta)
```

Phir tasdeeq:

```bash
python3 tools/check_mobile.py $(find . -name '*.html' -not -path './.git/*' \
    -not -path './m/*' -not -name 'cookie-banner.html' -printf '%P\n')
```

`words 100%` ka matlab desktop ka poora text mobile par mojood hai.
99% se neeche jaye to `-v` laga kar dekho kya gaya.

## Ahem usool

- **`m/*.html` kabhi haath se edit mat karo** -- agli build usay mita degi.
  Layout theek karna ho to `m/mobile.css` ya generator badlo.
- **Naya desktop page** banaya? `python3 tools/build_mobile.py` chala do --
  `middleware.js` ki `MOBILE_READY` list khud update ho jaati hai.
  Jo path us list mein nahi, wo mobile par desktop version dikhayega (404 nahi).
- **Overflow** -- `m/mobile.css` ka section 2 isay structurally rokta hai
  (`min-width:0`, `overflow-wrap:anywhere`, `overflow-x:clip`). Naya CSS likhte
  waqt fixed `width` ke bajaye `max-width` istemal karo.
- **SEO** -- naya page banane ke baad `python3 tools/link_mobile_seo.py --apply`
  chala do (idempotent hai), aur `sitemap.xml` mein entry + `xhtml:link` daalo.

## Deploy

Vercel par ek dafa ka setup:

1. Project → Settings → Domains → Add `m.zentallio.com`
   (redirect **mat** choose karna -- normal domain rehne do)
2. DNS: `CNAME  m  →  cname.vercel-dns.com`
3. `npm install` chalega kyunki `package.json` mein `@vercel/edge` hai

Agar deploy par ESM error aaye to `middleware.js` ko `middleware.ts` rename kar do.
`api/*.js` CommonJS hi rehne dena.

## Local testing

`dev-server.py` ab `middleware.js` ko emulate karti hai -- `MOBILE_READY` list
seedhi usi file se padhi jaati hai, is liye do jagah maintain nahi karni padti.

```bash
python3 dev-server.py             # http://localhost:8000
python3 dev-server.py 8000 --lan  # phone se test karne ke liye LAN par bhi
```

Har response par `X-Zentallio-View: mobile|desktop` header aata hai -- DevTools
ke Network tab mein dekh lo ke kaun sa version mila.

### Teen tareeqe

**1. DevTools device emulation (sab se aasan)**

Chrome DevTools -> Ctrl+Shift+M -> koi phone chuno -> reload.
Mobile UA jaate hi `localhost:8000` mobile version serve karega (redirect nahi,
kyunki `m.localhost` nahi hota).

**2. URL se force karo (UA badle bagair)**

```
http://localhost:8000/about?view=mobile
http://localhost:8000/about?view=desktop
```

**3. Asli phone par (sab se behtar)**

*Same wifi par -- LAN IP se:*

```bash
python3 dev-server.py 8000 --lan
```

Server jo LAN IP print kare (jaise `http://192.168.1.42:8000`) wo phone mein kholo.

*USB cable se -- Android, adb reverse:*

```bash
adb reverse tcp:8000 tcp:8000     # phone ka localhost:8000 -> laptop ka 8000
python3 dev-server.py             # --lan ki zaroorat nahi
```

Phir phone par seedha `http://localhost:8000` kholo. Wifi ki zaroorat nahi, aur
`--lan` bhi nahi chahiye kyunki adb loopback (127.0.0.1) par hi connect karta hai.

iPhone par `adb` nahi hota -- LAN IP ya koi tunnel (VS Code port forwarding,
ngrok) istemal karo. Tunnel URLs bhi chalte hain: har aisa host mobile page
inline serve karta hai.

### Production-jaisa host flow (302 redirects ke sath)

`/etc/hosts` mein ye line daalo:

```
127.0.0.1  local.zentallio.com  m.local.zentallio.com
```

Phir `--mdot` ke sath server chalao:

```bash
python3 dev-server.py 8000 --mdot
```

`http://local.zentallio.com:8000` kholo -- phone UA par wo
`m.local.zentallio.com:8000` par 302 karega, bilkul production ki tarah.

`--mdot` ke bagair koi redirect nahi hota aur mobile page inline milta hai.
Ye jaan-boojh kar hai: localhost, LAN IP, adb reverse aur tunnel URLs ka koi
`m.` sibling nahi hota, is liye un par redirect karna toot-ta hai.

### Overflow check

`m/mobile.js` localhost par khud overflow check karta hai --
browser console mein `[overflow] clean ` aana chahiye.
