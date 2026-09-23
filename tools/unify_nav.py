#!/usr/bin/env python3
"""Home page ka navbar poori website ke har desktop page par lagata hai.

Site par 11 mukhtalif navbar variants the. Ye script sab ki jagah wahi
navbar rakhti hai jo index.html par hai -- markup, CSS aur JS teenon.

Classes `znav-` se namespace ki gayi hain kyunki `.top` aur `.brand` bohat
aam naam hain: food/app/*.html mein `.top` aur `.topbar` un demo screens ka
apna chrome hain, site navigation nahi. Namespacing ke bagair unka layout
toot jaata.

    python3 tools/unify_nav.py            # dry run
    python3 tools/unify_nav.py --apply
"""
import os, re, sys
from bs4 import BeautifulSoup

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP = {'cookie-banner.html'}

# Asal site navigation -- inhe canonical navbar se badla jaata hai.
REPLACE_SEL = [
    'header.top', '.menu-ov',      # pehle se canonical (chhoti tabdeelion ke sath)
    'div.zh-bar',                  # F&B / fashion hero ka brand bar
    'nav.zmenu-nav', '.zmenu',     # food-beverage ka overlay
    'nav.site-nav',                # resources.html
    'div.nav-row',                 # article pages
]
# Page ka apna chrome -- inhe haath nahi lagate:
#   div.top, div.topbar   food/app demo screens ka title bar
#   div.ed-top-rule       sirf ek decorative line

NAV_LINKS = [('01', 'Food &amp; Beverage', '/food-beverage', 'znav-d-fb'),
             ('02', 'Fashion Retail',      '/fashion',       'znav-d-fa'),
             ('03', 'Meet Iris',           '/meet-iris',     'znav-d-ai'),
             ('04', 'Contact',             '/contact',       '')]

