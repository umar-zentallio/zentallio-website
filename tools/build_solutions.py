#!/usr/bin/env python3
"""Solutions section banata hai -- desktop + mobile, aur har page ke navbar
mein "Solutions" dropdown lagata hai.

    python3 tools/build_solutions.py

Kya banta hai:
  solutions.html                       /solutions  (products + sector selector)
  solutions/<product>.html             /solutions/balanced-scorecard ... (6)
  m/solutions.html, m/solutions/*.html mobile versions
  solutions/icons/<slug>.png           solutions/li_<slug>.png se crop (agar ho)
  solutions/img/<slug>.webp            product card poster se crop (agar ho)

Product image add karni ho: solutions/li_<slug>.png rakho (same template jaisa
li_balanced-scorecard.png) aur script dobara chalao -- nav, cards aur product
page sab khud update ho jaate hain. Slugs: tools/solutions_data.py PRODUCTS.

Content tools/solutions_data.py mein hai (PDF rule book se).
Script idempotent hai -- jitni baar chalao, result same.
"""
import html, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from solutions_data import PLATFORM, PRODUCTS, FB, FA, CORE_POS, TECH_TAGS, fb_layer  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOL = os.path.join(ROOT, 'solutions')
E = html.escape


def rd(p):
    with open(os.path.join(ROOT, p), encoding='utf-8') as f:
        return f.read()


def wr(p, s):
    full = os.path.join(ROOT, p)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    old = None
    if os.path.exists(full):
        with open(full, encoding='utf-8') as f:
            old = f.read()
    if old != s:
        with open(full, 'w', encoding='utf-8') as f:
            f.write(s)
        print('  wrote', p)


# ------------------------------------------------------------------ images
# li_<slug>.png template (2400x2400): andar dark card, us mein icon tile.
ICON_BOX = (905, 668, 1490, 1292)
CARD_BOX = (735, 470, 1650, 1820)


def build_images():
    try:
        from PIL import Image
    except ImportError:
        print('  (Pillow nahi mila -- images skip)')
        return
    for p in PRODUCTS + [{'slug': 'iris'}]:
        src = os.path.join(SOL, p.get('src') or 'li_%s.png' % p['slug'])
        if not os.path.exists(src):
            continue
        ico = os.path.join(SOL, 'icons', p['slug'] + '.png')
        card = os.path.join(SOL, 'img', p['slug'] + '.webp')
        if all(os.path.exists(x) and os.path.getmtime(x) >= os.path.getmtime(src) for x in (ico, card)):
            continue
        os.makedirs(os.path.dirname(ico), exist_ok=True)
        os.makedirs(os.path.dirname(card), exist_ok=True)
        im = Image.open(src).convert('RGB')
        sc = im.size[0] / 2400.0
        box = lambda b: tuple(int(v * sc) for v in b)
        im.crop(box(ICON_BOX)).resize((240, 256), Image.LANCZOS).save(ico, optimize=True)
        im.crop(box(CARD_BOX)).resize((732, 1080), Image.LANCZOS).save(card, 'WEBP', quality=86, method=6)
        print('  image', p['slug'])


def has_img(p):
    return os.path.exists(os.path.join(SOL, 'icons', p['slug'] + '.png'))


def icon(p, cls='zs-ico'):
    """Product icon: crop ki hui image, warna wahi design CSS se (monogram tile)."""
    if has_img(p):
        return ('<span class="%s is-img"><img src="/solutions/icons/%s.png" alt="" width="240" height="256" '
                'loading="lazy" decoding="async"></span>' % (cls, p['slug']))
    return '<span class="%s" data-n="%d"><span>%s</span></span>' % (cls, len(p['mono']), p['mono'])


def poster(p):
    if os.path.exists(os.path.join(SOL, 'img', p['slug'] + '.webp')):
        return ('<div class="zs-poster is-img"><img src="/solutions/img/%s.webp" alt="%s product card" '
                'width="732" height="1080" decoding="async" fetchpriority="high"></div>' % (p['slug'], E(p['name'])))
    return ('<div class="zs-poster"><div class="zs-pwm">Zen<span class="t">t</span><span class="a">a</span>llio</div>'
            '%s<div class="zs-pname">%s</div></div>' % (icon(p, 'zs-ico zs-ico-xl'), E(p['name'])))


def plink(p):
    return '/solutions/' + p['slug']


def pname(p):
    return p['name'] + (' · ' + p['role'] if p['slug'] in ('numerus', 'nexus', 'motus', 'manus') else '')


# ------------------------------------------------------------------ nav dropdown
NAV_START, NAV_END = '<!--zsol-nav:start-->', '<!--zsol-nav:end-->'
TOGGLE = ("var g=this.parentNode,o=!g.classList.contains('open');g.classList.toggle('open',o);"
          "this.setAttribute('aria-expanded',o)")


def nav_items(kind):
    """kind: 'd' (desktop .znav) ya 'm' (mobile .m-menu)."""
    pre = 'znav' if kind == 'd' else 'm-menu'
    out = []
    for p in PRODUCTS:
        out.append('<a class="%s-sp" href="%s">%s<span class="%s-st"><strong>%s</strong><em>%s</em></span></a>'
                   % (pre, plink(p), icon(p, pre + '-ic'), pre, E(pname(p)), E(p['label'])))
    out.append('<a class="%s-all" href="/solutions">All solutions &amp; sectors <span>→</span></a>' % pre)
    return ''.join(out)


def nav_group(kind, cur=False):
    if kind == 'd':
        return ('%s<div class="znav-grp%s"><button type="button" class="znav-sol" aria-expanded="%s" '
                'aria-controls="znavSub" onclick="%s"><i>03</i><span>Solutions</span><em class="znav-chev"></em></button>'
                '<div class="znav-sub" id="znavSub"><div class="znav-subin">%s</div></div></div>%s'
                % (NAV_START, ' open znav-cur' if cur else '', 'true' if cur else 'false', TOGGLE, nav_items('d'), NAV_END))
    return ('%s<div class="m-menu-grp%s"><button type="button" class="m-menu-item m-menu-sol" aria-expanded="%s" '
            'aria-controls="mMenuSub" onclick="%s"><i>03</i><span>Solutions</span><em class="m-menu-chev"></em></button>'
            '<div class="m-menu-sub" id="mMenuSub"><div class="m-menu-subin">%s</div></div></div>%s'
            % (NAV_START, ' open m-cur' if cur else '', 'true' if cur else 'false', TOGGLE, nav_items('m'), NAV_END))


