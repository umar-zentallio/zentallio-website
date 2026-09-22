#!/usr/bin/env python3
"""Desktop pages -> m/ mobile pages.

Har desktop page ka poora content mobile par aata hai; sirf layout naya hai.
Desktop chrome (header, menu overlay, footer, cookie banner) hata kar mobile
shell lagayi jaati hai, aur content ko mobile blocks mein dobara render kiya
jaata hai -- single column, kahin overflow nahi.

    python3 tools/build_mobile.py            # sab pages
    python3 tools/build_mobile.py index.html # sirf ek
"""
import os, re, sys, json, base64, hashlib, html as htmllib
from bs4 import BeautifulSoup, NavigableString, Tag, Comment

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jsdata import find_array

ROOT   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTDIR = os.path.join(ROOT, 'm')
ASSETS = os.path.join(OUTDIR, 'assets')
BASE   = 'https://zentallio.com'
MBASE  = 'https://m.zentallio.com'

SKIP_FILES = {'cookie-banner.html'}          # page nahi, component hai

# ---------------------------------------------------------------- accents
ACCENT = [
    (re.compile(r'^fashion'),              'violet'),
    (re.compile(r'^resources/(apparel|fabric|footwear|kids|sportswear|cosmetics|ethnic)'), 'violet'),
    (re.compile(r'^food'),                 'teal'),
    (re.compile(r'^(privacy|terms|cookies|data-processing)'), 'amber'),
]
def accent_for(rel):
    for rx, name in ACCENT:
        if rx.search(rel):
            return name
    return 'teal'

# ------------------------------------------------------- chrome to strip
DROP_SEL = [
    'header.top', 'header.zhero > .zhero-nav', 'nav.site-nav', 'div.menu-ov',
    'button.menu-btn', 'footer.zfoot', 'div.zck', '#zckBanner', 'div.progress',
    'div.nav-row', 'header.site-header', '.zh-bar', '.zmenu', '.zmenu-nav',
    '.zhero-nav', '.menu-foot',
]
# purely decorative -- inka koi text content nahi hota
DECOR_RX = re.compile(
    r'\b(glow|seam|spark|orb|grain|noise|halo|aurora|particle|blob|ring|beam|'
    r'gradient|bg-|backdrop|deco|ornament|vignette|scanline|cursor|caret|'
    r'zf-dots|zf-prog|zf-sep|dot|progress|scroll-hint|scrollhint|hint|marquee|ticker|shimmer|pulse|wash|spot|ghost-?\w*)\b')

CTA_RX  = re.compile(r'\b(btn|cta|button|pill-cta|hcta|book|action)\b', re.I)
KICK_RX = re.compile(r'\b(eyebrow|peyebrow|kick|kicker|ck|label|tag|badge|eb|'
                     r'overline|micro|meta)\b')

BLOCK_TAGS = {'p','h1','h2','h3','h4','h5','h6','ul','ol','table','blockquote',
              'pre','figure','img','dl'}

# ---------------------------------------------------------------- shell
SOCIALS = [
 ('https://www.linkedin.com/company/zentallioai/','LinkedIn','M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z'),
 ('https://x.com/Zentallio','X','M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932 5.664-6.933zm-1.291 19.482h2.039L6.486 3.24H4.298l13.312 17.395z'),
 ('https://www.instagram.com/zentallio/','Instagram','M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.336 3.608 1.311.975.975 1.249 2.242 1.311 3.608.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.062 1.366-.336 2.633-1.311 3.608-.975.975-2.242 1.249-3.608 1.311-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.366-.062-2.633-.336-3.608-1.311-.975-.975-1.249-2.242-1.311-3.608C2.175 15.784 2.163 15.404 2.163 12s.012-3.584.07-4.85c.062-1.366.336-2.633 1.311-3.608.975-.975 2.242-1.249 3.608-1.311C8.416 2.175 8.796 2.163 12 2.163zM12 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z'),
 ('https://www.facebook.com/people/ZentallioAi/61589720611365/','Facebook','M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z'),
 ('https://www.threads.com/@zentallio','Threads','M16.7 11.13c-.1-.05-.2-.09-.31-.14-.18-3.28-1.97-5.16-4.98-5.18h-.04c-1.8 0-3.29.77-4.21 2.16l1.65 1.14c.69-1.04 1.77-1.26 2.56-1.26h.03c.98.01 1.72.29 2.2.84.35.4.59.96.71 1.66a13.1 13.1 0 00-2.85-.14c-2.87.17-4.72 1.84-4.6 4.17.06 1.18.65 2.2 1.66 2.86.85.56 1.95.83 3.09.77 1.51-.08 2.69-.66 3.52-1.71.63-.8 1.03-1.83 1.21-3.13.73.44 1.27 1.01 1.57 1.7.51 1.17.54 3.08-1.02 4.64-1.37 1.36-3.01 1.95-5.51 1.97-2.77-.02-4.87-.91-6.23-2.64C4.68 17.15 4.02 14.84 4 12c.02-2.84.68-5.15 1.95-6.86C7.31 3.41 9.41 2.52 12.18 2.5c2.79.02 4.92.91 6.33 2.65.69.85 1.21 1.92 1.56 3.17l1.94-.52c-.42-1.53-1.08-2.85-1.97-3.94C18.25 1.65 15.63.52 12.19.5h-.01C8.74.52 6.15 1.66 4.4 3.87 2.85 5.84 2.05 8.58 2.02 12v.01c.03 3.42.83 6.16 2.38 8.13C6.15 22.34 8.74 23.48 12.18 23.5h.01c3.06-.02 5.21-.82 6.98-2.59 2.32-2.31 2.25-5.21 1.49-6.98-.55-1.27-1.6-2.3-3.04-2.98l.08.18zm-4.62 5.11c-1.26.07-2.57-.49-2.63-1.71-.05-.9.64-1.91 2.71-2.03.24-.01.47-.02.7-.02.75 0 1.46.07 2.1.21-.24 2.98-1.64 3.49-2.88 3.55z'),
]
TEL_SVG = ('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 '
           '6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 '
           '1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.24.2 2.45.57 3.57.11.35'
           '.03.74-.25 1.02l-2.2 2.2z"/></svg>')

NAV = [('01','Food &amp; Beverage','/food-beverage'),
       ('02','Fashion Retail','/fashion'),
       ('03','Meet Iris','/meet-iris'),
       ('04','Resources','/resources'),
       ('05','About','/about'),
       ('06','Contact','/contact')]

def shell_header():
    items = '\n'.join(
        '    <a class="m-menu-item" href="%s"><i>%s</i><span>%s</span></a>' % (h, n, t)
        for n, t, h in NAV)
    return f'''<header class="m-head">
  <a class="m-brand" href="/">Zentallio</a>
  <button class="m-burger" id="mBurger" aria-label="Menu" aria-expanded="false" aria-controls="mMenu">
    <span></span><span></span><span></span>
  </button>
</header>
<div class="m-menu" id="mMenu" aria-hidden="true">
  <nav>
{items}
  </nav>
  <div class="m-menu-foot">
    <a href="mailto:info@zentallio.com">info@zentallio.com</a>
    <a href="tel:+923270000901">+92 327 0000901</a>
  </div>
</div>'''

