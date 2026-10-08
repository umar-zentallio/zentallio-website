#!/usr/bin/env python3
"""m/fashion/sector-solutions.html ke sector panels ko in-place dobara banao
(poora page regenerate kiye baghair -- nav/booking injections bache rehte hain).

    python3 tools/extract_fashion_mobile.py   # desktop content -> JSON
    python3 tools/patch_fashion_mobile.py     # JSON -> mobile panels
"""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_mobile as B

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html = open(os.path.join(ROOT, 'fashion/sector-solutions.html'), encoding='utf-8').read()
f = os.path.join(ROOT, 'm/fashion/sector-solutions.html')
s = open(f, encoding='utf-8').read()
for sec in [x for x in B.find_array(html, 'SECTORS') if isinstance(x, dict) and x.get('id')]:
    sid = str(sec['id'])
    m = re.search(r'(<div class="m-sector-panel[^"]*" id="sector-%s"[^>]*>\n)(.*?)'
                  r'(\n</div>\n(?=<div class="m-sector-panel|<p class="m-muted m-corenote"|</section>))'
                  % re.escape(sid), s, re.S)
    if not m:
        sys.exit('panel nahi mila: ' + sid)
    s = s[:m.start(2)] + B.sector_panel(sec, 'fashion', False, html, 'is-on' in m.group(1)) + s[m.end(2):]
s = B.fashion_page_fix(s)
open(f, 'w', encoding='utf-8').write(s)
print('patched', os.path.relpath(f, ROOT))