NAV_CSS_D = """<style id="zsol-nav-css">
/* Solutions dropdown (tools/build_solutions.py) */
.znav-ov{overflow-y:auto;justify-content:safe center;padding-top:96px;padding-bottom:48px}
.znav-sol{all:unset;box-sizing:border-box;width:100%;cursor:pointer;display:flex;align-items:center;gap:clamp(16px,2vw,28px);padding:clamp(11px,1.7vw,20px) 0;border-bottom:1px solid var(--line);font-family:var(--serif);font-weight:300;font-size:clamp(2rem,5.6vw,4.4rem);color:var(--fg2);letter-spacing:-.02em;line-height:1.15;transition:color .3s,padding-left .3s;opacity:0;transform:translateY(22px)}
.znav-ov.open .znav-sol{opacity:1;transform:none;transition:color .3s,padding-left .3s,opacity .5s .18s,transform .5s .18s}
.znav-ov.open .znav-nav>a:nth-child(4){transition-delay:.24s}
.znav-ov.open .znav-nav>a:nth-child(5){transition-delay:.3s}
.znav-ov.open .znav-nav>a:nth-child(6){transition-delay:.36s}
.znav-sol i{font-family:var(--mono);font-size:.78rem;color:var(--fg3);font-style:normal;letter-spacing:.1em}
.znav-sol:hover,.znav-grp.open .znav-sol,.znav-grp.znav-cur .znav-sol{color:#fff}
.znav-sol:hover{padding-left:14px}
.znav-sol:focus-visible{outline:1px solid var(--teal);outline-offset:4px}
.znav-chev{margin-left:auto;width:30px;height:30px;border:1px solid var(--line2);border-radius:50%;position:relative;flex:none;transition:transform .35s,border-color .3s}
.znav-chev::before,.znav-chev::after{content:"";position:absolute;left:50%;top:50%;width:11px;height:1.5px;background:var(--ink);transform:translate(-50%,-50%)}
.znav-chev::after{transform:translate(-50%,-50%) rotate(90deg);transition:transform .35s}
.znav-grp.open .znav-chev{border-color:rgba(21,242,242,.55)}
.znav-grp.open .znav-chev::after{transform:translate(-50%,-50%) rotate(0)}
.znav-sub{display:grid;grid-template-rows:0fr;transition:grid-template-rows .45s cubic-bezier(.3,.7,.2,1)}
.znav-grp.open .znav-sub{grid-template-rows:1fr}
.znav-subin{overflow:hidden;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;padding:0}
.znav-grp.open .znav-subin{padding:18px 0 22px}
.znav-ov .znav-nav .znav-sub a,.znav-ov.open .znav-nav .znav-sub a{opacity:1;transform:none;transition:border-color .25s,background .25s,transform .25s;transition-delay:0s}
.znav-ov .znav-nav .znav-sub a.znav-sp{display:flex;align-items:center;gap:14px;padding:12px 14px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.025);font-family:Inter,system-ui,sans-serif;font-size:1rem;color:var(--ink);letter-spacing:0}
.znav-ov .znav-nav .znav-sub a.znav-sp:hover{padding-left:14px;border-color:rgba(21,242,242,.38);background:rgba(21,242,242,.05);transform:translateY(-2px)}
.znav-st{display:flex;flex-direction:column;gap:3px;min-width:0}
.znav-st strong{font-weight:600;font-size:.95rem;color:#fff;line-height:1.2}
.znav-st em{font-style:normal;font-family:var(--mono);font-size:.62rem;letter-spacing:.06em;color:var(--fg3);line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.znav-ov .znav-nav .znav-sub a.znav-all{grid-column:1/-1;display:inline-flex;justify-content:flex-start;gap:8px;padding:8px 2px 0;border:0;font-family:var(--mono);font-size:.7rem;letter-spacing:.16em;text-transform:uppercase;color:var(--teal)}
.znav-ov .znav-nav .znav-sub a.znav-all:hover{padding-left:6px;color:#fff}
.znav-ic{--s:42px;width:var(--s);height:var(--s);flex:none;border-radius:11px;background:#2c0e26;position:relative;display:grid;place-items:center;overflow:hidden;box-shadow:inset 0 0 0 1px rgba(255,255,255,.07)}
.znav-ic>span{font-family:var(--serif);font-weight:600;color:#F25DB6;font-size:15px;letter-spacing:-.03em}
.znav-ic[data-n="3"]>span{font-size:12px}
.znav-ic:not(.is-img)::before,.znav-ic:not(.is-img)::after{content:"";position:absolute;inset:3px;border-radius:9px;border:3px solid #18EEF0;clip-path:polygon(0 0,46% 0,46% 46%,0 46%)}
.znav-ic:not(.is-img)::after{border-color:#FF2D95;clip-path:polygon(54% 54%,100% 54%,100% 100%,54% 100%)}
.znav-ic img{width:100%;height:100%;object-fit:cover;display:block}
@media(max-width:980px){.znav-subin{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:600px){.znav-subin{grid-template-columns:1fr}.znav-chev{width:24px;height:24px}}
</style>"""


def nav_css_m():
    return """/* ZSOL-NAV:START -- Solutions dropdown (tools/build_solutions.py) */
.m-menu-nav{justify-content:flex-start}
.m-menu button.m-menu-item{appearance:none;background:none;border:0;border-bottom:1px solid var(--line);width:100%;text-align:left;cursor:pointer;
  display:flex;align-items:center;gap:16px;min-height:var(--tap);padding:clamp(11px,2.4vw,18px) 0;
  font-family:var(--serif);font-weight:300;font-size:clamp(1.9rem,9vw,2.6rem);letter-spacing:-.02em;color:var(--fg2);line-height:1.15;-webkit-tap-highlight-color:transparent}
.m-menu button.m-menu-item i{font-family:var(--mono);font-style:normal;font-size:.72rem;color:var(--fg3);letter-spacing:.1em;flex:0 0 auto}
.m-menu-grp.open button.m-menu-item,.m-menu-grp.m-cur button.m-menu-item{color:#fff}
.m-menu-chev{margin-left:auto;width:26px;height:26px;flex:0 0 26px;border:1px solid var(--line2);border-radius:50%;position:relative}
.m-menu-chev::before,.m-menu-chev::after{content:"";position:absolute;left:50%;top:50%;width:10px;height:1.5px;background:var(--ink);transform:translate(-50%,-50%)}
.m-menu-chev::after{transform:translate(-50%,-50%) rotate(90deg);transition:transform .3s}
.m-menu-grp.open .m-menu-chev{border-color:rgba(21,242,242,.55)}
.m-menu-grp.open .m-menu-chev::after{transform:translate(-50%,-50%) rotate(0)}
.m-menu-sub{display:grid;grid-template-rows:0fr;transition:grid-template-rows .4s cubic-bezier(.3,.7,.2,1)}
.m-menu-grp.open .m-menu-sub{grid-template-rows:1fr}
.m-menu-subin{overflow:hidden;display:flex;flex-direction:column;gap:8px}
.m-menu-grp.open .m-menu-subin{padding:14px 0 18px}
.m-menu a.m-menu-sp{display:flex;align-items:center;gap:13px;min-height:var(--tap);padding:10px 12px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.025)}
.m-menu a.m-menu-sp:active{border-color:rgba(21,242,242,.4);background:rgba(21,242,242,.06)}
.m-menu-st{display:flex;flex-direction:column;gap:2px;min-width:0}
.m-menu-st strong{font-family:var(--sans);font-weight:600;font-size:.95rem;color:#fff;line-height:1.25}
.m-menu-st em{font-style:normal;font-family:var(--mono);font-size:.62rem;letter-spacing:.05em;color:var(--fg3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.m-menu a.m-menu-all{display:inline-flex;gap:8px;padding:6px 2px 0;min-height:var(--tap);align-items:center;font-family:var(--mono);font-size:.7rem;letter-spacing:.16em;text-transform:uppercase;color:var(--teal)}
.m-menu-ic{--s:40px;width:var(--s);height:var(--s);flex:0 0 var(--s);border-radius:11px;background:#2c0e26;position:relative;display:grid;place-items:center;overflow:hidden;box-shadow:inset 0 0 0 1px rgba(255,255,255,.07)}
.m-menu-ic>span{font-family:var(--serif);font-weight:600;color:#F25DB6;font-size:14px;letter-spacing:-.03em}
.m-menu-ic[data-n="3"]>span{font-size:11.5px}
.m-menu-ic:not(.is-img)::before,.m-menu-ic:not(.is-img)::after{content:"";position:absolute;inset:3px;border-radius:9px;border:3px solid #18EEF0;clip-path:polygon(0 0,46% 0,46% 46%,0 46%)}
.m-menu-ic:not(.is-img)::after{border-color:#FF2D95;clip-path:polygon(54% 54%,100% 54%,100% 100%,54% 100%)}
.m-menu-ic img{width:100%;height:100%;object-fit:cover;display:block}
/* ZSOL-NAV:END */
"""


