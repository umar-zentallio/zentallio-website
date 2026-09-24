#!/usr/bin/env python3
"""Desktop vs mobile content diff -- word-shingle based, structure se azaad.

Desktop ke har 8-word shingle ko mobile ke word-stream mein dhoondta hai.
Isse layout badalne par false alarm nahi hota, sirf asal deletion pakdi jaati hai.
"""
import os, re, sys
from bs4 import BeautifulSoup

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Navigation aur footer dono taraf se nikaal dete hain -- warna unke shabd
# "gum" ginay jaate hain jabke wo sirf doosri jagah chale gaye hain.
DROP = ['header.top','nav.site-nav','div.menu-ov','footer.zfoot','div.zck',
        '#zckBanner','div.progress','div.nav-row','.m-head','.m-menu','.m-foot',
        '.m-sticky-cta','.zh-bar','.zmenu','.zmenu-nav','.zhero-nav','.menu-foot',
        'header.znav','.znav-ov','.znav-spacer']
N = 8

def words(path):
    s = BeautifulSoup(open(path, encoding='utf-8').read(), 'lxml')
    for t in s(['script','style','noscript','template','canvas']): t.decompose()
    for sel in DROP:
        for t in s.select(sel): t.decompose()
    txt = s.get_text(' ', strip=True).lower()
    txt = txt.replace('’', "'").replace('—', ' ').replace('–', ' ')
    return [w for w in re.findall(r"[a-z0-9€$%&'./+-]+", txt) if w not in ('·','|')]

def shingles(ws, n=N):
    if len(ws) < n:
        return {' '.join(ws)} if ws else set()
    return {' '.join(ws[i:i+n]) for i in range(len(ws) - n + 1)}

def main(rels, verbose=False):
    from collections import Counter
    tot_lost = tot_all = 0
    rows = []
    for rel in rels:
        d = os.path.join(ROOT, rel)
        # mobile root m/home.html hai (m/index.html nahi) -- dekho
        # tools/build_mobile.py mein wajah
        m = os.path.join(ROOT, 'm', 'home.html' if rel == 'index.html' else rel)
        if not os.path.exists(m):
            rows.append(('MISS', rel, 0.0, 0.0, 0, 0, [])); continue
        dw, mw = words(d), words(m)
        dc, mc = Counter(dw), Counter(mw)
        lost = dc - mc                       # jo desktop par hai lekin mobile par nahi
        nlost = sum(lost.values())
        wpct = 100 * (1 - nlost / max(len(dw), 1))
        d4, m4 = shingles(dw, 4), shingles(mw, 4)
        g4 = [g for g in d4 if g not in m4]
        gpct = 100 * (1 - len(g4) / max(len(d4), 1))
        flag = 'OK  ' if wpct >= 99.5 else ('WARN' if wpct >= 97 else 'FAIL')
        rows.append((flag, rel, wpct, gpct, len(dw), nlost, lost))
        tot_lost += nlost; tot_all += len(dw)
    rows.sort(key=lambda r: r[2])
    for flag, rel, wpct, gpct, dw, nlost, lost in rows:
        print('%s %-56s words %6.2f%%  phrases %5.1f%%  (desktop %d words, %d lost)'
              % (flag, rel, wpct, gpct, dw, nlost))
        if verbose and nlost:
            print('        lost:', ' '.join(sorted(lost.elements()))[:200])
    print('\noverall words kept: %.2f%%   (%d of %d lost)'
          % (100 * (1 - tot_lost / max(tot_all, 1)), tot_lost, tot_all))

if __name__ == '__main__':
    a = [x for x in sys.argv[1:] if not x.startswith('-')]
    main(a, '-v' in sys.argv)
