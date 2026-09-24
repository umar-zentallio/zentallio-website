#!/usr/bin/env python3
"""Desktop pages par m-dot ke SEO pairing tags lagata hai.

Har desktop page ko chahiye:
    <link rel="canonical" href="https://zentallio.com/<path>">
    <link rel="alternate" media="only screen and (max-width: 640px)"
          href="https://m.zentallio.com/<path>">

Iske bagair Google dono versions ko duplicate content samjhta hai.
Script idempotent hai -- dobara chalane se kuch double nahi hota.
"""
import os, re, sys

ROOT  = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE  = 'https://zentallio.com'
MBASE = 'https://m.zentallio.com'
SKIP  = {'cookie-banner.html'}

def url_path(rel):
    p = '/' + rel[:-5]
    if p == '/index':        return '/'
    if p.endswith('/index'): return p[:-6] or '/'
    return p

def pages():
    out = []
    for dp, dn, fn in os.walk(ROOT):
        dn[:] = [d for d in dn if d not in ('.git','node_modules','m','deploy','tools','docs','knowledge','api','lib')]
        for f in sorted(fn):
            if f.endswith('.html') and f not in SKIP and not f.startswith('_'):
                out.append(os.path.relpath(os.path.join(dp, f), ROOT))
    return sorted(out)

def main(apply_changes):
    added_c = added_a = 0
    for rel in pages():
        p    = os.path.join(ROOT, rel)
        html = open(p, encoding='utf-8').read()
        up   = url_path(rel)
        canon = '<link rel="canonical" href="%s%s">' % (BASE, up)
        alt   = ('<link rel="alternate" media="only screen and (max-width: 640px)" '
                 'href="%s%s">' % (MBASE, up))

        ins, note = [], []
        if not re.search(r'<link[^>]+rel=["\']canonical["\']', html, re.I):
            ins.append(canon); note.append('canonical'); added_c += 1
        if 'rel="alternate" media="only screen' not in html:
            ins.append(alt); note.append('alternate'); added_a += 1
        if not ins:
            continue

        m = re.search(r'</head>', html, re.I)
        if not m:
            print('  NO </head>:', rel); continue
        block = '\n' + '\n'.join(ins) + '\n'
        new = html[:m.start()] + block + html[m.start():]
        print('%-52s + %s' % (rel, ', '.join(note)))
        if apply_changes:
            open(p, 'w', encoding='utf-8').write(new)
    print('\ncanonical added: %d   alternate added: %d   (%s)'
          % (added_c, added_a, 'WRITTEN' if apply_changes else 'dry run'))

if __name__ == '__main__':
    main('--apply' in sys.argv)