def inject_nav_desktop(s, path):
    cur = path.startswith('/solutions')
    if NAV_START in s:
        s = re.sub(re.escape(NAV_START) + '.*?' + re.escape(NAV_END), lambda m: nav_group('d', cur), s, flags=re.S)
    else:
        m = re.search(r'(<nav class="znav-nav">.*?<a[^>]*href="/fashion"[^>]*>.*?</a>)', s, re.S)
        if not m:
            return s
        s = s[:m.end()] + '\n' + nav_group('d', cur) + s[m.end():]
        s = re.sub(r'(href="/meet-iris"><i>)03(</i>)', r'\g<1>04\2', s)
        s = re.sub(r'(href="/contact"><i>)04(</i>)', r'\g<1>05\2', s)
    if '<style id="zsol-nav-css">' in s:
        s = re.sub(r'<style id="zsol-nav-css">.*?</style>', lambda m: NAV_CSS_D, s, count=1, flags=re.S)
    else:
        i = s.find('<style id="znav-css">')
        j = s.find('</style>', i) + len('</style>')
        s = s[:j] + NAV_CSS_D + s[j:]
    return s


def inject_nav_mobile(s, path):
    cur = path.startswith('/solutions')
    if NAV_START in s:
        return re.sub(re.escape(NAV_START) + '.*?' + re.escape(NAV_END), lambda m: nav_group('m', cur), s, flags=re.S)
    m = re.search(r'(<nav class="m-menu-nav">.*?<a[^>]*href="/fashion"[^>]*>.*?</a>)', s, re.S)
    if not m:
        return s
    s = s[:m.end()] + '\n    ' + nav_group('m', cur) + s[m.end():]
    s = re.sub(r'(href="/meet-iris"><i>)03(</i>)', r'\g<1>04\2', s)
    s = re.sub(r'(href="/contact"><i>)04(</i>)', r'\g<1>05\2', s)
    return s



FOOT_START, FOOT_END = '<!--zsol-foot:start-->', '<!--zsol-foot:end-->'


def foot_col():
    return ('%s<div class="zsol-fcol"><h4>Solutions</h4><a href="/solutions">All solutions</a>%s</div>%s'
            % (FOOT_START, ''.join('<a href="%s">%s</a>' % (plink(p), E(p['name'])) for p in PRODUCTS), FOOT_END))


def add_resources_nav(s, mobile, path):
    """Header menu mein Resources (Contact se pehle). Idempotent."""
    if re.search(r'<a[^>]*href="/resources"[^>]*><i>05</i>', s):
        return s
    cur = path == '/resources' or path.startswith('/resources/')
    if mobile:
        cls = 'm-menu-item m-cur' if cur else 'm-menu-item'
        pat = r'(<a class="m-menu-item(?: m-cur)?" href="/contact"><i>)05(</i>)'
        new = '<a class="%s" href="/resources"><i>05</i><span>Resources</span></a>\n    ' % cls
    else:
        cls = ' class="znav-cur"' if cur else ''
        pat = r'(<a(?: class="znav-cur")? href="/contact"><i>)05(</i>)'
        new = '<a%s href="/resources"><i>05</i><span>Resources</span></a>\n' % cls
    m = re.search(pat, s)
    if not m:
        return s
    return s[:m.start()] + new + re.sub(pat, r'\g<1>06\2', s[m.start():], count=1)


def add_foot_col(s, mobile):
    if FOOT_START in s:
        return re.sub(re.escape(FOOT_START) + '.*?' + re.escape(FOOT_END), lambda m: foot_col(), s, flags=re.S)
    pat = r'(<div class="m-foot-cols">.*?<h4>Product</h4>.*?</div>)' if mobile else r'(<nav class="zfoot-cols">\s*<div><h4>Product</h4>.*?</div>)'
    m = re.search(pat, s, re.S)
    if not m:
        return s
    return s[:m.end()] + '\n' + foot_col() + s[m.end():]


def page_path(rel, mobile):
    rel = rel[2:] if mobile else rel
    p = '/' + rel[:-5]
    if p in ('/index', '/home'):
        p = '/'
    return p


def inject_all():
    for dp, dn, fn in os.walk(ROOT):
        if '.git' in dp or os.sep + 'tools' in dp:
            continue
        for f in fn:
            if not f.endswith('.html'):
                continue
            rel = os.path.relpath(os.path.join(dp, f), ROOT)
            s = rd(rel)
            mobile = rel.startswith('m' + os.sep)
            path = page_path(rel, mobile)
            if mobile and 'class="m-menu-nav"' in s:
                s = add_resources_nav(inject_nav_mobile(s, path), True, path)
            elif not mobile and 'class="znav-nav"' in s:
                s = add_resources_nav(inject_nav_desktop(s, path), False, path)
            wr(rel, add_foot_col(s, mobile))
    css = rd('m/mobile.css')
    if '/* ZSOL-NAV:START' in css:
        css = re.sub(r'/\* ZSOL-NAV:START.*?/\* ZSOL-NAV:END \*/\n', lambda m: nav_css_m(), css, flags=re.S)
    else:
        css = css.rstrip('\n') + '\n\n' + nav_css_m()
    wr('m/mobile.css', css)


# ------------------------------------------------------------------ shared blocks
def lbadge(l):
    return '<span class="zs-l zs-%s">%s</span>' % (l.lower(), l)


def tech(t):
    return '<span class="zs-tech" title="%s">%s</span>' % (E(TECH_TAGS.get(t, '')), E(t))


def eyebrow(txt, dot=''):
    return '<div class="zs-eye"><i%s></i>%s</div>' % (' style="--d:%s"' % dot if dot else '', txt)


def sol_list(items, layer_of):
    return '<ul class="zs-sols">%s</ul>' % ''.join(
        '<li><span class="zs-sn">%s</span><span class="zs-sm">%s%s</span></li>' % (E(n), tech(t), lbadge(layer_of(n, t)))
        for n, t in items)


def kpis(ks):
    return '<div class="zs-kpis">%s</div>' % ''.join(
        '<div class="zs-kpi"><b>%s</b><span>%s</span></div>' % (E(v), E(k)) for k, v in ks)


def outcomes(os_, caveat, src=False):
    cells = ''.join('<div class="zs-out"><b>%s</b><span>%s</span>%s</div>'
                    % (E(o[0]), E(o[1]), '<em>%s</em>' % E(o[2]) if src and len(o) > 2 else '') for o in os_)
    return '<div class="zs-outs">%s</div><p class="zs-cav">%s</p>' % (cells, E(caveat))


def scorecard(sec):
    l1 = ''.join('<tr><td>%s</td><td>%s</td><td><b>%s</b><i class="ok"></i></td></tr>' % (E(a), E(b), E(c)) for a, b, c in sec['l1'])
    l2 = ''.join('<tr><td>%s</td><td>%s</td><td><b>%s</b></td></tr>' % (E(a), E(b), E(c)) for a, b, c in sec['l2'])
    l3 = ''.join('<div class="zs-q"><span>You</span><p>%s</p></div><div class="zs-a"><span>Iris</span><p>%s</p></div>'
                 % (E(q), E(a)) for q, a in sec['l3'])
    return ('<div class="zs-sc"><div class="zs-schead"><span class="zs-live"><i></i>LIVE · ILLUSTRATIVE DATA</span>'
            '<span class="zs-co">%s</span><span class="zs-alert">%s</span></div>'
            '<div class="zs-scgrid"><div class="zs-scb"><h5>%s Zen Rules <small>thresholds</small></h5>'
            '<table><thead><tr><th>Rule</th><th>Threshold</th><th>Now</th></tr></thead><tbody>%s</tbody></table></div>'
            '<div class="zs-scb"><h5>%s Zen Models <small>predictions</small></h5>'
            '<table><thead><tr><th>Model</th><th>Predicts</th><th>Accuracy</th></tr></thead><tbody>%s</tbody></table></div>'
            '<div class="zs-scb zs-chat"><h5>%s Ask Iris <small>the exchange</small></h5>%s</div></div>'
            '<p class="zs-fict">%s is a fictional showcase company. Every figure is illustrative.</p></div>'
            % (E(sec['company']), E(sec['alert']), lbadge('L1'), l1, lbadge('L2'), l2, lbadge('L3'), l3,
               E(sec['company'].split(' · ')[0])))