def shell_footer(desktop_url):
    soc = '\n'.join(
        '  <a href="%s" target="_blank" rel="noopener" aria-label="Zentallio on %s">'
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="%s"/></svg></a>' % s
        for s in SOCIALS)
    return f'''<footer class="m-foot">
<a class="m-foot-name" href="/">Zentallio</a>
<p class="m-foot-tag">AI-driven retail intelligence for Food &amp; Beverage and Fashion Retail — one agent, Iris, reading every signal and deciding across every floor.</p>
<div class="m-foot-contact">
  <a href="https://maps.google.com/?q=142-C%20D.H.A.%20Commercial%20Broadway%20DHA%20Phase%208%20Lahore%2054940" target="_blank" rel="noopener">142-C, D.H.A. Commercial Broadway, DHA Phase 8, Lahore 54940</a>
  <a href="tel:+923270000901">{TEL_SVG}+92 327 0000901</a>
  <a href="tel:+19294192694">{TEL_SVG}+1 929 419 2694</a>
  <a class="m-foot-mail" href="mailto:info@zentallio.com">info@zentallio.com</a>
</div>
<div class="m-foot-social">
{soc}
</div>
<div class="m-foot-cols">
  <div><h4>Product</h4><a href="/food/food-beverage-solutions">Food &amp; Beverage</a><a href="/fashion/sector-solutions">Fashion Retail</a><a href="/meet-iris">Meet Iris</a></div>
  <div><h4>Company</h4><a href="/about">About</a><a href="/contact">Contact</a><a href="/resources">Resources</a></div>
  <div><h4>Legal</h4><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/cookies">Cookies</a></div>
</div>
<a class="m-foot-switch" href="{desktop_url}" data-view="desktop">Desktop site &rarr;</a>
<div class="m-foot-bot">&copy; 2026 Zentallio. All rights reserved.</div>
</footer>'''


# ===========================================================================
#  Extraction
# ===========================================================================
KEEP_ATTR = {'href','src','alt','aria-label','datetime','target','rel','type',
             'name','placeholder','value','for','id','colspan','rowspan'}

def esc(t):
    return (t.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')
             .replace('"','&quot;'))

def txt(node):
    return re.sub(r'\s+', ' ', node.get_text(' ', strip=True)) if node else ''

def classes(tag):
    c = tag.get('class')
    return ' '.join(c) if c else ''

def is_decor(tag):
    """Text-less decorative element -- mobile par iski koi zaroorat nahi."""
    if tag.name in ('canvas','style','script','noscript','template','svg','path','defs'):
        return True
    if not txt(tag) and tag.name not in ('img','input','textarea','select','br','hr'):
        return True
    if DECOR_RX.search(classes(tag)) and len(txt(tag)) < 3:
        return True
    return False

def inline_html(tag):
    """Inline markup (b/i/strong/em/a/code) rakho, baqi attributes phenk do."""
    out = []
    for n in tag.children:
        if isinstance(n, NavigableString):
            out.append(esc(str(n)))
        elif isinstance(n, Tag):
            if n.name in ('svg','canvas','script','style'):
                pass
            elif n.name in ('br',):
                out.append('<br>')
            elif not txt(n) and n.name not in ('img','input','hr'):
                # khaali <i>/<span> sirf CSS separator hai -- yahan space ban jaye
                out.append(' ')
            elif n.name == 'a' and n.get('href'):
                h = inline_html(n)
                if h: out.append(' <a href="%s">%s</a> ' % (esc(n['href']), h))
            elif n.name in ('strong','b'):
                h = inline_html(n)
                if h: out.append(' <strong>%s</strong> ' % h)
            elif n.name in ('em','i'):
                h = inline_html(n)
                if h: out.append(' <em>%s</em> ' % h)
            elif n.name == 'code':
                h = inline_html(n)
                if h: out.append(' <code>%s</code> ' % h)
            elif n.name in ('sup','sub','small','u','mark','time'):
                h = inline_html(n)
                if h: out.append(' ' + h + ' ')
            else:
                # baqi sab container-jaise hain -- inke darmiyan space zaroori hai
                # warna "Cash & runway" + "Bank accounts" = "runwayBank" ban jaata hai
                h = inline_html(n)
                if h:
                    out.append(' ' + h + ' ')
    h = ''.join(out)
    for _ in range(3):
        h2 = re.sub(r'<(strong|em|code|a)\b[^>]*>\s*</\1>', '', h)
        if h2 == h:
            break
        h = h2
    h = re.sub(r'\s*<br>\s*', '<br>', h)
    h = re.sub(r'[ \t]+', ' ', h)
    h = re.sub(r'\s+([.,;:!?%)\]])', r'\1', h)
    h = re.sub(r'([(\[€$])\s+', r'\1', h)
    return h.strip()

def clean_list(tag):
    items = []
    for li in tag.find_all('li', recursive=False):
        h = inline_html(li)
        if h:
            items.append('  <li>%s</li>' % h)
    if not items:
        return ''
    return '<%s>\n%s\n</%s>' % (tag.name, '\n'.join(items), tag.name)

def clean_table(tag):
    rows = []
    for tr in tag.find_all('tr'):
        cells = []
        for td in tr.find_all(['td','th'], recursive=False):
            span = ''
            if td.get('colspan'): span += ' colspan="%s"' % esc(td['colspan'])
            cells.append('<%s%s>%s</%s>' % (td.name, span, inline_html(td), td.name))
        if cells:
            rows.append('    <tr>%s</tr>' % ''.join(cells))
    if not rows:
        return ''
    return '<div class="m-tablewrap"><table>\n%s\n</table></div>' % '\n'.join(rows)

def clean_img(tag, assets):
    src = tag.get('src') or tag.get('data-src') or ''
    if src.startswith('data:image'):
        src = save_data_uri(src, assets)
        if not src:
            return ''
    if not src:
        return ''
    alt = esc(tag.get('alt') or '')
    return '<img src="%s" alt="%s" loading="lazy" decoding="async">' % (esc(src), alt)

def save_data_uri(uri, assets):
    """Inline base64 ko file bana do -- mobile par 470KB ka data URI zulm hai."""
    m = re.match(r'data:image/([a-zA-Z0-9.+-]+);base64,(.+)$', uri, re.S)
    if not m:
        return ''
    ext = m.group(1).lower().replace('svg+xml','svg').replace('jpeg','jpg')
    try:
        raw = base64.b64decode(m.group(2))
    except Exception:
        return ''
    name = hashlib.sha1(raw).hexdigest()[:14] + '.' + ext
    os.makedirs(assets, exist_ok=True)
    p = os.path.join(assets, name)
    if not os.path.exists(p):
        with open(p, 'wb') as fh:
            fh.write(raw)
        shrink_for_mobile(p, ext)
    return '/m/assets/' + name


MAX_W = 1200          # 400px slot @3x DPR -- isse bada phone par bekaar hai

def shrink_for_mobile(path, ext):
    """Phone ke liye image ko 1200px tak le aao -- 2720px ka koi faida nahi."""
    if ext == 'svg':
        return
    try:
        from PIL import Image
    except ImportError:
        return
    try:
        with Image.open(path) as im:
            if im.width <= MAX_W:
                return
            h = round(im.height * MAX_W / im.width)
            im = im.convert('RGB') if ext in ('jpg', 'jpeg') else im
            im = im.resize((MAX_W, h), Image.LANCZOS)
            if ext in ('jpg', 'jpeg'):
                im.save(path, 'JPEG', quality=82, optimize=True, progressive=True)
            else:
                im.save(path, optimize=True)
    except Exception:
        pass

