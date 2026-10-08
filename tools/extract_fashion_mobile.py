#!/usr/bin/env python3
"""Fashion sector page ka desktop content -> mobile ke liye chhota JSON.

Desktop /fashion/sector-solutions apna saara content JS se render karta hai
(har sector ke 6 product screens + har solution ka screen). Mobile builder
JS nahi chala sakta, is liye ye script headless Chrome mein page chala kar
har screen ka text nikalti hai aur usay to-the-point bana kar likhti hai:

    tools/data/fashion-mobile.json

Har sector, har product, har solution ka shape ek jaisa hai (3 KPI, ek alert,
Iris ki baat, actions) -- taake mobile par sab sectors ki tone same rahe.

Chalao:  python3 tools/extract_fashion_mobile.py
Phir:    python3 tools/build_mobile.py fashion/sector-solutions.html
"""
import html as H
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'fashion', 'sector-solutions.html')
OUT = os.path.join(ROOT, 'tools', 'data', 'fashion-mobile.json')

PROBE = r'''<script>
window.addEventListener('load',function(){setTimeout(function(){
 var out=[];
 function T(el){return el?el.innerText.replace(/\n{2,}/g,'\n').trim():'';}
 for(var i=0;i<SECTORS.length;i++){
   select(i,false);
   var s=SECTORS[i], o={id:s.id,name:s.name,sub:s.here.scorecard,here:s.here,fdesc:{},demo:s.demo,flag:{},sol:[]};
   for(var k=0;k<FLAGSHIP.length;k++){ o.fdesc[FLAGSHIP[k].key]=FLAGSHIP[k].desc; stageFor(FLAGSHIP[k].key,s); o.flag[FLAGSHIP[k].key]=T(document.getElementById('heroStage')); }
   document.querySelectorAll('#solGrid .sgrp').forEach(function(g){
     var grp={head:T(g.querySelector('.bhead')),items:[]};
     g.querySelectorAll('.stab').forEach(function(b){ var it=s.sol[+b.dataset.i]; solStage(b.dataset.g,s,+b.dataset.i);
        grp.items.push({n:it.n,z:it.z,d:it.d,stage:T(document.getElementById('stage-'+b.dataset.g))}); });
     o.sol.push(grp);
   });
   out.push(o);
 }
 var pre=document.createElement('pre'); pre.id='OUT'; pre.textContent=JSON.stringify(out); document.body.appendChild(pre);
},800);});
</script></body>'''


def chrome():
    for c in ('google-chrome', 'chromium', 'chromium-browser'):
        if shutil.which(c):
            return c
    sys.exit('Chrome/Chromium nahi mila')


def render():
    s = open(SRC, encoding='utf-8').read()
    i = s.rfind('</body>')
    s = s[:i] + PROBE + s[i + 7:]
    with tempfile.TemporaryDirectory() as td:
        p = os.path.join(td, 'probe.html')
        open(p, 'w', encoding='utf-8').write(s)
        dom = subprocess.run([chrome(), '--headless=new', '--disable-gpu', '--no-sandbox',
                              '--window-size=1440,1000', '--virtual-time-budget=8000',
                              '--dump-dom', 'file://' + p],
                             capture_output=True, text=True, timeout=120).stdout
    m = re.search(r'<pre id="OUT">(.*?)</pre>', dom, re.S)
    if not m:
        sys.exit('desktop page render nahi hua')
    return json.loads(H.unescape(m.group(1)))


# ---------------------------------------------------------------- helpers
def short(t, n=3, cap=330):
    """Pehle n sentence, phir bhi lamba ho to cap tak."""
    t = re.sub(r'\s+', ' ', t or '').strip()
    parts = re.split(r'(?<=[.!?])\s+(?=[A-Z“"])', t)
    out = ''
    for p in parts[:n]:
        if out and len(out) + len(p) > cap:
            break
        out = (out + ' ' + p).strip()
    return out


def is_label(x):
    """Desktop ke UPPERCASE labels -- "BR-2291", "400 TC", "1.1M" jaise
    values label nahi (4+ haroof ka lafz, ya do lafz)."""
    words = re.findall(r'[A-Z]{2,}', x)
    return x == x.upper() and (any(len(w) >= 4 for w in words) or len(words) >= 2)


def iris_block(lines):
    """(alert, iris, actions) -- 'IRIS · WHAT TO DO' ke aas paas."""
    if 'IRIS · WHAT TO DO' not in lines:
        return '', '', []
    i = lines.index('IRIS · WHAT TO DO')
    alert = lines[i - 1] if i else ''
    iris = lines[i + 1] if i + 1 < len(lines) else ''
    acts = []
    for x in lines[i + 2:]:
        if x.startswith('●') or not is_label(x):
            break
        acts.append(x)
    return alert, short(iris), acts[:3]