def fb_groups(sec):
    return ''.join('<div class="zs-grp"><h5>%s <small>%s</small></h5>%s</div>'
                   % (E(g['title']), E(g['sub']), sol_list(g['items'], lambda n, t: fb_layer(t))) for g in sec['groups'])


def fa_groups(sec):
    out = ''.join('<div class="zs-grp"><h5>%s <small>%s</small></h5>%s</div>'
                  % (E(g['title']), E(g['sub']), sol_list(g['items'], lambda n, t, L=g['layer']: L)) for g in sec['groups'])
    return out + core_pos()


def core_pos():
    return ('<div class="zs-grp zs-core"><h5>12 core POS solutions <small>Standard in every Fashion sector.</small></h5>'
            '<div class="zs-chips">%s</div></div>' % ''.join('<span>%s</span>' % E(c) for c in CORE_POS))


def panel_head(sec, ind):
    if ind == 'fb':
        meta = '%s · %d formats · %d AI solutions · demo brand %s (fictional)' % (sec['code'], sec['formats'], sec['count'], sec['brand'])
    else:
        meta = '%s · %d sector AI solutions + 12 core POS' % (sec['code'], sec['count'])
    return ('<div class="zs-ph"><div class="zs-pmeta">%s</div><h3>%s</h3></div>' % (E(meta), E(sec['name'])))


def cta_row(sec, ind, extra=''):
    demo = sec['link'] if ind == 'fb' else '/fashion/sector-solutions'
    return ('<div class="zs-prow">%s<a class="zs-btn zs-btn-ghost" href="%s">Open the live sector demo <span>→</span></a>'
            '<button type="button" class="zs-btn" data-book="call">Book a call — the %s <span>→</span></button></div>'
            % (extra, demo, E(sec['stack'])))


def panel_full(sec, ind):
    if ind == 'fb':
        body = ('<p class="zs-hl">%s</p><ul class="zs-prom">%s</ul>'
                '<div class="zs-boardrow"><div>%s<p class="zs-board">%s</p></div>%s</div>'
                '<div class="zs-sub"><h4>The solution catalogue <small>%d solutions · every card opens a live guided demo</small></h4><div class="zs-grps">%s</div></div>'
                '<div class="zs-story"><h4>%s</h4>%s</div>'
                '<div class="zs-sub"><h4>What an operator can expect</h4>%s</div>%s'
                % (E(sec['headline']), ''.join('<li>%s</li>' % E(x) for x in sec['promises']),
                   eyebrow('On the board · live · illustrative', sec['hue']), E(sec['board']), kpis(sec['kpis']),
                   sec['count'], fb_groups(sec), E(sec['story_t']), ''.join('<p>%s</p>' % E(x) for x in sec['story']),
                   outcomes(sec['outcomes'], PLATFORM['fb_caveat']), cta_row(sec, ind)))
    else:
        does = ''.join('<div class="zs-does"><h5>%s</h5><p>%s</p><em>%s</em></div>' % (E(a), E(b), E(c)) for a, b, c in sec['does'])
        scen = ''.join('<div class="zs-scen"><div class="zs-scent">%s %s</div><p class="zs-shows"><span>On screen</span>%s</p>'
                       '<p class="zs-says"><span>Iris says</span>%s</p></div>' % (E(n), lbadge(L), E(sh), E(sa))
                       for n, L, sh, sa in sec['scen'])
        body = ('<div class="zs-doesrow">%s</div>'
                '<div class="zs-boardrow"><div>%s<p class="zs-board">%s</p></div>%s</div>'
                '<div class="zs-sub"><h4>Balanced Scorecard <small>%s</small></h4>%s</div>'
                '<div class="zs-sub"><h4>The solution catalogue <small>L1 groups fire on the shift the breach happens · L2 groups are modelled early enough to act on</small></h4><div class="zs-grps">%s</div></div>'
                '<div class="zs-sub"><h4>Guided demo scenarios <small>illustrative</small></h4><div class="zs-scens">%s</div></div>%s'
                % (does, eyebrow('On the board · live · illustrative', sec['hue']), E(sec['board']), kpis(sec['kpis']),
                   E(sec['company']), scorecard(sec), fa_groups(sec), scen, cta_row(sec, ind)))
    return panel_head(sec, ind) + body


def matches(p, name):
    n = name.lower()
    return any(k in n for k in p['kw'])


def panel_product(sec, ind, p):
    head = panel_head(sec, ind)
    if p['slug'] == 'balanced-scorecard':
        if ind == 'fb':
            body = ('<div class="zs-boardrow"><div>%s<p class="zs-board">%s</p><p class="zs-note">Demo brand: %s (fictional).</p></div>%s</div>'
                    % (eyebrow('This sector’s board', sec['hue']), E(sec['board']), E(sec['brand']), kpis(sec['kpis'])))
            body += '<div class="zs-sub"><h4>Modelled outcomes on this board</h4>%s</div>' % outcomes(sec['outcomes'], PLATFORM['fb_caveat'])
        else:
            body = ('<div class="zs-boardrow"><div>%s<p class="zs-board">%s</p></div>%s</div>%s'
                    % (eyebrow('This sector’s board', sec['hue']), E(sec['board']), kpis(sec['kpis']), scorecard(sec)))
        return head + body + cta_row(sec, ind)
    if ind == 'fb':
        items = [(n, t, fb_layer(t)) for g in sec['groups'] for n, t in g['items'] if matches(p, n)]
    else:
        items = [(n, t, g['layer']) for g in sec['groups'] for n, t in g['items'] if matches(p, n)]
    if items:
        lst = sol_list([(n, t) for n, t, _ in items], lambda n, t, d={i[0]: i[2] for i in items}: d[n])
        body = ('<div class="zs-sub"><h4>%s solutions that run on %s <small>%d of %d in this sector</small></h4>%s</div>'
                % (E(sec['short']), E(p['name']), len(items), sec['count'], lst))
    else:
        body = ('<p class="zs-note">No %s solution is named for %s on its own — it runs underneath the board and '
                'reads the same data every other product writes.</p>' % (E(sec['short']), E(p['name'])))
    if ind == 'fa' and p['slug'] in ('point-of-sale', 'numerus'):
        body += core_pos()
    return head + body + cta_row(sec, ind)