def is_cta(tag):
    return tag.name == 'a' and tag.get('href') and CTA_RX.search(classes(tag))

def is_kick(tag):
    return bool(KICK_RX.search(classes(tag))) and len(txt(tag)) < 70

TITLE_RX = re.compile(r'\b([a-z]+-)?(title|name|head|heading|hd|h)\b')
TYPE_RX  = re.compile(r'\b([a-z]+-)?(type|cat|category|tag|label|eyebrow|kind|kicker)\b')

def is_leaf_text(tag):
    """Container jismein koi block-level child nahi -- sirf text/inline."""
    if not txt(tag):
        return False
    if len(tag.find_all('a', href=True)) >= 2:
        return False        # kai links = navigation, ek paragraph nahi
    for d in tag.descendants:
        if isinstance(d, Tag) and (d.name in BLOCK_TAGS or
                                   d.name in ('div','section','article','li','tr','details')):
            return False
    return True

def cta_in(parent, tag):
    """Link button hai? -- apni class se, ya parent CTA container hone se."""
    if tag.name != 'a' or not tag.get('href'):
        return False
    if CTA_RX.search(classes(tag)) or tag.get('data-book'):
        return True
    if CTA_RX.search(classes(parent)) and len(txt(tag)) < 40:
        return True
    return False

def link_group(kids):
    """Sirf chhote links ka group (TOC, tag row) -> nav list."""
    links = [k for k in kids if k.name == 'a' and k.get('href') and 0 < len(txt(k)) < 80]
    others = [k for k in kids if k not in links and not is_decor(k) and txt(k)]
    if len(links) >= 3 and len(others) <= 1 and not any(k.find(['h2','h3','h4','p']) for k in links):
        return links, others
    return None

def render_linklist(links):
    items = '\n'.join('  <a href="%s">%s</a>' % (esc(a['href']), inline_html(a)) for a in links)
    return '<nav class="m-linklist">\n%s\n</nav>' % items

def hydrate_counters(soup):
    """data-num / data-n placeholders mein asli value daal do."""
    for el in soup.find_all(attrs={'data-num': True}):
        try:
            v = float(el['data-num'])
        except (TypeError, ValueError):
            continue
        dec = 0
        try:
            dec = int(el.get('data-dec') or 0)
        except ValueError:
            dec = 0
        el.string = ('%%.%df' % dec) % v if dec else ('{:,}'.format(int(round(v))))


def stat_of(tag):
    """data-n chips -> .m-stat"""
    b = tag.find(attrs={'data-n': True})
    if not b:
        return None
    lab = tag.find('i') or tag.find('span') or tag.find('small')
    label = txt(lab) if lab else ''
    if not label:
        t = txt(tag)
        label = re.sub(r'^[\d.,]+\s*', '', t)
    # data-n ke foran baad ka suffix (%, m, k, pts) bhi content hai
    suf = ''
    nxt = b.next_sibling
    while nxt is not None and not suf:
        piece = nxt if isinstance(nxt, str) else (nxt.get_text('', strip=True) if isinstance(nxt, Tag) else '')
        piece = (piece or '').strip()
        if piece:
            m2 = re.match(r'^\s*([%€$]|pts?|bn|[mkx])(?![a-zA-Z])', piece)
            if m2:
                suf = m2.group(1).strip()
        nxt = nxt.next_sibling if piece == '' else None
    return (b.get('data-n'), label, suf)

def group_signature(kids):
    """Siblings ka repeated-card pattern detect karo."""
    real = [k for k in kids if isinstance(k, Tag) and not is_decor(k)]
    if len(real) < 2:
        return None
    sig = classes(real[0]).split()
    sig = sig[0] if sig else real[0].name
    same = [k for k in real if (classes(k).split()[:1] or [k.name])[0] == sig]
    if len(same) < 2 or len(same) < len(real) * 0.7:
        return None
    return same


# ===========================================================================
#  Recursive renderer -- desktop DOM -> mobile blocks
# ===========================================================================
ACC_THRESHOLD = 260      # itne characters se lamba card -> accordion

def render_children(node, assets, depth=0):
    """Children ko tarteeb se render karo. Kuch bhi drop nahi hota --
    group/tab detection sirf un siblings ko consume karti hai jo usme shaamil hain."""
    out, btns, stats = [], [], []

    def flush():
        if btns:
            out.append('<div class="m-btns">\n%s\n</div>' % '\n'.join(btns))
            btns.clear()
        if stats:
            out.append('<div class="m-stats">\n%s\n</div>' % '\n'.join(stats))
            stats.clear()

    # Pure text node bhi content hai -- use span mein lapet do warna loop ise
    # chhod deta hai (chat bubbles, inline labels is tarah gum ho rahe the).
    wrap_loose_text(node)

    # Agar is container mein koi block child hi nahi, to poora ek paragraph hai
    if is_leaf_text(node):
        h = inline_html(node)
        return ['<p>%s</p>' % h] if h else []

    kids = [k for k in node.children if isinstance(k, Tag) and not is_decor(k)]
    i = 0
    while i < len(kids):
        k = kids[i]
        n = k.name

        # --- tab rail + panels -> accordions (dono siblings consume) ------
        nxt = kids[i + 1] if i + 1 < len(kids) else None
        tabs = try_tabs(k, nxt, assets, depth)
        if tabs:
            flush(); out.extend(tabs)
            i += 2 if tabs_used_next else 1
            continue

        # --- consecutive links -> nav list -------------------------------
        if n == 'a' and k.get('href'):
            run = []
            j = i
            while (j < len(kids) and kids[j].name == 'a' and kids[j].get('href')
                   and 0 < len(txt(kids[j])) < 90 and not kids[j].find(['h2','h3','h4','p','img'])):
                run.append(kids[j]); j += 1
            if len(run) >= 2:
                flush(); out.append(render_linklist(run)); i = j; continue

        # --- buttons ka run -> pills -------------------------------------
        if n == 'button' and len(txt(k)) < 60:
            run, j = [], i
            while j < len(kids) and kids[j].name == 'button' and 0 < len(txt(kids[j])) < 60:
                run.append(kids[j]); j += 1
            if len(run) >= 2:
                flush()
                out.append('<div class="m-pills">%s</div>' % ''.join(
                    '<span class="m-pill%s">%s</span>'
                    % (' is-on' if ix == 0 else '', esc(txt(b))) for ix, b in enumerate(run)))
                i = j; continue

        # --- run of similar siblings -> cards / accordions ----------------
        run = similar_run(kids, i, depth)
        if run:
            flush(); out.append(render_group(run, assets, depth)); i += len(run); continue

        # --- data-roll: desktop par rotate hoti hain, mobile par sab dikhao --
        roll = k.get('data-roll')
        if not roll and len(txt(k)) < 90:
            inner = k.find(attrs={'data-roll': True})
            if inner is not None:
                roll = inner.get('data-roll')
        if roll:
            try:
                vals = json.loads(roll)
            except Exception:
                vals = []
            vals = [str(v).strip() for v in vals if str(v).strip()]
            if len(vals) >= 2:
                flush()
                out.append('<div class="m-pills">%s</div>'
                           % ''.join('<span class="m-pill">%s</span>' % esc(v) for v in vals))
                i += 1
                continue

        # --- svg se nikale hue labels -> pills ----------------------------
        if 'svg-labels' in (k.get('class') or []):
            vals = [txt(sp) for sp in k.find_all('span')]
            vals = [v for v in vals if v]
            if vals:
                flush()
                out.append('<div class="m-pills">%s</div>' % ''.join(
                    '<span class="m-pill">%s</span>' % esc(v) for v in vals))
            i += 1
            continue

        # --- single elements ---------------------------------------------
        if n in ('h1','h2','h3','h4','h5','h6'):
            flush()
            lvl = min(max(int(n[1]), 2), 4)
            h = inline_html(k)
            if h: out.append('<h%d>%s</h%d>' % (lvl, h, lvl))

        elif n == 'p':
            flush()
            h = inline_html(k)
            if h: out.append('<p>%s</p>' % h)

        elif n in ('ul','ol'):
            flush()
            h = clean_list(k)
            if h: out.append(h)

        elif n == 'table':
            flush()
            h = clean_table(k)
            if h: out.append(h)

        elif n == 'img':
            flush()
            h = clean_img(k, assets)
            if h: out.append(h)

        elif n == 'blockquote':
            flush(); out.append('<blockquote>%s</blockquote>' % inline_html(k))

        elif n == 'hr':
            flush(); out.append('<hr>')

        elif cta_in(node, k):
            if stats: flush()
            primary = re.search(r'\b(primary|solid|fill|hcta-a|main|book)\b', classes(k)) or k.get('data-book')
            btns.append('<a class="m-btn %s" href="%s">%s</a>' % (
                'm-btn-primary' if primary else 'm-btn-ghost',
                esc(k['href']), inline_html(k) or 'Open'))

        elif len(k.find_all(attrs={'data-n': True})) == 1 and len(txt(k)) < 60:
            st = stat_of(k)
            if st:
                if btns: flush()
                try:
                    shown = '{:,}'.format(int(round(float(st[0]))))
                except (TypeError, ValueError):
                    shown = esc(str(st[0]))
                stats.append('<div class="m-stat"><b data-n="%s">%s</b>%s<i>%s</i></div>'
                             % (esc(st[0]), shown,
                                esc(st[2]) if len(st) > 2 else '', esc(st[1])))
            else:
                flush(); out.extend(render_children(k, assets, depth + 1))

        elif n == 'a' and k.get('href') and (k.find(['h2','h3','h4']) or len(txt(k)) > 60):
            flush(); out.append(render_card(k, assets, link=k['href']))

        elif n == 'a' and k.get('href') and len(txt(k)) < 90:
            flush(); out.append(render_linklist([k]))

        elif is_kick(k):
            flush(); out.append('<span class="m-kick">%s</span>' % inline_html(k))

        elif is_leaf_text(k):
            flush()
            h = inline_html(k)
            if h:
                if TITLE_RX.search(classes(k)) and len(txt(k)) < 90:
                    out.append('<h3>%s</h3>' % h)
                elif TYPE_RX.search(classes(k)) and len(txt(k)) < 60:
                    out.append('<span class="m-kick">%s</span>' % h)
                elif n in ('button','summary'):
                    out.append('<p><strong>%s</strong></p>' % h)
                else:
                    out.append('<p>%s</p>' % h)

        else:
            flush()
            out.extend(render_children(k, assets, depth + 1))

        i += 1

    flush()
    return [o for o in out if o and o.strip() and not is_symbol_block(o)]


