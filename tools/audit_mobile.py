#!/usr/bin/env python3
"""Har mobile page ki HAR state ko overflow ke liye jaanchta hai.

Sirf khula hua panel dekhna kaafi nahi -- sector tabs, accordions aur menu
sab alag states hain, aur har ek apna overflow rakh sakti hai. Ye script
sab exercise karti hai, chaar naapon par.

Do cheezein pakadta hai:
  OUT   element page ki chaurai se bahar nikal raha hai
  CLIP  element apne hi box ke andar content kaat raha hai (text cut off)

Pehle dev-server chalao, phir:

    python3 dev-server.py 8010 &
    python3 tools/audit_mobile.py --port 8010
"""
import argparse, json, os, re, shutil, subprocess, sys, urllib.parse, urllib.request

ROOT    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HARNESS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '_audit_harness.html')
SERVED  = os.path.join(ROOT, '_audit.html')      # web root se serve hona zaroori hai

# (width, height, chrome window) -- aakhri landscape hai
VIEWPORTS = [(320, 880, '340,930'), (360, 900, '380,950'),
             (414, 896, '434,946'), (740, 360, '760,410')]
BATCH = 6

def pages():
    out = []
    for dp, dn, fn in os.walk(os.path.join(ROOT, 'm')):
        for f in sorted(fn):
            if f.endswith('.html'):
                out.append('/' + os.path.relpath(os.path.join(dp, f), ROOT))
    return sorted(out)

def run_batch(port, w, h, win, chunk):
    url = ('http://localhost:%d/_audit.html?w=%d&h=%d#' % (port, w, h)
           + urllib.parse.quote(json.dumps(chunk)))
    r = subprocess.run(['google-chrome', '--headless', '--disable-gpu', '--no-sandbox',
                        '--virtual-time-budget=180000', '--window-size=' + win,
                        '--dump-dom', url],
                       capture_output=True, text=True, timeout=700)
    m = re.search(r'RESULT:(\[.*?\])</div>', r.stdout, re.S)
    return json.loads(m.group(1)) if m else []

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--port', type=int, default=8010)
    ap.add_argument('--width', type=int, help='sirf ek naap')
    args = ap.parse_args()

    try:
        urllib.request.urlopen('http://localhost:%d/' % args.port, timeout=3)
    except Exception:
        sys.exit('  dev-server nahi mila port %d par.\n'
                 '  chalao:  python3 dev-server.py %d &' % (args.port, args.port))

    shutil.copyfile(HARNESS, SERVED)
    all_pages = pages()
    vps = [v for v in VIEWPORTS if not args.width or v[0] == args.width]
    bad_total, detail = 0, {}
    try:
        for w, h, win in vps:
            out = []
            for i in range(0, len(all_pages), BATCH):
                out.extend(run_batch(args.port, w, h, win, all_pages[i:i + BATCH]))
            bad = [x for x in out if x['states']]
            bad_total += len(bad)
            print('%-18s pages=%d  with-issues=%d'
                  % ('%dx%d%s' % (w, h, ' land' if w > h else ''), len(out), len(bad)),
                  flush=True)
            for x in bad:
                detail.setdefault(x['page'], []).append((w, x['states']))
    finally:
        if os.path.exists(SERVED):
            os.remove(SERVED)

    print()
    if not detail:
        print('CLEAN -- koi overflow ya content clipping nahi mili')
        return 0
    for pg, entries in detail.items():
        print(pg)
        for w, states in entries:
            for s in states[:4]:
                print('   [%dpx] %-22s out=%d clip=%d' % (w, s['state'], s['nOut'], s['nClip']))
                for b in s['out'][:3]:
                    print('       OUT  +%-4d %-26s %s' % (b['over'], b['sel'], b['txt'][:32]))
                for b in s['clip'][:3]:
                    print('       CLIP +%-4d %-24s child=%-18s %s'
                          % (b['by'], b['sel'], b.get('child', ''), b['txt'][:24]))
    return 1

if __name__ == '__main__':
    sys.exit(main())