def explorer(mode, p=None, title=None, sub=None):
    """Sector selector -- desktop ke reference screenshot jaisa pill bar."""
    def pills(lst, ind):
        return ''.join('<button type="button" class="zs-pill" data-sec="%s" data-ind="%s" style="--sh:%s" title="%s">'
                       '<i>%s</i>%s</button>' % (s['id'], ind, s['hue'], E(s['name']), s['num'], E(s['short'])) for s in lst)
    panels = []
    for lst, ind in ((FB, 'fb'), (FA, 'fa')):
        for s in lst:
            inner = panel_full(s, ind) if mode == 'full' else panel_product(s, ind, p)
            panels.append('<article class="zs-panel" id="sector-%s" data-sec="%s" data-ind="%s" style="--sh:%s" hidden>%s</article>'
                          % (s['id'], s['id'], ind, s['hue'], inner))
    return ('<section class="zs-sec zs-sx" id="sectors"><div class="zs-wrap">'
            '<div class="zs-sechead">%s<h2>%s</h2><p>%s</p></div></div>'
            '<div class="zs-sxbar" id="zsSxbar"><div class="zs-sxin">'
            '<div class="zs-sxlab">SECTORS</div>'
            '<div class="zs-sxmain"><div class="zs-ind" role="tablist" aria-label="Industry">'
            '<button type="button" role="tab" data-ind="fb" aria-selected="true">Food &amp; Beverage <small>10</small></button>'
            '<button type="button" role="tab" data-ind="fa" aria-selected="false">Fashion Retail <small>9</small></button></div>'
            '<div class="zs-sxrow" data-row="fb">%s</div><div class="zs-sxrow" data-row="fa" hidden>%s</div></div>'
            '</div></div><div class="zs-wrap"><div class="zs-panels">%s</div></div></section>'
            % (eyebrow('Sector playbooks'), title, sub, pills(FB, 'fb'), pills(FA, 'fa'), ''.join(panels)))


def layers_block(heading='One agent. <em>Three layers.</em>', sub=None):
    sub = sub or PLATFORM['iris']
    cells = ''.join('<div class="zs-layer zs-%s"><b>%s</b><h3>%s</h3><p>%s</p></div>' % (l.lower(), l, E(n), E(d))
                    for l, n, d in PLATFORM['layers'])
    iris = ''
    if os.path.exists(os.path.join(SOL, 'icons', 'iris.png')):
        iris = ('<a class="zs-iris" href="/meet-iris"><span class="zs-ico is-img"><img src="/solutions/icons/iris.png" alt="" width="240" height="256" loading="lazy"></span>'
                '<span><b>Iris</b><em>Meet the agent →</em></span></a>')
    return ('<section class="zs-sec"><div class="zs-wrap"><div class="zs-sechead zs-hasiris">%s%s<h2>%s</h2><p>%s</p></div>'
            '<div class="zs-layers">%s</div></div></section>'
            % (iris, eyebrow('How it decides'), heading, E(sub), cells))


def product_cards(exclude=None):
    out = []
    for i, p in enumerate(PRODUCTS, 1):
        if p['slug'] == exclude:
            continue
        out.append('<a class="zs-card" href="%s" style="--ph:%s">%s<div class="zs-cardtx"><span class="zs-cn">0%d · %s</span>'
                   '<h3>%s</h3><p>%s</p></div><span class="zs-go">Explore %s <span>→</span></span></a>'
                   % (plink(p), p['hue'], icon(p), i, E(p['label']), E(pname(p)), E(p['what']), E(p['name'])))
    return '<div class="zs-cards">%s</div>' % ''.join(out)


def cta_band(title):
    return ('<section class="zs-sec zs-ctasec"><div class="zs-wrap"><div class="zs-cta">'
            '<div><h2>%s</h2><p>%s.</p></div><div class="zs-ctabtns">'
            '<button type="button" class="zs-btn" data-book="call">Book a call with our consultant <span>→</span></button>'
            '<a class="zs-btn zs-btn-ghost" href="mailto:info@zentallio.com">info@zentallio.com</a></div>'
            '<div class="zs-ctameta"><a href="tel:+923270000901">+92 327 000 0901</a><a href="tel:+19294192694">+1 929 419 2694</a>'
            '<span>Pricing depends on your sector, formats and outlet count — we walk you through it on your own formats.</span></div>'
            '</div></div></section>' % (title, E(PLATFORM['book'])))


# ------------------------------------------------------------------ pages (body)
def body_index():
    nums = ''.join('<div><b>%s</b><span>%s</span></div>' % (E(a), E(b)) for a, b in PLATFORM['numbers'])
    cluster = ''.join('<a class="zs-hc" href="%s" style="--i:%d;--ph:%s">%s<span>%s</span></a>'
                      % (plink(p), k, p['hue'], icon(p), E(p['name'])) for k, p in enumerate(PRODUCTS))
    return ('<section class="zs-hero zs-hero-idx"><div class="zs-glow"></div><div class="zs-wrap"><div class="zs-hgrid zs-hgrid-idx"><div>'
            '%s<h1>Six products. <em>One data spine.</em></h1>'
            '<p class="zs-lead">%s</p><p class="zs-lead2">%s</p>'
            '<div class="zs-hbtns"><a class="zs-btn" href="#sectors">Find your sector <span>↓</span></a>'
            '<a class="zs-btn zs-btn-ghost" href="#products">See the six products</a></div></div>'
            '<div class="zs-hcl" aria-label="The six products">%s</div></div>'
            '<div class="zs-nums">%s</div></div></section>'
            '<section class="zs-sec" id="products"><div class="zs-wrap"><div class="zs-sechead">%s'
            '<h2>The whole business on <em>one board.</em></h2><p>Every sector runs the same six live products. They read the same data, so the scorecard, the till, the ledger, the supply chain, operations and the roster never disagree.</p></div>%s</div></section>'
            '%s%s%s'
            % (eyebrow('Solutions'), E(PLATFORM['who']), E(PLATFORM['spine']), cluster, nums,
               eyebrow('Six live products'), product_cards(),
               explorer('full', title='Pick your sector. <em>See it configured.</em>',
                        sub='Choose a sector to see its promises, the live board, every AI solution with the layer behind it, and what an operator can expect.'),
               layers_block(), cta_band('See it configured on <em>your formats.</em>')))


def body_product(p):
    i = PRODUCTS.index(p) + 1
    pillars = ''.join('<div class="zs-pil"><h3>%s</h3><p>%s</p></div>' % (E(a), E(b)) for a, b in p['pillars'])
    extra = ''
    if p.get('spine'):
        extra = ('<section class="zs-sec zs-tight"><div class="zs-wrap"><div class="zs-spine">%s</div></div></section>'
                 % ''.join('<span><i>%02d</i>%s</span>' % (k, E(s)) for k, s in enumerate(p['spine'], 1)))
    if p['slug'] == 'balanced-scorecard':
        ex_t, ex_s = 'One board for <em>every sector.</em>', 'Pick a sector to see what its board watches — and, for Fashion, the full L1 rules, L2 models and Ask Iris exchange behind it.'
    else:
        ex_t = '%s, <em>sector by sector.</em>' % E(p['name'])
        ex_s = 'Pick a sector to see the AI solutions in its catalogue that run on %s — named exactly as they appear in the playbook.' % E(p['name'])
    return ('<section class="zs-hero zs-hero-p" style="--ph:%s"><div class="zs-glow"></div><div class="zs-wrap zs-hgrid"><div>'
            '<nav class="zs-crumb" aria-label="Breadcrumb"><a href="/solutions">Solutions</a><span>/</span>%s</nav>'
            '%s<h1>%s%s</h1><p class="zs-tagl">%s</p><p class="zs-lead">%s</p>'
            '<div class="zs-hbtns"><a class="zs-btn" href="/food/app/%s">Open the live demo <span>→</span></a>'
            '<button type="button" class="zs-btn zs-btn-ghost" data-book="call">Book a call</button></div>'
            '<div class="zs-plabel"><span>%s</span><span>Runs on every F&amp;B and Fashion sector board</span></div></div>'
            '<div class="zs-pwrap">%s</div></div></section>'
            '<section class="zs-sec"><div class="zs-wrap"><div class="zs-sechead">%s<h2>What %s <em>does.</em></h2></div>'
            '<div class="zs-pils">%s</div></div></section>%s'
            '%s'
            '%s'
            '<section class="zs-sec"><div class="zs-wrap"><div class="zs-sechead">%s<h2>What an operator <em>can expect.</em></h2>'
            '<p>Modelled outcomes from the sector playbooks %s feeds.</p></div>%s</div></section>'
            '<section class="zs-sec"><div class="zs-wrap"><div class="zs-sechead">%s<h2>The other five, <em>same spine.</em></h2></div>%s</div></section>'
            '%s'
            % (p['hue'], E(p['name']), eyebrow('Product 0%d · %s' % (i, E(p['label'])), p['hue']), E(p['name']),
               ' <em>· %s</em>' % E(p['role']) if p['slug'] in ('numerus', 'nexus', 'motus', 'manus') else '',
               E(p['line']), E(p['what']), p['app'], E(p['label']), poster(p),
               eyebrow('Inside the product', p['hue']), E(p['name']), pillars, extra,
               layers_block('How %s <em>decides.</em>' % E(p['name'])),
               explorer('product', p, ex_t, ex_s),
               eyebrow('Outcomes', p['hue']), E(p['name']), outcomes(p['outcomes'], PLATFORM['fb_caveat'], src=True),
               eyebrow('Six live products'), product_cards(p['slug']),
               cta_band('See %s on <em>your numbers.</em>' % E(p['name']))))