_SOUP = BeautifulSoup('', 'html.parser')

def wrap_loose_text(node):
    """Element ke seedhe text nodes ko <span> mein lapet do taake render ho sakein."""
    for c in list(node.children):
        if isinstance(c, NavigableString) and not isinstance(c, Tag):
            if isinstance(c, Comment) or type(c) is not NavigableString:
                continue
            t = str(c).strip()
            if len(t) > 2 and not t.startswith('<!'):
                sp = _SOUP.new_tag('span')
                sp['class'] = ['loose-text']
                sp.string = str(c)
                c.replace_with(sp)


SECTIONISH = ('section','article','main','header','footer','aside')

def similar_run(kids, i, depth=1):
    """kids[i] se shuru hone wale consecutive similar siblings -- card/accordion group."""
    k = kids[i]
    if k.name in ('h1','h2','h3','h4','h5','h6','p','ul','ol','table','img','hr','blockquote'):
        return None
    # page ke bade hisse card/accordion nahi bante -- warna content chhup jaata hai
    if depth == 0 or k.name in SECTIONISH:
        return None
    sig = (classes(k).split()[:1] or [k.name])[0]
    if not sig:
        return None
    run = []
    j = i
    while j < len(kids):
        c = kids[j]
        if (classes(c).split()[:1] or [c.name])[0] != sig:
            break
        run.append(c); j += 1
    if len(run) < 2:
        return None
    if not all(len(txt(r)) > 24 for r in run):
        return None
    if sum(len(txt(r)) for r in run) > 2600:
        return None          # itna bada content accordion mein chhupana theek nahi
    # agar har item ke andar sirf ek hi block hai to group banane ka faida nahi
    return run


tabs_used_next = False

def try_tabs(rail, panels_host, assets, depth):
    """rail = buttons ka container; panels_host = uske baad wala container.
    Dono ko zip kar ke accordions banao -- poora content rehta hai."""
    global tabs_used_next
    tabs_used_next = False
    buttons = [b for b in rail.find_all('button', recursive=False)] if isinstance(rail, Tag) else []
    if len(buttons) < 3:
        buttons = [b for b in rail.find_all('button')] if isinstance(rail, Tag) else []
        if len(buttons) < 3 or len(txt(rail)) > sum(len(txt(b)) for b in buttons) * 2.2:
            return None
    if not all(len(txt(b)) < 46 for b in buttons):
        return None

    panels, host = [], None
    for cand_host in (rail, panels_host):
        if not isinstance(cand_host, Tag):
            continue
        for depth_try in (0, 1):
            if depth_try == 0:
                cand = [c for c in cand_host.find_all(recursive=False)
                        if isinstance(c, Tag) and len(txt(c)) > 25 and not c.find('button')]
            else:
                cand = [c for c in cand_host.find_all(['section','article','div'], recursive=True)
                        if len(txt(c)) > 25 and not c.find('button')]
                seen, uniq = set(), []
                for c in cand:
                    if any(c in u.descendants for u in uniq):
                        continue
                    uniq.append(c)
                cand = uniq
            if len(cand) >= max(2, len(buttons) - 2):
                panels, host = cand[:len(buttons)], cand_host
                break
        if panels:
            break
    if not panels:
        return None
    bodies = [txt(pn) for pn in panels]
    if len(set(b[:80] for b in bodies)) < max(2, len(bodies) - 1):
        return None                      # sab panels ek jaise -> placeholder hain
    if sum(len(b) for b in bodies) < 40 * len(bodies):
        return None                      # panels khaali/loading hain
    tabs_used_next = (host is panels_host)

    accs = []
    for idx, b in enumerate(buttons):
        label = txt(b) or ('Step %d' % (idx + 1))
        body = ''
        if idx < len(panels):
            body = '\n'.join(dedupe_blocks(render_children(panels[idx], assets, depth + 2), label))
        if not body:
            body = '<p>%s</p>' % esc(txt(b))
        accs.append('<details class="m-acc"%s>\n<summary>%s</summary>\n'
                    '<div class="m-acc-body">\n%s\n</div>\n</details>'
                    % (' open' if idx == 0 else '', esc(label), body))
    return accs or None