def head_kpis(lines):
    """Screen ke upar wali KPI strip: value, LABEL, [sub-line] ..."""
    try:
        j = lines.index('live') + 1
    except ValueError:
        return []
    out = []
    while j + 1 < len(lines) and len(out) < 3:
        v, lab = lines[j], lines[j + 1]
        if '\t' in v or is_label(v) or not is_label(lab):
            break
        out.append([v, lab])
        j += 2
        # do non-label lines lagatar -> pehli is KPI ki sub-line hai
        if (j + 1 < len(lines) and not is_label(lines[j])
                and not is_label(lines[j + 1])):
            j += 1
    return out


def target_kpis(lines):
    """'AGAINST TARGET' bars: label, value."""
    if 'AGAINST TARGET' not in lines:
        return []
    i = lines.index('AGAINST TARGET') + 2      # 'L1 · L2' chhodo
    out = []
    while i + 1 < len(lines) and len(out) < 3 and not is_label(lines[i]):
        out.append([lines[i + 1], lines[i]])
        i += 2
    return out


# ---------------------------------------------------------------- products
def p_scorecard(o):
    d = o['demo'] or {}
    k = [[str(x['v']) + str(x.get('u') or ''), x['l']] for x in d.get('sc', [])][:4]
    t = d.get('toast') or {}
    alert = ('%s · %s' % (t.get('a', ''), t.get('b', ''))).upper().strip(' ·')
    ask = d.get('ask') or []
    return k, alert, short(ask[-1] if ask else ''), []


def p_pos(o):
    L = o['flag']['pos'].split('\n')
    iris = ''
    if 'IRIS · GUIDED TOUR' in L:
        iris = L[L.index('IRIS · GUIDED TOUR') - 1]
    k = []
    pool = next((x for x in L if x.startswith('ONE POOL')), '')
    m = re.search(r'([\d,]+) (?:ORDERS )?LIVE', pool)
    if m:
        k.append([m.group(1), 'Orders live'])
    chans = [L[i] for i in range(len(L) - 2) if L[i + 2] in ('= pool', '≠ pool')]
    if chans:
        k.append([str(len(chans)), 'Channels, one cart'])
    k.append(['1', 'Stock pool'])
    return k, 'EVERY CHANNEL · ONE CART · ONE STOCK POOL', short(iris), []


def p_numerus(o):
    L = o['flag']['numerus'].split('\n')
    i = L.index('Live') + 1 if 'Live' in L else 0
    pairs = []
    while i + 1 < len(L) and L[i] != 'IRIS':
        pairs.append([L[i + 1], L[i]])
        i += 2
    k = pairs[:2] + pairs[-1:] if len(pairs) > 3 else pairs
    iris = L[L.index('IRIS') + 1] if 'IRIS' in L else ''
    return k, 'MARGIN BRIDGE · SEASON TO DATE', short(iris), []


def p_nmm(o, key):
    L = o['flag'][key].split('\n')
    alert, iris, acts = iris_block(L)
    return target_kpis(L), alert, iris, acts


FLAG = [('scorecard', 'Balanced Scorecard', 'The board · four lenses, live'),
        ('pos', 'Point of Sale', 'The counter · live till, Iris upsell'),
        ('numerus', 'Numerus · CFO', 'The ledger · balanced, not estimated'),
        ('nexus', 'Nexus · Supply Chain', 'The pipeline · forecast, procurement, logistics'),
        ('motus', 'Motus · Operations', 'The estate · standards, assets, energy'),
        ('manus', 'Manus · Workforce', 'The floor · roster, payroll, compliance'),
        ('vision', 'Zentallio Vision', 'The cameras · footfall, queues, safety')]


def condense(o):
    prods = []
    for key, name, role in FLAG:
        fn = {'scorecard': p_scorecard, 'pos': p_pos, 'numerus': p_numerus}.get(key)
        k, a, i, ac = fn(o) if fn else p_nmm(o, key)
        # paragraph: product kya hai + is sector mein kya karta hai
        # (scorecard ka 'here' upar sub-line hai, numerus ka Iris line -- dobara nahi)
        here = (o.get('here') or {}).get('pos', '') if key == 'pos' else ''
        desc = ' '.join(x for x in (o['fdesc'].get(key, ''), H.unescape(here)) if x)
        prods.append({'key': key, 'name': name, 'role': role, 'd': desc,
                      'kpis': k, 'alert': a, 'iris': i, 'acts': ac})
    groups = []
    for g in o['sol']:
        h = g['head'].split('\n')
        eye = re.sub(r'\s*·\s*\d+ SOLUTIONS?$', '', h[0]).title() if h else ''
        items = []
        for it in g['items']:
            L = it['stage'].split('\n')
            a, i, ac = iris_block(L)
            items.append({'n': it['n'], 'z': it['z'], 'd': it['d'],
                          'kpis': head_kpis(L), 'alert': a, 'iris': i, 'acts': ac})
        groups.append({'eye': eye, 'h': h[1] if len(h) > 1 else '',
                       'sub': h[2] if len(h) > 2 else '', 'items': items})
    return {'id': o['id'], 'name': o['name'], 'sub': o['sub'],
            'products': prods, 'groups': groups}


if __name__ == '__main__':
    data = [condense(o) for o in render()]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(data, open(OUT, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    print('%d sectors -> %s' % (len(data), os.path.relpath(OUT, ROOT)))
