#!/usr/bin/env python3
"""Google Tag Manager har desktop page par lagata hai.

Do hisse hote hain aur dono ki jagah maayne rakhti hai:
  - <script>  <head> mein, jitna upar ho sake
  - <noscript> <body> khulte hi, sab se pehle

Mobile pages ka GTM tools/build_mobile.py ke template mein hai (wo pages
generate hote hain, is liye unhe yahan se chhedna theek nahi -- agli build
tabdeeli mita degi).

    python3 tools/add_gtm.py            # dry run
    python3 tools/add_gtm.py --apply
    python3 tools/add_gtm.py --remove --apply
"""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GTM_ID = 'GTM-KZQGBF9K'
SKIP = set()

HEAD = ("<!-- Google Tag Manager -->\n"
        "<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':"
        "new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],"
        "j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src="
        "'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);"
        "})(window,document,'script','dataLayer','" + GTM_ID + "');</script>\n"
        "<!-- End Google Tag Manager -->")

BODY = ('<!-- Google Tag Manager (noscript) -->\n'
        '<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=' + GTM_ID + '"\n'
        'height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>\n'
        '<!-- End Google Tag Manager (noscript) -->')

HEAD_RX = re.compile(r'\s*<!-- Google Tag Manager -->.*?<!-- End Google Tag Manager -->', re.S)
BODY_RX = re.compile(r'\s*<!-- Google Tag Manager \(noscript\) -->.*?'
                     r'<!-- End Google Tag Manager \(noscript\) -->', re.S)


def strip(html):
    return BODY_RX.sub('', HEAD_RX.sub('', html))


def add(html):
    html = strip(html)
    m = re.search(r'<head\b[^>]*>', html, re.I)
    if not m:
        return None
    html = html[:m.end()] + '\n' + HEAD + html[m.end():]
    m = re.search(r'<body\b[^>]*>', html, re.I)
    if not m:
        return None
    return html[:m.end()] + '\n' + BODY + html[m.end():]


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
    remove = '--remove' in sys.argv
    n = skipped = 0
    for rel in pages():
        path = os.path.join(ROOT, rel)
        html = open(path, encoding='utf-8').read()
        new = strip(html) if remove else add(html)
        if new is None:
            print('%-52s NO head/body' % rel); skipped += 1; continue
        if new == html:
            continue
        n += 1
        if apply_changes:
            open(path, 'w', encoding='utf-8').write(new)
    print('%s %d pages%s' % ('removed from' if remove else 'GTM on', n,
                             '' if apply_changes else '  (dry run -- --apply se likho)'))
    if skipped:
        print('  skipped:', skipped)