def render_group(items, assets, depth):
    """Repeated siblings -> cards (chhote) ya accordions (lambe)."""
    longest = max(len(txt(i)) for i in items)
    if longest > ACC_THRESHOLD:
        accs = []
        for i, it in enumerate(items):
            head = it.find(['h2','h3','h4','strong','b'])
            label = txt(head) if head else txt(it)[:52].rsplit(' ', 1)[0]
            if head: head.extract()
            body = '\n'.join(dedupe_blocks(render_children(it, assets, depth + 1), label)) \
                   or '<p>%s</p>' % esc(txt(it))
            accs.append('<details class="m-acc"%s>\n<summary>%s</summary>\n'
                        '<div class="m-acc-body">\n%s\n</div>\n</details>'
                        % (' open' if i == 0 else '', esc(label), body))
        return '\n'.join(accs)

    cards = []
    for it in items:
        a = it if it.name == 'a' else it.find('a', href=True)
        cards.append(render_card(it, assets, link=a['href'] if a and a.get('href') else None))
    return '<div class="m-grid">\n%s\n</div>' % '\n'.join(cards)


_WORD = re.compile(r"[a-z0-9']+")

def _words(h):
    return set(_WORD.findall(re.sub(r'<[^>]+>', ' ', h).lower()))

def is_symbol_block(html):
    """Sirf symbol (×, ›, ⇲) wale blocks -- ye close buttons hain, content nahi.
    Koi bhi harf ya adad ho to block rakha jaata hai."""
    plain = re.sub(r'<[^>]+>', '', html).strip()
    if not plain or len(plain) > 2:
        return False
    return not re.search(r'[\w]', plain, re.UNICODE)


def dedupe_blocks(blocks, heading=''):
    """Card ke andar se wo chhote text blocks hata do jo heading ya kisi
    doosre block mein pehle se maujood hain (desktop thumbnails aksar title
    dobara likhte hain)."""
    seen = [_words(heading)] if heading else []
    out = []
    for b in blocks:
        if not b.startswith(('<p>', '<span class="m-kick">', '<h3>')):
            out.append(b); seen.append(_words(b)); continue
        w = _words(b)
        if not w:
            continue
        plain = re.sub(r'<[^>]+>', '', b).strip()
        if len(plain) < 70 and any(w and w <= s for s in seen if s):
            continue                       # poora content pehle aa chuka hai
        out.append(b)
        seen.append(w)
    return out


def render_card(node, assets, link=None):
    num = node.find(attrs={'class': re.compile(r'\b(num|idx|step|n)\b')})
    numh = ''
    if num and len(txt(num)) <= 4:
        numh = '<span class="m-card-num">%s</span>' % esc(txt(num))
        num.extract()
    first = next((c for c in node.find_all(recursive=False)
                  if isinstance(c, Tag) and not is_decor(c)), None)
    def at_top(el):
        """Heading tabhi upar uthao jab wo card ke shuru mein ho -- warna
        beech ka koi number title ban jaata hai aur tarteeb bigad jaati hai."""
        if el is None:
            return False
        return el is first or (first is not None and el in first.descendants) \
               or el.parent is node
    head = node.find(['h2','h3','h4'])
    if head is not None and not at_top(head):
        head = None
    if head is None:
        cand = node.find(attrs={'class': TITLE_RX})
        if cand is not None and at_top(cand) and 0 < len(txt(cand)) <= 95:
            head = cand
    kick = node.find(attrs={'class': TYPE_RX})
    if (kick is not None and not numh and 0 < len(txt(kick)) < 60
            and kick is not head
            and not (head is not None and kick in head.descendants)):
        numh = '<span class="m-card-num">%s</span>' % esc(txt(kick))
        kick.extract()
    title = ''
    if head is not None:
        ht = inline_html(head)
        if ht:
            title = '<h3>%s</h3>' % ht
            head.extract()
        else:
            head = None
    else:
        strong = node.find(['strong','b'])
        if strong and len(txt(strong)) < 70:
            title = '<h3>%s</h3>' % inline_html(strong)
            strong.extract()
    blocks = dedupe_blocks(render_children(node, assets, 9),
                           txt(head) if head is not None else '')
    body = '\n'.join(blocks)
    if not body and not title:
        body = '<p>%s</p>' % esc(txt(node))
    inner = numh + title + '\n' + body
    if link:
        # <a> ke andar <a> invalid HTML hai aur tap tor deta hai -- andar wale
        # anchors ko span bana do (unka href card ke link se hi cover ho jaata hai)
        inner = re.sub(r'<a\s[^>]*>', '<span class="m-inline-link">', inner)
        inner = inner.replace('</a>', '</span>')
        inner = re.sub(r'<nav class="m-linklist">(.*?)</nav>',
                       r'<div class="m-linklist is-static">\1</div>', inner, flags=re.S)
        return ('<a class="m-card m-card-link" href="%s">\n%s\n'
                '<span class="m-card-arrow">Open &rarr;</span>\n</a>'
                % (esc(link), inner))
    return '<div class="m-card">\n%s\n</div>' % inner


# ===========================================================================
#  JS-driven content  (SOLUTIONS / SECTORS / LAYERS ... inline JS arrays)
# ===========================================================================
# Ye pages apna content JS se banate hain -- static HTML khaali hota hai.
# Array parse kar ke wahi content mobile par cards ki soorat mein rakhte hain.
TITLE_KEYS = ('name', 'title', 'label', 'head', 'heading', 'h', 'q', 'step')
SUB_KEYS   = ('tag', 'short', 'cat', 'category', 'layer', 'kind', 'type', 'role', 'who')
DESC_KEYS  = ('desc', 'description', 'text', 'body', 'blurb', 'copy', 'sub', 'detail', 'a')
LIST_KEYS  = ('points', 'formats', 'bullets', 'items', 'lines', 'features', 'steps', 'rows')
PAIR_KEYS  = ('kpis', 'stats', 'metrics', 'map', 'nums')
SKIP_KEYS  = {'id', 'col', 'hue', 'hue2', 'glow', 'icon', 'prev', 'accent', 'color',
              'bg', 'fill', 'stroke', 'x', 'y', 'w', 'h2', 'cls', 'css', 'svg', 'img',
              'src', 'seed', 'delay', 'dur', 'idx', 'i', 'n'}

LABELS = {
    'points': '', 'bullets': '', 'items': '', 'lines': '',
    'formats': 'Formats covered', 'features': 'Features', 'steps': 'Steps',
    'kpis': 'Signals', 'metrics': 'Signals', 'stats': 'Signals',
    'map': 'On the menu', 'rows': 'Detail',
    'SOLUTIONS': 'Solutions', 'SECTORS': 'Sectors', 'FLAGSHIP': 'Flagship solutions',
    'LAYERS': 'How Iris decides', 'STEP': 'How it runs',
}

def jtext(v):
    """JS data ki string -> safe HTML text.

    In strings mein kahin kahin pehle se HTML entities hain (desktop unhe
    seedha innerHTML mein daalta hai), is liye pehle unescape karo warna
    "click &amp; collect" page par waise hi chhap jaata hai.
    """
    return esc(htmllib.unescape(str(v)))


def _pretty(name):
    if name in LABELS:
        return LABELS[name]
    k = LABELS.get(name.lower())
    if k is not None:
        return k
    return name.replace('_', ' ').title()

def _is_noise(v):
    if not isinstance(v, str):
        return True
    v = v.strip()
    return (not v or len(v) < 3 or v.startswith('#') or v.startswith('rgba')
            or v.startswith('<') or re.fullmatch(r'[\d.,%+\-]+', v) is not None)