CSS = """.znav{position:fixed;top:0;left:0;right:0;z-index:60;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px clamp(20px,4vw,46px)}
.znav-brand{font-family:var(--serif);font-weight:500;font-size:1.3rem;letter-spacing:-.01em;position:relative;display:inline-block;background:linear-gradient(100deg,#fff 0%,#fff 42%,#15F2F2 49%,#9B7BFF 53%,#fff 60%,#fff 100%);background-size:280% auto;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:znavShine 7s linear infinite}
.znav-brand::after{content:"";position:absolute;left:0;bottom:-4px;height:1.5px;width:100%;background:linear-gradient(90deg,#15F2F2,#9B7BFF);transform:scaleX(0);transform-origin:left;transition:transform .4s ease}
.znav-brand:hover::after{transform:scaleX(1)}
.znav-brand .dia{width:13px;height:13px;border-radius:3px;background:linear-gradient(135deg,var(--teal),var(--violet));transform:rotate(45deg);animation:znavDia 7s ease-in-out infinite}
.znav-btn{width:44px;height:44px;border:1px solid var(--line2);border-radius:50%;background:rgba(255,255,255,.03);cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;transition:.25s;backdrop-filter:blur(6px)}
.znav-btn:hover{border-color:rgba(255,255,255,.4)}
.znav-btn span{display:block;width:16px;height:1.5px;background:var(--ink);transition:transform .3s,opacity .3s}
.znav-btn.open span:nth-child(1){transform:translateY(5.5px) rotate(45deg)}
.znav-btn.open span:nth-child(2){opacity:0}
.znav-btn.open span:nth-child(3){transform:translateY(-5.5px) rotate(-45deg)}
.znav-ov{position:fixed;inset:0;z-index:50;background:rgba(5,8,15,.97);backdrop-filter:blur(14px);display:flex;flex-direction:column;justify-content:center;padding:0 clamp(28px,8vw,130px);opacity:0;visibility:hidden;transition:opacity .45s ease,visibility .45s}
.znav-ov.open{opacity:1;visibility:visible}
.znav-nav a{display:flex;align-items:center;gap:clamp(16px,2vw,28px);padding:clamp(11px,1.7vw,20px) 0;border-bottom:1px solid var(--line);font-family:var(--serif);font-weight:300;font-size:clamp(2rem,5.6vw,4.4rem);color:var(--fg2);letter-spacing:-.02em;transition:color .3s,padding-left .3s;opacity:0;transform:translateY(22px)}
.znav-ov.open .znav-nav a{opacity:1;transform:none;transition:color .3s,padding-left .3s,opacity .5s,transform .5s}
.znav-ov.open .znav-nav a:nth-child(1){transition-delay:.06s}
.znav-ov.open .znav-nav a:nth-child(2){transition-delay:.12s}
.znav-ov.open .znav-nav a:nth-child(3){transition-delay:.18s}
.znav-ov.open .znav-nav a:nth-child(4){transition-delay:.24s}
.znav-nav a i{font-family:var(--mono);font-size:.78rem;color:var(--fg3);font-style:normal;letter-spacing:.1em}
.znav-nav a b{width:10px;height:10px;border-radius:50%;margin-left:auto}
.znav-nav a .znav-d-fb{background:var(--teal);box-shadow:0 0 12px var(--teal)}
.znav-nav a .znav-d-fa{background:var(--violet);box-shadow:0 0 12px var(--violet)}
.znav-nav a .znav-d-ai{background:var(--ai);box-shadow:0 0 12px var(--ai)}
.znav-nav a:hover{color:#fff;padding-left:14px}
.znav-nav a:hover i{color:var(--ink)}
.znav-foot{margin-top:clamp(28px,5vh,54px);font-family:var(--mono);font-size:.62rem;letter-spacing:.08em;color:var(--fg3);text-transform:uppercase}
.znav{transition:background .3s ease,backdrop-filter .3s ease,-webkit-backdrop-filter .3s ease}
.znav.is-scrolled{background:linear-gradient(180deg,rgba(5,8,15,.97) 0%,rgba(5,8,15,.9) 52%,rgba(5,8,15,0) 100%);-webkit-backdrop-filter:blur(7px);backdrop-filter:blur(7px)}

@keyframes znavShine{0%{background-position:130% center}100%{background-position:-30% center}}
@keyframes znavDia{0%,100%{transform:rotate(45deg)}50%{transform:rotate(135deg)}}
/* --- unify_nav ke apne rules (home par ye classes nahi thin) --- */
.znav-cur{color:#fff}
.znav-cur i{color:var(--ink)}
.znav-back{margin-right:auto;margin-left:clamp(14px,3vw,30px);font-family:var(--mono);
  font-size:.66rem;letter-spacing:.14em;text-transform:uppercase;color:var(--fg3);
  text-decoration:none;transition:color .25s;white-space:nowrap}
.znav-back:hover{color:var(--ink)}
/* Jo pages pehle fixed header nahi rakhte the, unka content navbar ke neeche
   na chala jaye -- spacer sirf wahan lagta hai jahan zaroorat hai. */
.znav-spacer{height:80px;flex:none}
@media(max-width:640px){.znav{padding:14px 18px}.znav-back{display:none}.znav-spacer{height:68px}}
@media(prefers-reduced-motion:reduce){.znav-brand{animation:none}}

/* --- page ka apna pinned chrome navbar se na takraye ---------------------
   Kuch pages apne UI ko viewport se chipka kar rakhte hain (fixed app shell
   ya top-right par pinned toolbar). Ye rules browser mein naap kar likhe gaye
   hain -- har page ka shell alag tarah pinned hai, is liye alag ilaaj hai. */
:root{--znav-h:80px}
@media(max-width:640px){:root{--znav-h:68px}}
.znav-spacer{height:var(--znav-h)}

/* resources ke deck pages: .chrome fixed inset:0 hai, uske andar toolbar */
.znav ~ .chrome{top:var(--znav-h)}

/* food/app/scorecard: .app khud fixed hai */
.znav ~ .app{top:var(--znav-h)}
/* food/app/manus|motus|nexus: #app static hai + height:100vh */
.znav ~ #app{margin-top:var(--znav-h);height:calc(100vh - var(--znav-h))}
/* food/app/pos: .wrap static hai + height:100vh */
.znav ~ .wrap{margin-top:var(--znav-h);height:calc(100vh - var(--znav-h))}
/* Note: .zbook-fab aur .ibtn bottom-anchored hain -- unhe chhedna nahi,
   warna wo apni jagah se hat jaate hain. */
"""

JS = """(function(){
 var mb=document.getElementById('znavBtn'),mo=document.getElementById('znavOv');
 if(!mb||!mo)return;
 function tg(open){
  mb.classList.toggle('open',open);mo.classList.toggle('open',open);
  mb.setAttribute('aria-expanded',open?'true':'false');
  mo.setAttribute('aria-hidden',open?'false':'true');
  document.body.style.overflow=open?'hidden':'';
 }
 mb.addEventListener('click',function(){tg(!mo.classList.contains('open'));});
 mo.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){tg(false);});});
 document.addEventListener('keydown',function(e){if(e.key==='Escape')tg(false);});
 var hd=document.querySelector('.znav');
 if(hd){var onScroll=function(){hd.classList.toggle('is-scrolled',window.scrollY>12);};
  addEventListener('scroll',onScroll,{passive:true});onScroll();}
})();"""


def url_path(rel):
    p = '/' + rel[:-5]
    return '/' if p == '/index' else p


