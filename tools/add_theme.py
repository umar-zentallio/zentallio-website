#!/usr/bin/env python3
"""Light/dark theme (/theme.js) har page par lagata hai -- desktop aur m/ dono.

<head> mein do cheezein, jitna upar ho sake:
  - chhota inline script: localStorage se 'light' mila to first paint se
    pehle html[data-theme] laga do aur body chhupa do jab tak theme.js
    light CSS na bana le (2.5s failsafe -- script na chale to page phir
    bhi dikhe)
  - <script defer src="/theme.js">

Toggle button theme.js khud header.znav / header.m-head mein daalta hai.
Dobara chalana safe hai (purana block hata kar naya lagata hai).

    python3 tools/add_theme.py            # dry run
    python3 tools/add_theme.py --apply
    python3 tools/add_theme.py --remove --apply
"""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SNIPPET = (
    '<!--zt-theme:start-->'
    '<script>(function(){try{var t=localStorage.getItem("zentallio-theme");'
    'if(t==="light"){var d=document.documentElement;d.setAttribute("data-theme","light");'
    'd.classList.add("zt-pending");setTimeout(function(){d.classList.remove("zt-pending")},2500)}'
    '}catch(e){}})();</script>'
    '<style>html.zt-pending,html.zt-pending body{background:#F5F7FB!important}'
    'html.zt-pending body{visibility:hidden}</style>'
    '<script defer src="/theme.js"></script>'
    '<!--zt-theme:end-->')

RX = re.compile(r'\s*<!--zt-theme:start-->.*?<!--zt-theme:end-->', re.S)


def strip(html):
    return RX.sub('', html)


def add(html):
    html = strip(html)
    m = re.search(r'<head\b[^>]*>', html, re.I)
    if not m:
        return None
    # <meta charset> pehle 1024 bytes mein rehna chahiye -- us ke baad lagao
    c = re.compile(r'<meta\s+charset=[^>]*>', re.I).search(html, m.end(), m.end() + 2000)
    at = c.end() if c else m.end()
    return html[:at] + '\n' + SNIPPET + html[at:]


def pages():
    out = []
    for dp, dn, fn in os.walk(ROOT):
        dn[:] = [d for d in dn if d not in ('.git', 'node_modules', 'deploy', 'tools',
                                            'docs', 'knowledge', 'api', 'lib')]
        for f in sorted(fn):
            if f.endswith('.html') and not f.startswith('_'):
                out.append(os.path.relpath(os.path.join(dp, f), ROOT))
    return sorted(out)


if __name__ == '__main__':
    apply_changes = '--apply' in sys.argv
    remove = '--remove' in sys.argv
    n = 0
    for rel in pages():
        path = os.path.join(ROOT, rel)
        html = open(path, encoding='utf-8').read()
        new = strip(html) if remove else add(html)
        if new is None:
            print('%-52s NO <head>' % rel)
            continue
        if new == html:
            continue
        n += 1
        if apply_changes:
            open(path, 'w', encoding='utf-8').write(new)
    print('%s %d pages' % ('changed' if apply_changes else 'would change', n))
