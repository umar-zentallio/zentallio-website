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

## Sector explorer

`food/food-beverage-solutions`, `fashion/sector-solutions` aur dus
`food/solutions/*` pages ka content poora inline JS (`SECTORS`, `SOLUTIONS`,
`FLAGSHIP`) mein rehta hai -- static HTML tقریباً khaali hoti hai.
`tools/jsdata.py` wo arrays parse karta hai aur generator unhein mobile
selector bana deta hai:

- upar **sticky pills** (har sector ka ek), neeche har sector ka apna panel
- panel mein wahi sab jo desktop dikhata hai: lede, stats, Iris ka quote,
  formats, "what Iris does here", "what runs here", sector ki solutions,
  menu mapping, live example
- `#sector=<id>` hash desktop ke sath compatible hai -- purane links chalte hain
- har `/food/solutions/<slug>` page **apne hi sector** par khulta hai

Naya sector ya field JS data mein add karo to `python3 tools/build_mobile.py`
chala dena kaafi hai -- panel khud ban jayega. Panel ka layout
`sector_panel()` mein hai, styling `m/mobile.css` ke section 22-24 mein.

### Banner (video background + upar content)

Har panel ke upar desktop jaisa banner hai -- video peeche chalti hai aur
content uske upar:

- eyebrow (`Sector 01 · Quick Service & Street Food`)
- **rotating headline + subline** (desktop par ye badalti rehti hain; mobile par
  bhi 5.2s par, aur tick dots se manually bhi chun sakte hain)
- stats rail (glassy tiles -- video par parhne ke liye)
- CTA buttons

Scrim (`.m-banner-vig`) laazmi hai -- chalti hui video par text warna parha
nahi jaata. Sector ka apna rang `--sec-tint` se aata hai.

Video source:

- food: `VIDBANNER[sector].embedded` -> `/food/media/<name>.mp4`
- fashion: `VIDEOS[sector.vid].src` -> `/fashion/assets/<name>.mp4`

Videos **share** hoti hain -- `m/` mein koi copy nahi. 19 clips = 17 MB, is liye
sab ek saath load nahi hote:

- `preload="none"` -- sirf khula hua panel apna clip load karta hai
- panel band hote hi `src` hat jaata hai (warna background mein buffer hote rehte hain)
- poster sirf active panel par `poster=`, baqi `data-poster=` mein (JS activate par set karta hai)
- posters `m/assets/` mein 900px par dobara banaye jaate hain (1.8 MB -> 960 KB)
- `prefers-reduced-motion` ya `saveData`/2G par sirf poster, koi clip nahi
- banner screen par na ho to clip chalta hi nahi aur rotation bhi ruk jaati hai
  (IntersectionObserver har `.m-banner` par lagta hai -- section par nahi, wo
  itna bada hai ke threshold kabhi poora nahi hota)

Naya clip add karna ho to desktop ke `VIDEOS`/`VIDBANNER` mein entry daalo --
mobile khud utha lega.


## Navbar

Poori website par ek hi navbar hai -- wahi jo home page par hai. Pehle 11
mukhtalif variants the (`header.top`, `div.zh-bar`, `nav.site-nav`,
`div.nav-row`, `nav.zmenu-nav` waghera).

```bash
python3 tools/unify_nav.py            # dry run
python3 tools/unify_nav.py --apply
```

Script idempotent hai -- dobara chalane se kuch double nahi hota.

**Classes `znav-` se namespace ki gayi hain.** `.top` aur `.brand` bohat aam
naam hain: `food/app/*.html` mein `.top` aur `.topbar` un demo screens ka apna
chrome hain, site navigation nahi. Namespacing ke bagair unka layout toot jaata.

**Kya replace hota hai:** asal site navigation (`header.top` + `.menu-ov`,
`div.zh-bar`, `nav.zmenu-nav`, `nav.site-nav`, `div.nav-row`).
**Kya nahi:** `div.top` / `div.topbar` (app demo ka title bar) aur
`div.ed-top-rule` (sirf ek decorative line).

`div.nav-row` wale article pages ka "Back to Resources" link bacha liya jaata
hai -- wo navbar ka hissa nahi, is liye alag element ban kar sath rehta hai.

### Spacer

Navbar `position:fixed` hai. Jin pages ka pehla block full-bleed hero hai,
wahan wo hero ke UPAR tairta hai (home jaisa). Baqi pages ko spacer chahiye,
warna pehli line navbar ke neeche chali jaati hai.

Ye list **andaze se nahi, browser mein naap kar** bani hai --
`tools/nav_spacer.json`. Naye page ke baad dobara naapna ho to har page render
kar ke dekho ke koi asli content `header.znav` ke band ke neeche to nahi.

`food/app/*` ke shells `position:fixed` / `height:100vh` hain -- unke liye
spacer bekaar hai, is liye unhe `znav-css` ke andar top-inset diya jaata hai.

### Mobile

Mobile shell wahi navbar dohraata hai: serif brand (wahi shine gradient),
circular bordered hamburger, aur overlay mein wahi 4 links (01-04) apne
rang ke dots ke sath + email. `shell_header()` in `tools/build_mobile.py`.


## Local testing

`dev-server.py` ab `middleware.js` ko emulate karti hai -- `MOBILE_READY` list
seedhi usi file se padhi jaati hai, is liye do jagah maintain nahi karni padti.

```bash
python3 dev-server.py             # http://localhost:8000
python3 dev-server.py 8000 --lan  # phone se test karne ke liye LAN par bhi
```

Har response par `X-Zentallio-View: mobile|desktop` header aata hai, aur
server har request ko terminal mein `[M]` ya `[D]` se nishaan-zada karta hai:

```
  [M] "GET /fashion/sector-solutions HTTP/1.1" 200 -
  [D] "GET /about HTTP/1.1" 200 -
```

Phone par test karte waqt sab se pehle yahi dekho. `[D]` aa raha ho magar
mobile chahiye, to do wajhaat mumkin hain: Chrome ka "Desktop site" toggle on
hai (wo desktop UA bhejta hai), ya `zv=desktop` cookie set hai. Dono ko
`?view=mobile` override kar deta hai.

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

### Overflow audit

`m/mobile.js` localhost par ek halka check karta hai (console mein
`[overflow] clean`), lekin wo sirf **mojooda** state dekhta hai.

Poora audit har state exercise karta hai -- har sector tab, sab accordions
khol kar, menu khula hua, chaar naapon par (320 / 360 / 414 / landscape):

```bash
python3 dev-server.py 8010 &
python3 tools/audit_mobile.py --port 8010
python3 tools/audit_mobile.py --port 8010 --width 320   # sirf ek naap
```

Do cheezein pakadta hai:

- **OUT** -- element page ki chaurai se bahar nikal raha hai
- **CLIP** -- element apne hi box ke andar content kaat raha hai (text cut off)

CLIP check tasdeeq karta hai ke koi **asli child** bahar nikal raha ho --
warna `.m-hero` ka decorative glow (`::before`, `min(150vw,560px)`) har page
par jhoota alarm deta hai.

UI badalne ke baad ye chalana zaroori hai: 60 pages x 264 states x 4 naap =
~1,056 states, chalne mein kuch minute lagte hain.