# ------------------------------------------------------------------ mobile bodies
# Phone par content chhota aur to-the-point: headline + numbers pehle, lambi
# lists accordion mein. Desktop markup ko haath nahi lagaya.
def acc(title, inner, count='', open_=False):
    return ('<details class="m-acc zm-acc"%s><summary>%s%s</summary><div class="m-acc-body">%s</div></details>'
            % (' open' if open_ else '', E(title), '<span class="zm-cnt">%s</span>' % E(count) if count else '', inner))


def m_sols(items):
    """items: [(name, layer)] -- compact rows, sirf naam + layer."""
    return '<ul class="zm-sols">%s</ul>' % ''.join('<li><span>%s</span>%s</li>' % (E(n), lbadge(L)) for n, L in items)


def m_outs(os_, src=False):
    return ('<div class="zm-outs">%s</div><p class="zm-cav">Modelled from pilot assumptions and comparable benchmarks — not yet a deployed-client result.</p>'
            % ''.join('<div><b>%s</b><span>%s</span>%s</div>' % (E(o[0]), E(o[1]), '<em>%s</em>' % E(o[2]) if src and len(o) > 2 else '')
                      for o in os_))


def m_kpis(ks):
    return ('<div class="zm-kpis"><span class="zm-live"><i></i>Live board · illustrative</span><div>%s</div></div>'
            % ''.join('<p><b>%s</b><span>%s</span></p>' % (E(v), E(k)) for k, v in ks))


def m_links(sec, ind):
    demo = sec['link'] if ind == 'fb' else '/fashion/sector-solutions'
    return '<a class="zm-more" href="%s">Open the live %s demo <span>→</span></a>' % (demo, E(sec['short']))


def m_head(sec, ind):
    if ind == 'fb':
        meta = '%s · %d solutions · %d formats' % (sec['code'], sec['count'], sec['formats'])
    else:
        meta = '%s · %d solutions + 12 core POS' % (sec['code'], sec['count'])
    return '<div class="zm-ph"><span>%s</span><h3>%s</h3></div>' % (E(meta), E(sec['name']))


def m_fa_cat(sec):
    rows = [(n, g['layer']) for g in sec['groups'] for n, _ in g['items']]
    return m_sols(rows) + '<div class="zm-core"><span>+ 12 core POS</span>%s</div>' % ', '.join(E(c) for c in CORE_POS)


def m_scen(sec):
    return ''.join('<div class="zm-scen"><b>%s %s</b><p>%s</p></div>' % (E(n), lbadge(L), E(sa)) for n, L, _, sa in sec['scen'])


def m_panel_full(sec, ind):
    out = m_head(sec, ind)
    if ind == 'fb':
        out += '<p class="zm-hl">%s</p>' % E(sec['headline'])
        out += m_kpis(sec['kpis'])
        out += '<h4 class="zm-h4">What an operator can expect</h4>' + m_outs(sec['outcomes'])
        out += acc('Solution catalogue', m_sols([(n, fb_layer(t)) for g in sec['groups'] for n, t in g['items']]), str(sec['count']))
        out += acc('Why it matters', '<p class="zm-story"><b>%s</b> %s</p><ul class="zm-prom">%s</ul>'
                   % (E(sec['story_t']), E(sec['story'][0]), ''.join('<li>%s</li>' % E(x) for x in sec['promises'])))
    else:
        out += '<ul class="zm-does">%s</ul>' % ''.join('<li><b>%s</b><span>%s</span></li>' % (E(a), E(c)) for a, _, c in sec['does'])
        out += m_kpis(sec['kpis'])
        out += acc('Live scorecard', scorecard(sec), 'L1 · L2 · L3')
        out += acc('Solution catalogue', m_fa_cat(sec), str(sec['count']))
        out += acc('What Iris says', m_scen(sec), 'demo')
    return out + m_links(sec, ind)


def m_panel_product(sec, ind, p):
    out = m_head(sec, ind)
    if p['slug'] == 'balanced-scorecard':
        out += '<p class="zm-hl zm-hl-s">%s</p>' % E(sec['board'])
        out += m_kpis(sec['kpis'])
        if ind == 'fb':
            out += m_outs(sec['outcomes'][:2])
        else:
            out += acc('Live scorecard', scorecard(sec), 'L1 · L2 · L3', open_=True)
        return out + m_links(sec, ind)
    if ind == 'fb':
        items = [(n, fb_layer(t)) for g in sec['groups'] for n, t in g['items'] if matches(p, n)]
    else:
        items = [(n, g['layer']) for g in sec['groups'] for n, t in g['items'] if matches(p, n)]
    if items:
        out += '<p class="zm-cnt2"><b>%d</b> of %d %s solutions run on %s</p>%s' % (
            len(items), sec['count'], E(sec['short']), E(p['name']), m_sols(items))
    else:
        out += '<p class="zm-cnt2">%s runs underneath this board — no %s solution is named for it on its own.</p>' % (E(p['name']), E(sec['short']))
    if ind == 'fa' and p['slug'] in ('point-of-sale', 'numerus'):
        out += acc('12 core POS solutions', '<div class="zs-chips">%s</div>' % ''.join('<span>%s</span>' % E(c) for c in CORE_POS))
    return out + m_links(sec, ind)


def m_explorer(mode, p=None, title='', sub=''):
    def pills(lst, ind):
        return ''.join('<button type="button" class="zs-pill" data-sec="%s" data-ind="%s" style="--sh:%s">%s</button>'
                       % (s['id'], ind, s['hue'], E(s['short'])) for s in lst)
    panels = []
    for lst, ind in ((FB, 'fb'), (FA, 'fa')):
        for s in lst:
            inner = m_panel_full(s, ind) if mode == 'full' else m_panel_product(s, ind, p)
            panels.append('<article class="zs-panel" id="sector-%s" data-sec="%s" data-ind="%s" style="--sh:%s" hidden>%s</article>'
                          % (s['id'], s['id'], ind, s['hue'], inner))
    return ('<section class="zs-sec zs-sx zm-sx" id="sectors"><div class="zs-wrap"><div class="zm-sh">%s<h2>%s</h2>%s</div></div>'
            '<div class="zs-sxbar" id="zsSxbar"><div class="zs-sxin">'
            '<div class="zs-ind" role="tablist" aria-label="Industry">'
            '<button type="button" role="tab" data-ind="fb" aria-selected="true">Food &amp; Beverage</button>'
            '<button type="button" role="tab" data-ind="fa" aria-selected="false">Fashion Retail</button></div>'
            '<div class="zs-sxrow" data-row="fb">%s</div><div class="zs-sxrow" data-row="fa" hidden>%s</div>'
            '</div></div><div class="zs-wrap"><div class="zs-panels">%s</div></div></section>'
            % (eyebrow('Sector playbooks'), title, '<p>%s</p>' % sub if sub else '', pills(FB, 'fb'), pills(FA, 'fa'), ''.join(panels)))