def js_sections(html, page_title, skip=frozenset()):
    names = []
    for m in re.finditer(r'\b([A-Z][A-Z_0-9]{3,})\s*=\s*\[', html):
        if m.group(1) not in names:
            names.append(m.group(1))
    out = []
    for nm in names:
        if nm in skip:
            continue            # sector explorer ne pehle hi render kar diya
        arr = find_array(html, nm)
        if not isinstance(arr, list) or len(arr) < 2:
            continue
        rows = [r for r in arr if isinstance(r, dict)]
        if len(rows) < 2:
            continue
        # sirf tab render karo jab waqai prose maujood ho
        prose = sum(1 for r in rows
                    for k, v in r.items()
                    if k.lower() in DESC_KEYS and isinstance(v, str) and len(v) > 25)
        lists = sum(1 for r in rows
                    for k, v in r.items()
                    if k.lower() in LIST_KEYS and isinstance(v, list) and len(v) >= 2)
        if prose < max(2, len(rows) * 0.4) and lists < max(2, len(rows) * 0.4):
            continue
        cards = [c for c in (js_card(r) for r in rows) if c]
        if len(cards) < 2:
            continue
        heading = _pretty(nm) or nm.title()
        out.append('<section class="m-sec m-rev">\n<h2>%s</h2>\n'
                   '<div class="m-grid">\n%s\n</div>\n</section>'
                   % (esc(heading), '\n'.join(cards)))
    return out

def js_card(row):
    low = {k.lower(): (k, v) for k, v in row.items()}
    def pick(keys):
        for k in keys:
            if k in low and not _is_noise(low[k][1]):
                return low[k][1]
        return None
    title = pick(TITLE_KEYS)
    sub   = pick(SUB_KEYS)
    desc  = pick(DESC_KEYS)
    if not title and not desc:
        return ''
    parts = []
    num = row.get('num') or row.get('no')
    if sub or num:
        parts.append('<span class="m-card-num">%s</span>'
                     % jtext(' · '.join(str(x) for x in (num, sub) if x)))
    if title:
        parts.append('<h3>%s</h3>' % jtext(title))
    if desc and desc != title:
        parts.append('<p>%s</p>' % jtext(desc))
    for k, v in row.items():
        kl = k.lower()
        if kl in SKIP_KEYS or kl in TITLE_KEYS or kl in SUB_KEYS or kl in DESC_KEYS:
            continue
        if kl in PAIR_KEYS and isinstance(v, list) and v and isinstance(v[0], list):
            pairs = [q for q in v if len(q) >= 2]
            if not pairs:
                continue
            # number->label = stat; text->text = do-column table
            numeric = all(re.match(r'^[^a-zA-Z]*[\d]', str(q[0])) for q in pairs)
            if numeric:
                parts.append('<div class="m-stats">%s</div>' % ''.join(
                    '<div class="m-stat"><b>%s</b><i>%s</i></div>'
                    % (jtext(q[0]), jtext(q[1])) for q in pairs))
            else:
                lab = _pretty(k)
                parts.append((('<span class="m-kick">%s</span>' % esc(lab)) if lab else '')
                             + '<div class="m-tablewrap"><table>%s</table></div>' % ''.join(
                                 '<tr><td>%s</td><td>%s</td></tr>'
                                 % (jtext(q[0]), jtext(q[1])) for q in pairs))
            continue
        if isinstance(v, list) and v and all(isinstance(x, str) for x in v):
            items = ''.join('<li>%s</li>' % jtext(x) for x in v if x)
            if items:
                lab = _pretty(k)
                parts.append(('<span class="m-kick">%s</span>' % esc(lab) if lab else '')
                             + '<ul>%s</ul>' % items)
            continue
        if isinstance(v, str) and not _is_noise(v) and len(v) > 12:
            parts.append('<p><strong>%s:</strong> %s</p>' % (jtext(_pretty(k)), jtext(v)))
    return '<div class="m-card">\n%s\n</div>' % '\n'.join(parts) if parts else ''




# ===========================================================================
#  Sector explorer -- desktop ke selector ka mobile version
# ===========================================================================
# Desktop par sector chunne se poora panel badalta hai. Mobile par wahi:
# upar sticky pills, neeche har sector ka apna panel. Hash (#sector=qsr)
# desktop ke sath compatible hai, is liye purane links chalte rehte hain.
FOOD_SLUGS = {
    'qsr': 'quick-service-street-food', 'casual': 'casual-dining',
    'fine': 'fine-dining-premium', 'cafe': 'cafe-coffee-bakery',
    'dessert': 'ice-cream-desserts-sweets', 'beverage': 'beverages-drinks',
    'health': 'health-wellness-specialty-diets',
    'cloud': 'cloud-kitchen-delivery-only',
    'b2b': 'institutional-b2b-food-service', 'niche': 'niche-experience-concepts',
}
HERE_LABELS = {
    'scorecard': 'Balanced Scorecard', 'pos': 'Point of Sale',
    'oms': 'Order Management', 'numerus': 'Numerus · CFO ledger',
    'nexus': 'Nexus · Integrations', 'motus': 'Motus · Supply chain',
    'manus': 'Manus · Workforce', 'kds': 'Kitchen Display',
}

def _sec_stats(stats):
    cells = []
    for st in stats:
        if not isinstance(st, dict):
            continue
        v = str(st.get('v', '')) + str(st.get('u', '') or '')
        lab = st.get('l') or st.get('lab') or ''
        if v.strip():
            cells.append('<div class="m-stat"><b>%s</b><i>%s</i></div>'
                         % (esc(v), jtext(lab)))
    return '<div class="m-stats">%s</div>' % ''.join(cells) if cells else ''

def _ul(items, label=''):
    lis = ''.join('<li>%s</li>' % jtext(x) for x in items if str(x).strip())
    if not lis:
        return ''
    head = '<span class="m-kick">%s</span>' % esc(label) if label else ''
    return head + '<ul>%s</ul>' % lis