def markup(rel, back_link, spacer):
    here = url_path(rel)
    links = []
    for num, label, href, dot in NAV_LINKS:
        cur = ' class="znav-cur"' if href == here else ''
        b = '<b class="{0}"></b>'.format(dot) if dot else ''
        links.append('    <a href="{0}"{1}><i>{2}</i><span>{3}</span>{4}</a>'
                     .format(href, cur, num, label, b))
    back = ''
    if back_link:
        # article pages ka "Back to Resources" -- navbar ka hissa nahi, lekin
        # usay chupchap gum bhi nahi hone dete
        back = '\n  <a class="znav-back" href="{0}">{1}</a>'.format(*back_link)
    sp = '\n<div class="znav-spacer" aria-hidden="true"></div>' if spacer else ''
    return ('<header class="znav">\n'
            '  <a href="/" class="znav-brand" aria-label="Zentallio home">Zentallio</a>{back}\n'
            '  <button class="znav-btn" id="znavBtn" aria-label="Open menu" '
            'aria-expanded="false" aria-controls="znavOv">'
            '<span></span><span></span><span></span></button>\n'
            '</header>{spacer}\n'
            '<div class="znav-ov" id="znavOv" aria-hidden="true">\n'
            '  <nav class="znav-nav">\n{links}\n  </nav>\n'
            '  <div class="znav-foot">info@zentallio.com</div>\n'
            '</div>').format(back=back, links='\n'.join(links), spacer=sp)


# Kaun se pages ko spacer chahiye ye ANDAZE se tay nahi hota -- browser mein
# naap kar tay hota hai (tools/measure_nav_spacer.py). Wo is file ko likhta hai.
SPACER_LIST = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'nav_spacer.json')


def spacer_pages():
    try:
        import json
        with open(SPACER_LIST, encoding='utf-8') as fh:
            return set(json.load(fh))
    except Exception:
        return set()


_SPACERS = spacer_pages()


def needs_spacer(rel, soup=None):
    """True sirf un pages ke liye jinka content naapne par navbar ke neeche
    chhup jaata hai. Hero wale pages par fixed navbar hero ke UPAR tairta
    hai -- wahi design home page par hai."""
    return rel in _SPACERS


SPACER_TAG = '<div class="znav-spacer" aria-hidden="true"></div>'


def sync_spacer(path, html, rel, apply_changes):
    """Tool dobara chalane par bhi theek kaam kare: spacer ko naapi hui
    list ke mutabiq laga ya hata do."""
    want = needs_spacer(rel)
    has = SPACER_TAG in html
    if want == has:
        return 'already'
    if want:
        new = html.replace('</header>', '</header>' + SPACER_TAG, 1)
    else:
        new = html.replace(SPACER_TAG, '', 1)
    if apply_changes:
        open(path, 'w', encoding='utf-8').write(new)
    return 'spacer+' if want else 'spacer-'


def process(rel, apply_changes):
    path = os.path.join(ROOT, rel)
    html = open(path, encoding='utf-8').read()
    if 'id="znavOv"' in html:
        # pehle se laga hua hai -- sirf spacer ko list ke mutabiq theek karo
        return sync_spacer(path, html, rel, apply_changes)

    soup = BeautifulSoup(html, 'lxml')
    back_link, removed = None, []
    for sel in REPLACE_SEL:
        for el in soup.select(sel):
            a = el.select_one('a.back')
            if a is not None and a.get('href'):
                back_link = (a['href'], a.get_text(' ', strip=True))
            removed.append(sel)
            el.decompose()

    body = soup.body
    if body is None:
        return 'no-body'
    frag = BeautifulSoup(markup(rel, back_link, needs_spacer(rel)), 'lxml').body
    for node in reversed(list(frag.children)):
        body.insert(0, node.extract())

    style = soup.new_tag('style'); style['id'] = 'znav-css'; style.string = CSS
    body.append(style)
    script = soup.new_tag('script'); script.string = JS
    body.append(script)

    if apply_changes:
        open(path, 'w', encoding='utf-8').write(str(soup))
    return ('replaced:' + ','.join(sorted(set(removed)))) if removed else 'added'


def pages():
    out = []
    for dp, dn, fn in os.walk(ROOT):
        dn[:] = [d for d in dn if d not in ('.git', 'node_modules', 'm', 'deploy',
                                            'tools', 'docs', 'knowledge', 'api', 'lib')]
        for f in sorted(fn):
            if f.endswith('.html') and f not in SKIP and not f.startswith('_'):
                out.append(os.path.relpath(os.path.join(dp, f), ROOT))
    return sorted(out)


if __name__ == '__main__':
    apply_changes = '--apply' in sys.argv
    counts = {}
    for rel in pages():
        r = process(rel, apply_changes)
        k = r.split(':')[0]
        counts[k] = counts.get(k, 0) + 1
        print('%-52s %s' % (rel, r))
    print()
    for k, v in sorted(counts.items()):
        print('  %-10s %d' % (k, v))
    print('  ' + ('WRITTEN' if apply_changes else 'dry run -- --apply se likho'))