def m_products(exclude=None):
    return '<div class="zm-prods">%s</div>' % ''.join(
        '<a class="zm-prod" href="%s" style="--ph:%s">%s<span class="zm-pt"><b>%s</b><em>%s</em></span><i>→</i></a>'
        % (plink(p), p['hue'], icon(p), E(pname(p)), E(p['label']), )
        for p in PRODUCTS if p['slug'] != exclude)


def m_layers(heading):
    rows = ''.join('<li class="zs-%s"><b>%s</b><span><strong>%s</strong>%s</span></li>' % (l.lower(), l, E(n), E(d))
                   for (l, n, _), d in zip(PLATFORM['layers'], ('Fires the instant a threshold breaks.',
                                                                   'Predicts early, names the cause, costs the move.',
                                                                   'Answers in plain words with the next move.')))
    return ('<section class="zs-sec"><div class="zs-wrap"><div class="zm-sh">%s<h2>%s</h2></div>'
            '<ul class="zm-layers">%s</ul></div></section>'
            % (eyebrow('How it decides'), heading, rows))


def m_cta(title):
    return ('<section class="zs-sec zs-ctasec"><div class="zs-wrap"><div class="zm-cta"><h2>%s</h2>'
            '<p>Configured demo in 3–5 working days. No hardware, no long-term contract.</p>'
            '<button type="button" class="zs-btn" data-book="call">Book a call <span>→</span></button>'
            '<div class="zm-ctal"><a href="mailto:info@zentallio.com">info@zentallio.com</a><a href="tel:+923270000901">+92 327 000 0901</a><a href="tel:+19294192694">+1 929 419 2694</a></div>'
            '</div></div></section>' % title)


def m_body_index():
    cluster = ''.join('<a class="zs-hc" href="%s" style="--i:%d;--ph:%s">%s<span>%s</span></a>'
                      % (plink(p), k, p['hue'], icon(p), E(p['name'])) for k, p in enumerate(PRODUCTS))
    return ('<section class="zs-hero zm-hero"><div class="zs-glow"></div><div class="zs-wrap">%s'
            '<h1>Six products. <em>One data spine.</em></h1>'
            '<p class="zm-lead">From the till to the ledger — configured for your sector, narrated by Iris.</p>'
            '<div class="zs-hcl">%s</div>'
            '<div class="zm-stats"><p><b>19</b><span>sectors</span></p><p><b>149</b><span>F&amp;B solutions</span></p><p><b>6</b><span>live products</span></p></div>'
            '<a class="zs-btn zm-wide" href="#sectors">Find your sector <span>↓</span></a></div></section>'
            '<section class="zs-sec" id="products"><div class="zs-wrap"><div class="zm-sh">%s<h2>Six products, <em>one board.</em></h2>'
            '<p>Same data in every product — so they never disagree.</p></div>%s</div></section>'
            '%s%s%s'
            % (eyebrow('Solutions'), cluster, eyebrow('The products'), m_products(),
               m_explorer('full', title='Pick your <em>sector.</em>', sub='Numbers, solutions and outcomes for each one.'),
               m_layers('One agent. <em>Three layers.</em>'), m_cta('See it on <em>your formats.</em>')))


def m_body_product(p):
    i = PRODUCTS.index(p) + 1
    pils = ''.join('<li><b>%02d</b><span><strong>%s</strong>%s</span></li>' % (k, E(a), E(b)) for k, (a, b) in enumerate(p['pillars'], 1))
    spine = ''
    if p.get('spine'):
        spine = '<div class="zm-spine">%s</div>' % ''.join('<span>%s</span>' % E(s) for s in p['spine'])
    sub = ('What each sector’s board watches.' if p['slug'] == 'balanced-scorecard'
           else 'The solutions in each playbook that run on %s.' % E(p['name']))
    return ('<section class="zs-hero zm-hero zm-hero-p" style="--ph:%s"><div class="zs-glow"></div><div class="zs-wrap">'
            '<nav class="zs-crumb" aria-label="Breadcrumb"><a href="/solutions">Solutions</a><span>/</span>0%d</nav>'
            '<div class="zs-pwrap">%s</div>'
            '<span class="zm-plabel">%s</span><h1>%s%s</h1><p class="zm-lead">%s</p>'
            '<div class="zm-btns"><a class="zs-btn" href="/food/app/%s">Open the live demo <span>→</span></a>'
            '<button type="button" class="zs-btn zs-btn-ghost" data-book="call">Book a call</button></div></div></section>'
            '<section class="zs-sec"><div class="zs-wrap"><div class="zm-sh">%s<h2>What it <em>does.</em></h2></div>'
            '<ul class="zm-pils">%s</ul>%s</div></section>'
            '%s'
            '<section class="zs-sec"><div class="zs-wrap"><div class="zm-sh">%s<h2>What to <em>expect.</em></h2></div>%s</div></section>'
            '%s'
            '<section class="zs-sec"><div class="zs-wrap"><div class="zm-sh">%s<h2>The other <em>five.</em></h2></div>%s</div></section>'
            '%s'
            % (p['hue'], i, poster(p), E(p['label']), E(p['name']),
               ' <em>· %s</em>' % E(p['role']) if p['slug'] in ('numerus', 'nexus', 'motus', 'manus') else '',
               E(p['line']), p['app'],
               eyebrow('Inside the product', p['hue']), pils, spine,
               m_explorer('product', p, '%s by <em>sector.</em>' % E(p['name']), sub),
               eyebrow('Outcomes', p['hue']), m_outs(p['outcomes'], src=True),
               m_layers('How it <em>decides.</em>'),
               eyebrow('Six live products'), m_products(p['slug']),
               m_cta('See %s on <em>your numbers.</em>' % E(p['name']))))


# ------------------------------------------------------------------ page shells
def chrome_parts():
    s = rd('contact.html')
    head_pre = s[:s.find('<meta content="width=device-width')]
    i = s.find('<style id="znav-css">')
    znav_css = s[i:s.find('</style>', i) + 8]
    gtm_ns = re.search(r'<!-- Google Tag Manager \(noscript\) -->.*?<!-- End Google Tag Manager \(noscript\) -->', s, re.S).group(0)
    foot = s[s.find('<footer'):s.find('</footer>') + 9]
    ck0 = s.find('<div aria-label="Cookie notice"')
    ck = s[ck0:s.find('</script>', ck0) + 9]
    k = s.find("<script>(function(){\n var mb=document.getElementById('znavBtn')")
    navjs = s[k:s.find('</script>', k) + 9]
    return head_pre, znav_css, gtm_ns, foot, ck, navjs


def meta(title, desc, path, mobile):
    url = 'https://zentallio.com' + path
    m = ('<meta content="width=device-width,initial-scale=1" name="viewport"/>\n<title>%s</title>\n'
         '<meta content="%s" name="description"/>\n<meta content="#05080F" name="theme-color"/>\n'
         '<link href="%s" rel="canonical"/>\n'
         '<meta content="website" property="og:type"/>\n<meta content="Zentallio" property="og:site_name"/>\n'
         '<meta content="%s" property="og:title"/>\n<meta content="%s" property="og:description"/>\n'
         '<meta content="%s" property="og:url"/>\n<meta content="https://zentallio.com/og-image.png" property="og:image"/>\n'
         '<meta content="summary_large_image" name="twitter:card"/>\n'
         % (E(title), E(desc), url, E(title), E(desc), ('https://m.zentallio.com' + path) if mobile else url))
    if not mobile:
        m += '<link rel="alternate" media="only screen and (max-width: 640px)" href="https://m.zentallio.com%s">\n' % path
    return m