def sector_panel(sec, kind, self_page=False):
    """Ek sector ka poora content -- desktop par jo kuch us panel mein hai."""
    out = []
    num  = sec.get('no') or sec.get('num') or ''
    name = sec.get('name') or sec.get('pill') or ''
    if num:
        out.append('<span class="m-kick">%s</span>' % jtext(num))
    if name:
        out.append('<h3>%s</h3>' % jtext(name))

    lede = sec.get('lede') or sec.get('sub')
    if lede:
        out.append('<p class="m-lede">%s</p>' % jtext(lede))

    # brand / outlet (food)
    bits = [sec.get('brand'), sec.get('outlet'), sec.get('noun')]
    bits = [str(b) for b in bits if b and str(b).strip()]
    if bits and not lede:
        out.append('<p class="m-muted">%s</p>' % jtext(' · '.join(bits)))

    if isinstance(sec.get('stats'), list):
        out.append(_sec_stats(sec['stats']))

    if sec.get('iris'):
        # iris field mein pehle se <b> markup hota hai -- usay rehne do
        iris = re.sub(r'<(?!/?(b|strong|em|i)\b)[^>]*>', '', str(sec['iris']))
        out.append('<div class="m-iris"><span class="m-iris-who">Iris</span>'
                   '<p>%s</p></div>' % iris)

    if isinstance(sec.get('formats'), list):
        out.append(_ul(sec['formats'], 'Formats covered'))

    # rot: rotating headlines -> cards
    if isinstance(sec.get('rot'), list):
        cards = []
        for r in sec['rot']:
            if not isinstance(r, dict):
                continue
            title = ' '.join(str(r.get(k, '')) for k in ('a', 'b')).strip()
            body = ' '.join(filter(None, [str(r.get('l') or ''), str(r.get('p') or '')]))
            if title or body:
                cards.append('<div class="m-card"><h4>%s</h4><p>%s</p></div>'
                             % (esc(title), esc(body.strip())))
        if cards:
            out.append('<span class="m-kick">What Iris does here</span>'
                       '<div class="m-grid">%s</div>' % ''.join(cards))

    # here: product -> is sector mein kya karta hai
    if isinstance(sec.get('here'), dict):
        rows = ''.join(
            '<div class="m-def"><dt>%s</dt><dd>%s</dd></div>'
            % (jtext(HERE_LABELS.get(k, _pretty(k))), jtext(v))
            for k, v in sec['here'].items() if str(v).strip())
        if rows:
            out.append('<span class="m-kick">What runs here</span>'
                       '<dl class="m-deflist">%s</dl>' % rows)

    # sol: is sector ki solutions
    if isinstance(sec.get('sol'), list):
        cards = []
        for x in sec['sol']:
            if not isinstance(x, dict):
                continue
            layer = str(x.get('z') or '')
            cards.append('<div class="m-card">%s<h4>%s</h4><p>%s</p></div>'
                         % ('<span class="m-card-num">%s</span>' % esc(layer) if layer else '',
                            jtext(x.get('n') or ''), jtext(x.get('d') or '')))
        if cards:
            out.append('<span class="m-kick">Solutions for this sector</span>'
                       '<div class="m-grid">%s</div>' % ''.join(cards))

    # map: menu mapping (food)
    if isinstance(sec.get('map'), list) and sec['map']:
        rows = ''.join('<tr><td>%s</td><td>%s</td></tr>' % (jtext(a), jtext(b))
                       for a, b in (q[:2] for q in sec['map'] if len(q) >= 2))
        if rows:
            out.append('<span class="m-kick">On the menu</span>'
                       '<div class="m-tablewrap"><table>%s</table></div>' % rows)

    # demo: live scorecard snapshot
    demo = sec.get('demo')
    if isinstance(demo, dict):
        d = []
        if demo.get('entity'):
            d.append('<p class="m-muted">%s</p>' % jtext(demo['entity']))
        if isinstance(demo.get('sc'), list):
            for q in demo['sc']:
                if not isinstance(q, dict):
                    continue
                val = str(q.get('v', '')) + str(q.get('u', '') or '')
                d.append('<div class="m-card"><span class="m-card-num">%s</span>'
                         '<h4>%s</h4><p>%s</p><p class="m-muted">%s %s</p></div>'
                         % (jtext(q.get('lab') or ''), esc(val),
                            jtext(q.get('l') or ''),
                            jtext(q.get('sl') or ''), jtext(q.get('sv') or '')))
        if d:
            out.append('<span class="m-kick">Live example</span>' + ''.join(d))

    extras = [('Average check', sec.get('check')), ('Peak hour', sec.get('time'))]
    extras = [(l, str(v)) for l, v in extras if v and str(v).strip()]
    if extras:
        out.append('<div class="m-stats">%s</div>' % ''.join(
            '<div class="m-stat"><b>%s</b><i>%s</i></div>' % (jtext(v), jtext(l))
            for l, v in extras))

    # full page link (food ke alag pages hain)
    if kind == 'food' and sec.get('id') in FOOD_SLUGS and not self_page:
        out.append('<a class="m-btn m-btn-primary" href="/food/solutions/%s">'
                   'Open the %s page &rarr;</a>'
                   % (FOOD_SLUGS[sec['id']], jtext(name)))
    elif sec.get('cta2'):
        out.append('<a class="m-btn m-btn-ghost" href="#sector=%s">%s</a>'
                   % (jtext(sec.get('id', '')), jtext(sec['cta2'])))

    return '\n'.join(x for x in out if x)


def sector_explorer(html, rel):
    """SECTORS ko mobile selector (pills + panels) bana do."""
    secs = find_array(html, 'SECTORS')
    if not isinstance(secs, list) or len(secs) < 3:
        return ''
    secs = [x for x in secs if isinstance(x, dict) and x.get('id')]
    # sirf tab jab sector ke paas waqai apna content ho
    rich = sum(1 for x in secs
               if isinstance(x.get('formats'), list) or isinstance(x.get('sol'), list))
    if rich < len(secs) * 0.6:
        return ''
    kind = 'food' if rel.startswith('food') else 'fashion'

    # /food/solutions/casual-dining apne hi sector par khule -- pehle par nahi
    slug = os.path.basename(rel)[:-5]
    active = 0
    for i, sec in enumerate(secs):
        if FOOD_SLUGS.get(str(sec.get('id'))) == slug or str(sec.get('id')) == slug:
            active = i
            break

    pills, panels = [], []
    for i, sec in enumerate(secs):
        sid = str(sec['id'])
        label = sec.get('pill') or sec.get('short') or sec.get('name') or sid
        on = (i == active)
        pills.append('<button class="m-pill%s" role="tab" aria-selected="%s" '
                     'data-sector="%s">%s</button>'
                     % (' is-on' if on else '', 'true' if on else 'false',
                        esc(sid), esc(str(label))))
        panels.append('<div class="m-sector-panel%s" id="sector-%s" data-sector="%s"%s>\n%s\n</div>'
                      % (' is-on' if on else '', esc(sid), esc(sid),
                         '' if on else ' hidden',
                         sector_panel(sec, kind,
                                      FOOD_SLUGS.get(str(sec.get('id'))) == slug)))

    return ('<section class="m-sec m-sector-explorer">\n'
            '<span class="m-kick">Pick your sector</span>\n'
            '<h2>%d sectors, one AI &mdash; configured per format.</h2>\n'
            '<div class="m-pills m-sector-tabs" role="tablist">%s</div>\n'
            '%s\n</section>'
            % (len(secs), ''.join(pills), '\n'.join(panels)))


# ===========================================================================
#  Page builder
# ===========================================================================
def url_path(rel):
    p = '/' + rel[:-5] if rel.endswith('.html') else '/' + rel
    if p == '/index':          return '/'
    if p.endswith('/index'):   return p[:-6] or '/'
    return p

def meta_of(soup, rel):
    head = soup.head
    def m(sel, attr='content'):
        t = head.select_one(sel) if head else None
        return t.get(attr, '') if t else ''
    title = txt(head.title) if head and head.title else 'Zentallio'
    desc  = m('meta[name="description"]')
    og    = m('meta[property="og:image"]')
    return title, desc, og

def strip_chrome(soup):
    # HTML comments hata do -- warna " HERO " jaise labels page par chhap jaate hain
    for c in soup.find_all(string=lambda t: isinstance(t, Comment)):
        c.extract()
    for sel in DROP_SEL:
        for t in soup.select(sel):
            t.decompose()
    for t in soup(['script','style','noscript','template','canvas','iframe']):
        t.decompose()
    # inline svg: decorative ho to phenko, lekin uske text labels bacha lo
    for sv in soup.find_all('svg'):
        if sv.find('title'):
            continue
        par = sv.parent
        if par is not None and par.name == 'a' and par.get('aria-label'):
            continue
        labels = [re.sub(r'\s+', ' ', t.get_text(' ', strip=True))
                  for t in sv.find_all(['text', 'tspan'])]
        labels = [l for l in labels if l]
        seen, uniq = set(), []
        for l in labels:
            if l not in seen:
                seen.add(l); uniq.append(l)
        if uniq and len(' '.join(uniq)) > 12:
            holder = soup.new_tag('div')
            holder['class'] = ['svg-labels']
            for l in uniq:
                sp = soup.new_tag('span')
                sp.string = l
                holder.append(sp)
            sv.replace_with(holder)
        else:
            sv.decompose()
    return soup

