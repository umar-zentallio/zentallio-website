#!/usr/bin/env python3
"""Generate one standalone page per F&B sector from food/food-beverage-solutions.html.

The master page is the single source of truth: edit it, then re-run this script and
the ten sector pages under food/solutions/ are rebuilt. A generated page differs from
the master only in the sector it opens on, in its head metadata (title, canonical,
og:url, og:title, twitter:title) and in dropping the generic "Pick one. It opens the
real screen." intro block and merging the solution tabs into one bundle --
everything else is copied verbatim.

    python3 tools/build-sector-pages.py
"""
import io, os, re, sys

ROOT   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MASTER = os.path.join(ROOT, 'food', 'food-beverage-solutions.html')
OUTDIR = os.path.join(ROOT, 'food', 'solutions')
BASE   = 'https://zentallio.com'

SLUGS = {
    'qsr':      'quick-service-street-food',
    'casual':   'casual-dining',
    'fine':     'fine-dining-premium',
    'cafe':     'cafe-coffee-bakery',
    'dessert':  'ice-cream-desserts-sweets',
    'beverage': 'beverages-drinks',
    'health':   'health-wellness-specialty-diets',
    'cloud':    'cloud-kitchen-delivery-only',
    'b2b':      'institutional-b2b-food-service',
    'niche':    'niche-experience-concepts',
}

SECTOR_RE = re.compile(r"\{id:'([a-z0-9]+)',num:'(\d+)',name:'((?:[^'\\]|\\.)*)'")
UNI_RE    = re.compile(r'\\u([0-9a-fA-F]{4})')


def esc(t):
    return t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')


def sub_once(text, pattern, repl, what):
    out, n = re.subn(pattern, lambda m: repl, text, count=1, flags=re.S)
    if n != 1:
        sys.exit('could not rewrite %s in the master' % what)
    return out


def strip_element(text, opening, what):
    """Remove exactly one balanced element that starts with `opening`.

    Line-based removal is not safe here: the master puts other, still-needed tags on
    the same line (the heroEye label shares its line with the <div> that opens the
    hero's left column), so deleting the line orphans a </div> and everything after
    it escapes its container. This walks the tag depth and cuts only the element.
    """
    i = text.find(opening)
    if i < 0 or text.find(opening, i + 1) >= 0:
        sys.exit('expected exactly one %s in the master' % what)
    name = re.match(r'<([a-zA-Z][\w-]*)', opening).group(1)
    tag = re.compile(r'</?%s\b' % re.escape(name), re.I)
    depth, j = 0, i
    while True:
        m = tag.search(text, j)
        if not m:
            sys.exit('unbalanced %s in the master' % what)
        depth += -1 if m.group(0).startswith('</') else 1
        j = text.index('>', m.end()) + 1
        if depth == 0:
            break
    out = text[:i] + text[j:]
    # if the element was alone on its line, drop the now-blank line as well
    ls = out.rfind('\n', 0, i) + 1
    le = out.find('\n', i)
    if le < 0:
        le = len(out)
    if not out[ls:le].strip():
        out = out[:ls] + out[le + 1:]
    return out


def check_structure(master, page, slug):
    """A removal must not change the document's tag balance.

    The raw text also contains markup inside JS strings, so an absolute
    open==close count is meaningless here; what must hold is that the generated
    page balances exactly as the master does.
    """
    for tag in ('div', 'section', 'span', 'p'):
        def bal(doc):
            return (len(re.findall(r'<%s\b' % tag, doc, re.I))
                    - len(re.findall(r'</%s\b' % tag, doc, re.I)))
        if bal(page) != bal(master):
            sys.exit('%s: <%s> balance drifted from the master (%d vs %d) -- refusing to write'
                     % (slug, tag, bal(page), bal(master)))


def main():
    master = io.open(MASTER, encoding='utf-8').read()

    sectors = [(m.group(1), UNI_RE.sub(lambda m: chr(int(m.group(1), 16)), m.group(3)))
               for m in SECTOR_RE.finditer(master)]
    if len(sectors) != len(SLUGS):
        sys.exit('expected %d sectors in the master, found %d' % (len(SLUGS), len(sectors)))
    if master.count("var curSector='cafe';") != 1:
        sys.exit("could not find a single `var curSector='cafe';` in the master")

    if not os.path.isdir(OUTDIR):
        os.makedirs(OUTDIR)

    for sid, name in sectors:
        slug = SLUGS.get(sid)
        if not slug:
            sys.exit('no slug configured for sector %r' % sid)
        url  = '%s/food/solutions/%s' % (BASE, slug)
        nm   = esc(name)
        page = master.replace("var curSector='cafe';", "var curSector='%s';" % sid)
        # a dedicated sector page does not need the generic "Pick one..." intro
        page = strip_element(page, '<div class="solhead">', 'solhead block')
        # one merged bundle of tabs instead of one bundle per four solutions
        if page.count('var MERGE_BUNDLES=false;') != 1:
            sys.exit('could not find the MERGE_BUNDLES flag in the master')
        page = page.replace('var MERGE_BUNDLES=false;', 'var MERGE_BUNDLES=true;')
        # mark the body so the sector-page-only spacing rules apply
        if page.count('<body>') != 1:
            sys.exit('expected exactly one plain <body> tag in the master')
        page = page.replace('<body>', '<body class="sectorpage">')
        # the sector bar already names the sector; these two labels just repeat it
        page = strip_element(page, '<div class="heroEye">', 'heroEye label')
        page = strip_element(page, '<span class="herobadge">', 'herobadge label')
        page = sub_once(page, r'<title>.*?</title>',
                        '<title>Zentallio — %s · Solutions for Food &amp; Beverage</title>' % nm, 'title')
        page = sub_once(page, r'<link rel="canonical" href="[^"]*">',
                        '<link rel="canonical" href="%s">' % url, 'canonical')
        page = sub_once(page, r'<meta property="og:url" content="[^"]*">',
                        '<meta property="og:url" content="%s">' % url, 'og:url')
        page = sub_once(page, r'<meta property="og:title" content="[^"]*">',
                        '<meta property="og:title" content="%s — Zentallio for Food &amp; Beverage">' % nm, 'og:title')
        page = sub_once(page, r'<meta name="twitter:title" content="[^"]*">',
                        '<meta name="twitter:title" content="%s — Zentallio for Food &amp; Beverage">' % nm, 'twitter:title')
        check_structure(master, page, slug)
        io.open(os.path.join(OUTDIR, slug + '.html'), 'w', encoding='utf-8').write(page)
        print('%-9s -> food/solutions/%s.html' % (sid, slug))

    print('%d sector pages written' % len(sectors))


if __name__ == '__main__':
    main()