FONTS = ('<link href="https://fonts.googleapis.com" rel="preconnect"/>\n<link crossorigin="" href="https://fonts.gstatic.com" rel="preconnect"/>\n'
         '<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,300;1,9..144,400'
         '&amp;family=Inter:wght@400;500;600;700&amp;family=JetBrains+Mono:wght@400;500;700&amp;display=swap" rel="stylesheet"/>\n')


def desktop_page(path, title, desc, body, parts):
    head_pre, znav_css, gtm_ns, foot, ck, navjs = parts
    navhtml = ('<header class="znav">\n<a aria-label="Zentallio home" class="znav-brand" href="/">Zentallio</a>\n'
               '<button aria-controls="znavOv" aria-expanded="false" aria-label="Open menu" class="znav-btn" id="znavBtn"><span></span><span></span><span></span></button>\n'
               '</header>\n<div aria-hidden="true" class="znav-ov" id="znavOv">\n<nav class="znav-nav">\n'
               '<a href="/food-beverage"><i>01</i><span>Food &amp; Beverage</span><b class="znav-d-fb"></b></a>\n'
               '<a href="/fashion"><i>02</i><span>Fashion Retail</span><b class="znav-d-fa"></b></a>\n'
               '%s\n<a href="/meet-iris"><i>04</i><span>Meet Iris</span><b class="znav-d-ai"></b></a>\n'
               '<a href="/resources"><i>05</i><span>Resources</span></a>\n'
               '<a href="/contact"><i>06</i><span>Contact</span></a>\n</nav>\n'
               '<div class="znav-foot">info@zentallio.com</div>\n</div>\n' % nav_group('d', True))
    return ('%s%s%s%s%s<link href="/solutions/solutions.css" rel="stylesheet"/>\n</head>\n<body class="zs-d">\n%s%s'
            '<main class="zs-main">\n%s\n</main>\n%s\n%s\n<link href="/booking.css" rel="stylesheet"/><script defer="" src="/booking.js"></script>\n'
            '<script defer src="/solutions/solutions.js"></script>\n%s</body>\n</html>\n'
            % (head_pre, meta(title, desc, path, False), FONTS, znav_css, NAV_CSS_D, gtm_ns, navhtml, body, foot, ck, navjs))


def mobile_page(path, title, desc, body):
    tpl = rd('m/meet-iris.html')
    head = tpl[:tpl.find('<meta name="viewport"')]
    gtm_ns = re.search(r'<!-- Google Tag Manager \(noscript\) -->.*?<!-- End Google Tag Manager \(noscript\) -->', tpl, re.S).group(0)
    foot = tpl[tpl.find('<footer class="m-foot">'):tpl.find('</footer>') + 9]
    menu = ('<header class="m-head">\n  <a class="m-brand" href="/" aria-label="Zentallio home">Zentallio</a>\n'
            '  <button class="m-burger" id="mBurger" aria-label="Open menu" aria-expanded="false" aria-controls="mMenu">\n'
            '    <span></span><span></span><span></span>\n  </button>\n</header>\n'
            '<div class="m-menu" id="mMenu" aria-hidden="true">\n  <nav class="m-menu-nav">\n'
            '    <a class="m-menu-item" href="/food-beverage"><i>01</i><span>Food &amp; Beverage</span><b class="m-d-fb"></b></a>\n'
            '    <a class="m-menu-item" href="/fashion"><i>02</i><span>Fashion Retail</span><b class="m-d-fa"></b></a>\n'
            '    %s\n    <a class="m-menu-item" href="/meet-iris"><i>04</i><span>Meet Iris</span><b class="m-d-ai"></b></a>\n'
            '    <a class="m-menu-item" href="/resources"><i>05</i><span>Resources</span></a>\n'
            '    <a class="m-menu-item" href="/contact"><i>06</i><span>Contact</span></a>\n  </nav>\n'
            '  <div class="m-menu-foot">info@zentallio.com</div>\n</div>\n' % nav_group('m', True))
    mt = ('<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<title>%s</title>\n'
          '<meta name="description" content="%s">\n<meta name="theme-color" content="#05080F">\n'
          '<link rel="canonical" href="https://zentallio.com%s">\n<link rel="icon" href="/favicon.svg" type="image/svg+xml">\n'
          '<link rel="apple-touch-icon" href="/apple-touch-icon.png">\n<meta property="og:title" content="%s">\n'
          '<meta property="og:description" content="%s">\n<meta property="og:url" content="https://m.zentallio.com%s">\n'
          '<meta property="og:type" content="website">\n<meta property="og:image" content="https://zentallio.com/og-image.png">\n'
          % (E(title), E(desc), path, E(title), E(desc), path))
    return ('%s%s%s<link rel="stylesheet" href="/m/mobile.css">\n<link rel="stylesheet" href="/booking.css">\n'
            '<link rel="stylesheet" href="/solutions/solutions.css">\n</head>\n<body data-accent="teal" class="zs-m">\n%s\n%s'
            '<main class="zs-main">\n%s\n</main>\n<div class="m-sticky-cta">\n  <a class="m-btn m-btn-primary" href="/contact" data-book="call">Book a call</a>\n</div>\n'
            '%s\n<script src="/m/mobile.js" defer></script>\n<script src="/booking.js" defer></script>\n'
            '<script src="/solutions/solutions.js" defer></script>\n</body>\n</html>\n'
            % (head, mt, FONTS, gtm_ns, menu, body, foot))


# ------------------------------------------------------------------ registration
def register(paths):
    mw = rd('middleware.js')
    a, b = mw.index('// MOBILE_READY:START'), mw.index('// MOBILE_READY:END')
    cur = set(re.findall(r"'([^']+)'", mw[a:b]))
    if not set(paths) <= cur:
        allp = sorted(cur | set(paths), key=lambda x: (x != '/', x))
        block = ('// MOBILE_READY:START\nconst MOBILE_READY = new Set([\n%s\n]);\n'
                 % '\n'.join("  '%s'," % x for x in allp))
        wr('middleware.js', mw[:a] + block + mw[b:])
    sm = rd('sitemap.xml')
    add = ''.join('  <url><loc>https://zentallio.com%s</loc><changefreq>monthly</changefreq><priority>%s</priority></url>\n'
                  % (x, '0.9' if x == '/solutions' else '0.8')
                  for x in paths if '<loc>https://zentallio.com%s</loc>' % x not in sm)
    if add:
        wr('sitemap.xml', sm.replace('</urlset>', add + '</urlset>'))


def main():
    build_images()
    parts = chrome_parts()
    pages = [('/solutions', 'Solutions — six live products, every sector · Zentallio',
              'Balanced Scorecard, Point of Sale, Numerus, Nexus, Motus and Manus on one data spine — configured for 10 Food & Beverage and 9 Fashion Retail sectors, narrated by Iris.',
              body_index(), m_body_index())]
    for p in PRODUCTS:
        pages.append(('/solutions/' + p['slug'], '%s — %s · Zentallio' % (pname(p), p['label']),
                      '%s %s' % (p['what'], 'Narrated by Iris, on every Zentallio sector board.'), body_product(p), m_body_product(p)))
    for path, title, desc, body, mbody in pages:
        wr(path[1:] + '.html', desktop_page(path, title, desc, body, parts))
        wr('m' + path + '.html', mobile_page(path, title, desc, mbody))
    inject_all()
    register([x[0] for x in pages])


if __name__ == '__main__':
    main()