def content_roots(soup):
    body = soup.body
    if not body:
        return []
    kids = [c for c in body.find_all(recursive=False)
            if isinstance(c, Tag) and c.name not in ('link','script','style','meta')
            and len(txt(c)) > 0]
    total = len(txt(body)) or 1
    # sirf tab <main> lo jab wo body ka DIRECT child ho aur usmein zyadatar content ho
    mains = [k for k in kids if k.name == 'main']
    if len(mains) == 1 and len(txt(mains[0])) > 0.6 * total:
        return [mains[0]]
    return kids

def build(rel, verbose=False):
    src = os.path.join(ROOT, rel)
    html = open(src, encoding='utf-8').read()
    soup = BeautifulSoup(html, 'lxml')
    title, desc, ogimg = meta_of(soup, rel)
    strip_chrome(soup)
    hydrate_counters(soup)

    roots = content_roots(soup)
    if not roots:
        return None

    # ---- hero: pehla h1 + uska kicker + pehla para + CTAs
    h1 = None
    for r in roots:
        h1 = r.find('h1')
        if h1: break
    hero_title = inline_html(h1) if h1 is not None else ''
    plain_h1 = re.sub(r'<[^>]+>', '', hero_title).strip()
    if len(plain_h1) < 4 or plain_h1.lower().strip(' .·-') in ('zentallio', 'iris'):
        # h1 sirf wordmark hai -- <title> se asli page naam nikalo
        t = title
        for sep in ('—', '–', '|', '·'):
            if sep in t:
                head, _, tail = t.partition(sep)
                t = tail if head.strip().lower() == 'zentallio' else head
                break
        hero_title = esc(re.sub(r'\s*[·|].*$', '', t).strip()) or hero_title or esc(title)
    hero_kick, hero_sub = '', ''
    hero_scope = None
    if h1:
        hero_scope = h1.find_parent(['header','section','div'])
        while (hero_scope is not None and hero_scope.parent is not None
               and hero_scope.parent.name not in ('body','main')
               and len(txt(hero_scope)) < 90):
            hero_scope = hero_scope.parent
        host = h1.parent
        prev = h1.find_previous(['span','div','p'])
        if prev and is_kick(prev) and prev.find_parent() is not None:
            hero_kick = inline_html(prev); prev.extract()
        nxt = h1.find_next('p')
        if nxt and len(txt(nxt)) > 25:
            hero_sub = inline_html(nxt); nxt.extract()
        h1.extract()
    if not hero_sub and desc:
        hero_sub = esc(desc)

    hero_btns = []
    for r in ([hero_scope] if hero_scope else []):
        for a in r.find_all('a', href=True):
            if cta_in(a.parent, a) and len(hero_btns) < 2 and len(txt(a)) < 34:
                primary = not hero_btns
                hero_btns.append('<a class="m-btn %s" href="%s">%s</a>' % (
                    'm-btn-primary' if primary else 'm-btn-ghost',
                    esc(a['href']), inline_html(a)))
                a.extract()
        if hero_btns: break

    # ---- sections
    secs = []
    for r in roots:
        for node in ([r] if r.name == 'main' else [r]):
            blocks = render_children(node, ASSETS, 0)
            if not blocks:
                continue
            secs.append('<section class="m-sec m-rev">\n%s\n</section>'
                        % '\n'.join(blocks))

    explorer = sector_explorer(html, rel)
    if explorer:
        secs.insert(0, explorer)
    secs.extend(js_sections(html, title, skip={'SECTORS'} if explorer else set()))

    if not secs and not hero_sub:
        return None

    upath   = url_path(rel)
    desktop = BASE + upath
    accent  = accent_for(rel)

    hero = ['<section class="m-hero">']
    if hero_kick: hero.append('  <span class="m-kick">%s</span>' % hero_kick)
    hero.append('  <h1>%s</h1>' % hero_title)
    if hero_sub:  hero.append('  <p class="m-hero-sub">%s</p>' % hero_sub)
    if hero_btns: hero.append('  <div class="m-btns">%s</div>' % ''.join(hero_btns))
    hero.append('</section>')

    page = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<meta name="theme-color" content="#05080F">
<link rel="canonical" href="{desktop}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{MBASE}{upath}">
<meta property="og:type" content="website">{('' if not ogimg else chr(10) + '<meta property="og:image" content="' + esc(ogimg) + '">')}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/m/mobile.css">
</head>
<body data-accent="{accent}">
{shell_header()}
<main>
{chr(10).join(hero)}
{chr(10).join(secs)}
</main>
<div class="m-sticky-cta">
  <a class="m-btn m-btn-primary" href="/contact">Book a walkthrough</a>
</div>
{shell_footer(desktop)}
<script src="/m/mobile.js" defer></script>
</body>
</html>
'''
    # Root page ko m/home.html likhte hain, m/index.html nahi -- taake rewrite
    # target hamesha ek asli file ho aur directory-index resolution par bharosa
    # na karna pade (cleanUrls ke saath wo ambiguous hai).
    dst = os.path.join(OUTDIR, 'home.html' if upath == '/' else rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(dst, 'w', encoding='utf-8') as fh:
        fh.write(page)
    return upath, len(page), len(txt(BeautifulSoup(page, 'lxml').body))


def all_pages():
    out = []
    for dp, dn, fn in os.walk(ROOT):
        dn[:] = [d for d in dn if d not in ('.git','node_modules','m','deploy','tools','docs','knowledge','api','lib')]
        for f in sorted(fn):
            if f.endswith('.html') and f not in SKIP_FILES and not f.startswith('_'):
                out.append(os.path.relpath(os.path.join(dp, f), ROOT))
    return sorted(out)


def update_middleware(paths):
    mw = os.path.join(ROOT, 'middleware.js')
    s  = open(mw, encoding='utf-8').read()
    body = 'const MOBILE_READY = new Set([\n' + \
           ''.join("  '%s',\n" % p for p in sorted(paths)) + ']);'
    s = re.sub(r'// MOBILE_READY:START.*?// MOBILE_READY:END',
               '// MOBILE_READY:START\n' + body + '\n// MOBILE_READY:END',
               s, flags=re.S)
    open(mw, 'w', encoding='utf-8').write(s)


if __name__ == '__main__':
    targets = sys.argv[1:] or all_pages()
    ok, paths, skipped = 0, [], []
    for rel in targets:
        try:
            r = build(rel)
        except Exception as e:
            skipped.append('%s  (%s: %s)' % (rel, type(e).__name__, e)); continue
        if not r:
            skipped.append('%s  (no content)' % rel); continue
        upath, size, tlen = r
        paths.append(upath); ok += 1
        print('%-52s -> m/%-46s %6dKB  text:%d' % (rel, rel, size // 1024, tlen))
    if not sys.argv[1:]:
        update_middleware(paths)
    print('\nbuilt %d  |  skipped %d' % (ok, len(skipped)))
    for s in skipped:
        print('  SKIP', s)
