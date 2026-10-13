/* Zentallio light / dark theme.
 *
 * Site dark-first bana hai aur har page ki apni inline CSS hai (45 desktop +
 * 68 mobile pages, kuch 6MB tak). Har page ke liye haath se light CSS likhna
 * mumkin nahi -- is liye light theme runtime par banti hai:
 *
 *   1. Page ki har stylesheet (inline <style>, /m/mobile.css, /booking.css ...)
 *      ke har color wale declaration ki ek light copy banti hai, selector ke
 *      aage html[data-theme="light"] laga kar. Specificity +0,1,1 -- original
 *      ke upar jeet jaati hai, aur sab rules ki copy banti hai is liye aapas
 *      ki tarteeb wahi rehti hai.
 *   2. Inline style="" aur SVG fill/stroke attributes bhi map hote hain --
 *      JS se baad mein aane wala markup MutationObserver pakad leta hai.
 *   3. Colors ka mapping DevOps package ki light theme se: bg #F5F7FB, panel
 *      #FFFFFF, ink #0A1020, body #3D485C, muted #6B7588, teal #0A9AA1 ...
 *
 * Pasand localStorage 'zentallio-theme' mein. Default dark (brand ka asli roop).
 * <head> ka chhota snippet (tools/add_theme.py) first paint se pehle
 * data-theme laga deta hai, taake flash na ho.
 */
(function () {
  'use strict';
  var D = document, R = D.documentElement, W = window;
  if (W.__zt) return;                      // do baar load na ho
  var KEY = 'zentallio-theme';
  var PFX = 'html[data-theme="light"]';
  var IN_FRAME = W.parent !== W;

  /* ------------------------------------------------------------ colors */
  // DevOps package light theme ke exact tokens -- dark site ke asli tokens
  // inhi par aate hain; baqi sab neeche wale formula se.
  var EXACT = {
    '05080f': 'F5F7FB', '070c18': 'EDF1F7', '0a1020': 'FFFFFF', '0a0a12': 'EDF1F7',
    '0c1424': 'FFFFFF', '0b1220': 'FFFFFF', '0a1120': 'FFFFFF', '0b111c': 'FFFFFF',
    '0e1017': 'FFFFFF', '141721': 'F0F3F9', '0e1626': 'F7F9FC', '0b1222': 'FFFFFF',
    '15f2f2': '0A9AA1', '9b7bff': '7B5CF0', 'ff2d95': 'D61F7A', '3fd9a4': '0C9A70',
    'e5a24b': 'B57E0C', 'ff6b35': 'E0561F', 'f2b33d': 'B57E0C', '8cc63f': '5A9420',
    '3d7bff': '2F64DD', '14b88a': '0C9A70', 'ff8fc0': 'C2185B', 'ff6b7a': 'D63A4A',
    'eef1f8': '0A1020', 'eaf0fb': '0A1020', 'e8eef7': '0A1020', 'eef2f7': '0A1020',
    'f3f5fa': '0A1020', 'f2f6fc': '0A1020', 'ffffff': '0A1020',
    'aeb9cb': '3D485C', 'bcc3cf': '3D485C', 'aeb7c5': '3D485C', 'b9c2d6': '3D485C',
    'b7c1d1': '3D485C', '9aa7bd': '4E5970', '93a1b5': '4E5970',
    '6e798f': '6B7588', '767f92': '6B7588', '737f95': '6B7588', '7c879e': '6B7588',
    '63708a': '6B7588', '5e6c82': '6B7588'
  };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), h = 0, s = 0, l = (mx + mn) / 2;
    if (mx !== mn) {
      var d = mx - mn;
      s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h /= 6;
    }
    return [h, s, l];
  }
  function hsl2rgb(h, s, l) {
    if (!s) { var v = Math.round(l * 255); return [v, v, v]; }
    function f(p, q, t) {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }
    var q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    return [Math.round(f(p, q, h + 1 / 3) * 255), Math.round(f(p, q, h) * 255), Math.round(f(p, q, h - 1 / 3) * 255)];
  }
  function relLum(c) {
    function f(v) { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }
    return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]);
  }
  function hex2(n) { n = n.toString(16); return n.length < 2 ? '0' + n : n; }

  function parse(tok) {
    var t = tok.toLowerCase(), m;
    if (t === 'white') return [255, 255, 255, 1];
    if (t === 'black') return [0, 0, 0, 1];
    if (t[0] === '#') {
      t = t.slice(1);
      if (t.length === 3 || t.length === 4) t = t.replace(/./g, '$&$&');
      if (t.length !== 6 && t.length !== 8) return null;
      return [parseInt(t.slice(0, 2), 16), parseInt(t.slice(2, 4), 16), parseInt(t.slice(4, 6), 16),
              t.length === 8 ? parseInt(t.slice(6, 8), 16) / 255 : 1];
    }
    m = t.match(/^rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
    if (m) {
      var c = [1, 2, 3].map(function (i) {
        return m[i].slice(-1) === '%' ? parseFloat(m[i]) * 2.55 : parseFloat(m[i]);
      });
      var a = m[4] === undefined ? 1 : m[4].slice(-1) === '%' ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
      return [c[0], c[1], c[2], a];
    }
    m = t.match(/^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
    if (m) {
      var rgb = hsl2rgb(parseFloat(m[1]) / 360, parseFloat(m[2]) / 100, parseFloat(m[3]) / 100);
      var al = m[4] === undefined ? 1 : m[4].slice(-1) === '%' ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
      return [rgb[0], rgb[1], rgb[2], al];
    }
    return null;
  }

  function out(r, g, b, a) {
    r = Math.round(clamp(r, 0, 255)); g = Math.round(clamp(g, 0, 255)); b = Math.round(clamp(b, 0, 255));
    a = Math.round(clamp(a, 0, 1) * 1000) / 1000;
    return a >= 1 ? '#' + hex2(r) + hex2(g) + hex2(b) : 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  // kind: 'paint' (bg, text, border, fill ...) ya 'shadow' (box/text-shadow)
  function mapRGBA(c, kind) {
    var r = c[0], g = c[1], b = c[2], a = c[3];
    var hsl = rgb2hsl(r, g, b), h = hsl[0], s = hsl[1], l = hsl[2], L, rgb;

    if (kind === 'shadow') {
      if (l < .3 && s < .5) return out(15, 25, 45, a * .32);          // kaali parchhai -> halki
      if (l > .9) return out(10, 20, 40, a * .45);                    // safed inset highlight
      rgb = mapRGBA([r, g, b, 1], 'paint');                           // rangeen glow
      c = parse(rgb); return out(c[0], c[1], c[2], a * .55);
    }

    var isBg = kind === 'bg';
    var hex = (hex2(Math.round(r)) + hex2(Math.round(g)) + hex2(Math.round(b))).toLowerCase();
    if (EXACT[hex] && (a >= 1 || l < .5)) {
      var e = parse('#' + EXACT[hex]);
      return out(e[0], e[1], e[2], a);
    }

    if (s < .2 || l < .06) {                                          // neutral
      if (a < 1 && l > .9) {
        // Dark site ke "glass" surfaces (rgba(255,255,255,.04)) -- light par
        // inhein grey (dark overlay) banane se cards dhundle lagte the.
        // Background mein ye halka safed panel bante hain; lines/text dark.
        // sirf halka "glass" (alpha < .3) -- gaadha safed chip (play button,
        // safed pill par dark icon) ulta hi rehna chahiye, warna icon gum
        if (kind === 'bg' && a < .3) return out(255, 255, 255, Math.min(.95, .55 + a * 6));
        return out(10, 20, 40, Math.min(1, a * 1.3));                 // hairline / faint text
      }
      if (l <= .045) L = .97;
      else if (l <= .3) L = 1 - (l - .045) * .35;
      else if (l < .45) L = .75 - (l - .3) * 1.5;
      else L = clamp(.08 + (.94 - l) * .909, .07, .56);
      rgb = hsl2rgb(h, s * .6, L);
      return out(rgb[0], rgb[1], rgb[2], a);
    }
    // Background / gradient mein .35 tak ke rangeen shades bhi "gehre surface"
    // hain (orb ka navy body); text/border mein .22 -- gehra accent text rahe.
    if (l < (isBg ? .35 : .22)) {                                     // gehra rangeen -> halka tint
      rgb = hsl2rgb(h, Math.min(s, .6), .965 - l * .3);
      return out(rgb[0], rgb[1], rgb[2], a);
    }
    L = l > .62 ? .40 : Math.max(.24, l * .7);                        // neon / pastel -> gehra
    rgb = hsl2rgb(h, s, L);
    // HSL lightness kaafi nahi: lime / yellow L .43 par bhi bohot roshan hain.
    // Asli luminance .2 tak laao taake light bg par parha ja sake.
    while (relLum(rgb) > .2 && L > .12) { L -= .025; rgb = hsl2rgb(h, s, L); }
    return out(rgb[0], rgb[1], rgb[2], a);
  }

  var TOK = /#[0-9a-fA-F]{3,8}\b|rgba?\([^()]*\)|hsla?\([^()]*\)|\b(?:white|black)\b/g;
  var TRIPLET = /^\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*$/;
  var cache = {};

  function mapValue(v, kind) {
    var k = kind + '|' + v;
    if (cache[k] !== undefined) return cache[k];
    var res;
    var t = v.match(TRIPLET);
    if (t) {                                   // --acr: 21,242,242 -> rgba(var(--acr),.3)
      var m = parse(mapRGBA([+t[1], +t[2], +t[3], 1], kind));
      res = Math.round(m[0]) + ',' + Math.round(m[1]) + ',' + Math.round(m[2]);
    } else {
      // url(...) ke andar (#hash, file naam) kuch na chhedo
      res = v.replace(/url\([^)]*\)|[^u]+|u/gi, function (seg) {
        if (/^url\(/i.test(seg)) return /data:image\/svg\+xml/i.test(seg) ? svgUrl(seg) : seg;
        return seg.replace(TOK, function (tok) {
          var c = parse(tok); return c ? mapRGBA(c, kind) : tok;
        });
      });
    }
    cache[k] = res;
    return res;
  }

  // data:image/svg+xml icons (footer contact, chevrons, checks) mein rang
  // %23RRGGBB ya #RRGGBB likhe hote hain -- unhe bhi light palette do.
  function svgUrl(u) {
    return u.replace(/(%23|#)([0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/g, function (all, pre, hex) {
      var c = parse('#' + hex);
      var m = c ? mapRGBA(c, 'paint') : null;
      return m && m[0] === '#' ? pre + m.slice(1) : all;
    }).replace(/(['"])(white|black)\1/gi, function (all, q, w) {
      return q + '%23' + mapRGBA(parse(w), 'paint').slice(1) + q;
    });
  }

  /* ------------------------------------------------- declarations */
  // Override mein sirf rang badalte hain, lekin shorthand (background:, border:)
  // dobara likhne se uske longhands reset ho jaate (background-clip:text ->
  // logo ka shimmer dabba ban jata tha). Is liye poori family copy hoti hai,
  // asli tarteeb mein -- cascade wahi rehta hai.
  var COLOR_PROPS = /^(color|background(-[\w-]+)?|-webkit-background-clip|border(-(top|right|bottom|left|block|inline|block-start|block-end|inline-start|inline-end))?(-(color|style|width))?|border-image(-[\w-]+)?|outline(-[\w-]+)?|box-shadow|text-shadow|fill|fill-opacity|stroke(-[\w-]+)?|stop-color|flood-color|lighting-color|caret-color|accent-color|column-rule(-[\w-]+)?|text-decoration(-[\w-]+)?|text-emphasis-color|-webkit-text-fill-color|-webkit-text-stroke(-[\w-]+)?|scrollbar-color|filter|color-scheme|mix-blend-mode)$/;

  // Custom property ka istemal maloom nahi -- naam se andaza: --surface, --bg,
  // --card ... background hain (light panel), baqi (--line, --ink) paint.
  var BG_VAR = /(^--(bg|page)|surface|panel|card|glass|tile|chip|sheet|fill|well|pill|btn-bg|-bg\d*$|Bg\d*$)/i;
  function varKind(name) { return BG_VAR.test(name) && !/line|border|ink|text|fg/i.test(name) ? 'bg' : 'paint'; }

  function kindOf(prop) {
    if (prop === 'box-shadow' || prop === 'text-shadow' || prop === 'filter') return 'shadow';
    return /^background(-color|-image)?$/.test(prop) ? 'bg' : 'paint';
  }
  function mapDecl(prop, val) {
    if (prop === 'color-scheme') return /dark/.test(val) ? 'light' : val;
    if (prop === 'mix-blend-mode') {
      return /^(screen|lighten|plus-lighter|color-dodge)$/.test(val.trim()) ? 'multiply' : val;
    }
    return mapValue(val, kindOf(prop));
  }

  /* ---------------------------------------------------- stylesheets */
  function splitSel(sel) {
    var parts = [], depth = 0, cur = '', q = null;
    for (var i = 0; i < sel.length; i++) {
      var ch = sel[i];
      if (q) { cur += ch; if (ch === q) q = null; continue; }
      if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
      if (ch === '(' || ch === '[') depth++;
      else if (ch === ')' || ch === ']') depth--;
      if (ch === ',' && !depth) { parts.push(cur); cur = ''; } else cur += ch;
    }
    parts.push(cur);
    return parts;
  }
  // .zt-dark subtree (video banners) light override se bacha rehta hai.
  // :where() ki specificity 0 hai -- tarteeb nahi bigadti.
  var NOT_DARK = ':not(:where(.zt-dark,.zt-dark *))';
  var PSEUDO_EL = /::?(?:before|after|placeholder|selection|marker|first-line|first-letter|backdrop|file-selector-button|-webkit-[\w-]+|-moz-[\w-]+)/i;
  function exempt(s) {
    var m = PSEUDO_EL.exec(s);
    return m ? s.slice(0, m.index) + NOT_DARK + s.slice(m.index) : s + NOT_DARK;
  }
  function prefix(sel) {
    return splitSel(sel).map(function (s) {
      s = s.trim();
      if (!s) return s;
      if (/^:root\b/.test(s)) return PFX + s.slice(5);
      if (/^html\b/.test(s)) return PFX + s.slice(4);
      if (/^\*$/.test(s)) return PFX + ' *' + NOT_DARK;
      return PFX + ' ' + exempt(s);
    }).join(',');
  }

  /* CSS source text khud parse hota hai, CSSOM se nahi: shorthand mein var()
     ho aur baad mein koi longhand (background-clip:text) aa jaye to Chrome
     poora value '' kar deta hai -- asli text wapas milta hi nahi. */
  function stripComments(t) { return t.replace(/\/\*[\s\S]*?\*\//g, ''); }

  // i se aage matching '}' ka index (strings / parens ka khayal)
  function blockEnd(t, i) {
    var depth = 1, q = null;
    for (; i < t.length; i++) {
      var ch = t[i];
      if (q) { if (ch === '\\') i++; else if (ch === q) q = null; continue; }
      if (ch === '"' || ch === "'") q = ch;
      else if (ch === '{') depth++;
      else if (ch === '}' && !--depth) return i;
    }
    return t.length;
  }
  // agla '{' ya ';' (top level)
  function nextStop(t, i) {
    var q = null, paren = 0;
    for (; i < t.length; i++) {
      var ch = t[i];
      if (q) { if (ch === '\\') i++; else if (ch === q) q = null; continue; }
      if (ch === '"' || ch === "'") q = ch;
      else if (ch === '(') paren++;
      else if (ch === ')') paren--;
      else if (!paren && (ch === '{' || ch === ';' || ch === '}')) return i;
    }
    return -1;
  }
  function splitTop(s, sep) {
    var out = [], depth = 0, cur = '', q = null;
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (q) { cur += ch; if (ch === '\\') { cur += s[++i] || ''; } else if (ch === q) q = null; continue; }
      if (ch === '"' || ch === "'") q = ch;
      else if (ch === '(' || ch === '{') depth++;
      else if (ch === ')' || ch === '}') depth--;
      if (ch === sep && !depth) { out.push(cur); cur = ''; } else cur += ch;
    }
    out.push(cur);
    return out;
  }

  function convDecls(body, sel) {
    var decl = '', isRoot = ROOTSEL.test(sel);
    var parts = splitTop(body, ';');
    for (var i = 0; i < parts.length; i++) {
      var d = parts[i], c = d.indexOf(':');
      if (c < 0 || d.indexOf('{') >= 0) continue;          // nested rule -- chhodo
      var p = d.slice(0, c).trim(), v = d.slice(c + 1).trim();
      var imp = /!\s*important\s*$/i.test(v);
      if (imp) v = v.replace(/!\s*important\s*$/i, '').trim();
      if (!v) continue;
      var custom = p.lastIndexOf('--', 0) === 0;
      if (!custom) p = p.toLowerCase();
      if (!custom && !COLOR_PROPS.test(p)) continue;
      var nv = custom ? mapValue(v, varKind(p)) : mapDecl(p, v);
      // .zt-dark ke liye :root ke sab asli vars -- un-badle bhi, kyunki
      // --ac:var(--teal) root par resolve ho kar light hi inherit hota
      if (custom && isRoot) rootVars[p] = v;
      if (custom && nv === v) continue;     // custom prop ki copy sirf jab badle
      decl += p + ':' + nv + (imp ? ' !important' : '') + ';';
    }
    return decl;
  }

  var GROUP_AT = /^@(media|supports|container|layer|document|-moz-document|scope)\b/i;
  function convText(t, top) {
    if (top) t = stripComments(t);
    var css = '', i = 0;
    while (i < t.length) {
      var stop = nextStop(t, i);
      if (stop < 0) break;
      var pre = t.slice(i, stop).trim();
      if (t[stop] === ';' || t[stop] === '}') { i = stop + 1; continue; }   // @import, kachra
      var end = blockEnd(t, stop + 1), body = t.slice(stop + 1, end);
      i = end + 1;
      if (pre[0] === '@') {
        if (GROUP_AT.test(pre)) {
          var inner = convText(body, false);
          if (inner) css += (/^@layer\b/i.test(pre) ? inner : pre + '{' + inner + '}') + '\n';
        }
        continue;                           // @keyframes, @font-face, @property ...
      }
      if (!pre) continue;
      var decl = convDecls(body, pre);
      if (decl) css += prefix(pre) + '{' + decl + '}\n';
    }
    return css;
  }

  // CSSOM fallback -- sirf jab source text na mile (insertRule wali sheets)
  function convRules(rules) {
    var css = '';
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      if (r.type === 1 && r.selectorText) {
        var decl = convDecls(r.style.cssText, r.selectorText);
        if (decl) css += prefix(r.selectorText) + '{' + decl + '}\n';
      } else if (r.type === 4 && r.cssRules) {
        var inner = convRules(r.cssRules);
        if (inner) css += '@media ' + r.media.mediaText + '{' + inner + '}\n';
      } else if (r.type === 12 && r.cssRules) {
        var inn = convRules(r.cssRules);
        if (inn) css += '@supports ' + r.conditionText + '{' + inn + '}\n';
      }
    }
    return css;
  }

  var done = typeof WeakSet === 'function' ? new WeakSet() : null;
  var pending = [];
  function sheetOut() {
    var s = D.createElement('style');
    s.setAttribute('data-zt', '');
    (D.head || R).appendChild(s);
    return s;
  }
  function emit(css) {
    if (css) sheetOut().textContent = css;
    darkVars();
  }
  var textCache = {};
  function convSheet(sheet) {
    if (!sheet || (done && done.has(sheet))) return;
    var own = sheet.ownerNode;
    if (own && own.hasAttribute && own.hasAttribute('data-zt')) return;
    var href = sheet.href;
    if (href) {
      if (href.indexOf(location.origin) !== 0) return;      // Google Fonts waghera
      if (done) done.add(sheet);
      if (textCache[href] !== undefined) { emit(textCache[href]); return; }
      var pr = fetch(href, { credentials: 'same-origin' }).then(function (r) { return r.text(); })
        .then(function (t) { textCache[href] = convText(t, true); emit(textCache[href]); })
        .catch(function () {
          try { emit(convRules(sheet.cssRules)); } catch (e) {}
        });
      pending.push(pr);
      return;
    }
    if (done) done.add(sheet);
    var txt = own && own.tagName === 'STYLE' ? own.textContent : '';
    if (txt) emit(convText(txt, true));
    else { try { emit(convRules(sheet.cssRules)); } catch (e) {} }
  }
  var ROOTSEL = /^\s*(:root|html|body)\s*(,\s*(:root|html|body)\s*)*$/;
  var rootVars = {}, darkBox = null;
  // .zt-dark par :root ke asli (dark) variables wapas -- warna inherit ho kar
  // light aa jaate
  function darkVars() {
    var css = '';
    for (var k in rootVars) css += k + ':' + rootVars[k] + ';';
    if (!css) return;
    if (!darkBox) darkBox = sheetOut();
    darkBox.textContent = PFX + ' .zt-dark{' + css + 'color-scheme:dark}';
  }
  var KEEP_DARK = '.m-banner';
  function markDark(root) {
    var els = (root || D).querySelectorAll ? (root || D).querySelectorAll(KEEP_DARK) : [];
    for (var i = 0; i < els.length; i++) els[i].classList.add('zt-dark');
    if (root && root.matches && root.matches(KEEP_DARK)) root.classList.add('zt-dark');
  }
  function convAllSheets() {
    var ss = D.styleSheets;
    for (var i = 0; i < ss.length; i++) convSheet(ss[i]);
    darkVars();
  }

  /* ---------------------------------------------- inline style + svg */
  var tracked = [];
  var SVG_ATTRS = ['fill', 'stroke', 'stop-color', 'flood-color', 'color'];
  function splitDecls(s) {
    var out = [], depth = 0, cur = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (ch === '(') depth++; else if (ch === ')') depth--;
      if (ch === ';' && !depth) { out.push(cur); cur = ''; } else cur += ch;
    }
    out.push(cur);
    return out;
  }
  function mapStyleText(s) {
    return splitDecls(s).map(function (d) {
      var i = d.indexOf(':');
      if (i < 0) return d;
      var p = d.slice(0, i).trim().toLowerCase(), v = d.slice(i + 1);
      if (p.lastIndexOf('--', 0) === 0) return d.slice(0, i + 1) + mapValue(v, varKind(p));
      if (!COLOR_PROPS.test(p)) return d;
      return d.slice(0, i + 1) + mapDecl(p, v);
    }).join(';');
  }
  var HAS_COLOR = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|\bwhite\b|\bblack\b|--[\w-]+\s*:\s*\d{1,3}\s*,/;

  function mapEl(el) {
    if (el.nodeType !== 1 || el.hasAttribute('data-zt-skip')) return;
    if (el.closest && el.closest('.zt-dark')) return;
    var st = el.getAttribute('style');
    if (st && HAS_COLOR.test(st)) {
      var rec = el.__zts;
      if (!rec || (st !== rec.m)) {
        var m = mapStyleText(st);
        if (m !== st) {
          if (!rec) tracked.push(el);
          el.__zts = { o: st, m: m };
          el.setAttribute('style', m);
        }
      }
    }
    if (el.namespaceURI === 'http://www.w3.org/2000/svg') {
      for (var i = 0; i < SVG_ATTRS.length; i++) {
        var a = SVG_ATTRS[i], v = el.getAttribute(a);
        if (!v || !HAS_COLOR.test(v)) continue;
        var key = '__zta_' + a, r2 = el[key];
        if (r2 && v === r2.m) continue;
        var mv = mapValue(v, 'paint');
        if (mv === v) continue;
        if (!el.__ztaAny) { el.__ztaAny = 1; tracked.push(el); }
        el[key] = { o: v, m: mv };
        el.setAttribute(a, mv);
      }
    }
  }
  function mapTree(root) {
    if (!root || root.nodeType !== 1) return;
    mapEl(root);
    var all = root.querySelectorAll('[style],[fill],[stroke],[stop-color]');
    for (var i = 0; i < all.length; i++) mapEl(all[i]);
  }
  function restoreAll() {
    for (var i = 0; i < tracked.length; i++) {
      var el = tracked[i], rec = el.__zts;
      if (rec && el.getAttribute('style') === rec.m) el.setAttribute('style', rec.o);
      el.__zts = null;
      for (var j = 0; j < SVG_ATTRS.length; j++) {
        var key = '__zta_' + SVG_ATTRS[j], r2 = el[key];
        if (r2 && el.getAttribute(SVG_ATTRS[j]) === r2.m) el.setAttribute(SVG_ATTRS[j], r2.o);
        el[key] = null;
      }
      el.__ztaAny = 0;
    }
    tracked = [];
  }

  /* ------------------------------------------------------ observer */
  var mo = null;
  function onMut(list) {
    if (!isLight() || nativeLight) return;
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m.type === 'childList') {
        // <style> ka text JS ne badla -- nayi sheet banti hai
        if (m.target.tagName === 'STYLE' && !m.target.hasAttribute('data-zt')) convSheet(m.target.sheet);
        for (var j = 0; j < m.addedNodes.length; j++) {
          var n = m.addedNodes[j];
          if (n.nodeType !== 1) continue;
          if (n.tagName === 'STYLE' && !n.hasAttribute('data-zt')) convSheet(n.sheet);
          else if (n.tagName === 'LINK' && /stylesheet/i.test(n.rel)) {
            if (n.sheet) convSheet(n.sheet);
            n.addEventListener('load', function () { convSheet(this.sheet); });
          } else { markDark(n); mapTree(n); }
          if (n.querySelectorAll) {
            var ss = n.querySelectorAll('style:not([data-zt])');
            for (var k = 0; k < ss.length; k++) convSheet(ss[k].sheet);
          }
        }
      } else if (m.type === 'attributes') mapEl(m.target);
    }
  }
  function observe() {
    if (mo || typeof MutationObserver !== 'function') return;
    mo = new MutationObserver(onMut);
    mo.observe(R, { childList: true, subtree: true, attributes: true,
                    attributeFilter: ['style', 'fill', 'stroke', 'stop-color'] });
  }

  /* ------------------------------------------------------- iframes */
  function frameTheme(f) {
    try {
      var w = f.contentWindow, d = f.contentDocument;
      if (!d || !d.documentElement) return;
      if (w.__zt) { w.__zt.set(cur(), true); return; }
      if (!isLight()) return;
      d.documentElement.setAttribute('data-theme', 'light');
      var s = d.createElement('script');
      s.src = '/theme.js';
      (d.head || d.documentElement).appendChild(s);
    } catch (e) { /* cross-origin */ }
  }
  function allFrames() {
    var fs = D.querySelectorAll('iframe');
    for (var i = 0; i < fs.length; i++) frameTheme(fs[i]);
  }

  /* -------------------------------------------------------- toggle */
  var BTN_CSS =
    '.zt-btn{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;' +
    'width:40px;height:40px;padding:0;margin:0 10px 0 auto;border-radius:50%;cursor:pointer;' +
    'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.18);color:#EEF1F8;' +
    'transition:border-color .2s,color .2s,background .2s;-webkit-tap-highlight-color:transparent}' +
    '.zt-btn:hover{border-color:#15F2F2;color:#15F2F2}' +
    '.zt-btn:focus-visible{outline:2px solid #15F2F2;outline-offset:3px}' +
    '.zt-btn svg{width:18px;height:18px;display:block}' +
    '.zt-btn .zt-moon{display:none}' +
    'html[data-theme="light"] .zt-btn{background:#fff;border-color:rgba(10,20,40,.18);color:#0A1020;box-shadow:0 2px 10px rgba(15,25,45,.1)}' +
    'html[data-theme="light"] .zt-btn:hover{border-color:#0A9AA1;color:#0A9AA1}' +
    'html[data-theme="light"] .zt-btn .zt-sun{display:none}' +
    'html[data-theme="light"] .zt-btn .zt-moon{display:block}' +
    '.m-head .zt-btn{width:38px;height:38px;margin-right:8px}' +
    'html[data-theme="light"]:not(.zt-native-light){color-scheme:light}' +
    'html[data-theme="light"] ::selection{background:rgba(10,154,161,.22)}';
  var SUN = '<svg class="zt-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var MOON = '<svg class="zt-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

  function addBaseCss() {
    if (D.getElementById('zt-base')) return;
    var s = D.createElement('style');
    s.id = 'zt-base'; s.setAttribute('data-zt', '');
    s.textContent = BTN_CSS;
    (D.head || R).appendChild(s);
  }
  function syncButtons() {
    var light = isLight();
    var bs = D.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < bs.length; i++) {
      bs[i].setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme');
      bs[i].setAttribute('aria-pressed', light ? 'true' : 'false');
      bs[i].title = light ? 'Dark theme' : 'Light theme';
    }
  }
  function addButtons() {
    if (IN_FRAME) return;
    var heads = D.querySelectorAll('header.znav, header.m-head');
    for (var i = 0; i < heads.length; i++) {
      var h = heads[i];
      if (h.querySelector('[data-theme-toggle]')) continue;
      var b = D.createElement('button');
      b.type = 'button';
      b.className = 'zt-btn';
      b.setAttribute('data-theme-toggle', '');
      b.setAttribute('data-zt-skip', '');
      b.innerHTML = SUN + MOON;
      var burger = h.querySelector('.znav-btn, .m-burger');
      h.insertBefore(b, burger || null);
      b.addEventListener('click', function () { set(isLight() ? 'dark' : 'light'); });
    }
    syncButtons();
  }

  /* --------------------------------------------------------- state */
  function isLight() { return R.getAttribute('data-theme') === 'light'; }
  function cur() { return isLight() ? 'light' : 'dark'; }

  var metaTC = null;
  function themeColor() {
    if (!metaTC) metaTC = D.querySelector('meta[name="theme-color"]');
    if (!metaTC) return;
    if (!metaTC.__zto) metaTC.__zto = metaTC.getAttribute('content') || '#05080F';
    metaTC.setAttribute('content', isLight() ? '#F5F7FB' : metaTC.__zto);
  }

  // Kuch pages (jaise /food/app/numerus) pehle se light design hain -- unhe
  // ulta karne se wo dark ho jaate. Asli body background dekh kar pehchano.
  var nativeLight = null;
  function detectNative() {
    if (nativeLight !== null) return nativeLight;
    var had = R.classList.contains('zt-pending');
    if (had) R.classList.remove('zt-pending');          // snippet ka bg hata kar asli dekho
    var c = getComputedStyle(D.body || R).backgroundColor;
    if (!parse(c) || parse(c)[3] < .5) c = getComputedStyle(R).backgroundColor;
    if (had) R.classList.add('zt-pending');
    var v = parse(c);
    nativeLight = !!(v && v[3] >= .5 && rgb2hsl(v[0], v[1], v[2])[2] > .6);
    if (nativeLight) R.classList.add('zt-native-light');
    return nativeLight;
  }

  function apply() {
    themeColor();
    if (detectNative()) { allFrames(); unhide(); return; }
    if (isLight()) {
      markDark();
      convAllSheets();
      mapTree(R);
      observe();
    } else {
      restoreAll();
    }
    allFrames();
    var p = pending; pending = [];
    if (p.length && typeof Promise === 'function') {
      Promise.all(p).then(unhide, unhide);
      setTimeout(unhide, 1500);
    } else unhide();
  }
  function unhide() { R.classList.remove('zt-pending'); }

  function set(t, fromParent) {
    t = t === 'light' ? 'light' : 'dark';
    R.setAttribute('data-theme', t);
    if (!fromParent && !IN_FRAME) { try { localStorage.setItem(KEY, t); } catch (e) {} }
    apply();
    syncButtons();
    try { W.dispatchEvent(new CustomEvent('zt-theme', { detail: t })); } catch (e) {}
    // static canvas (ek baar bane gradients) -- resize par scripts dobara banate hain
    if (!fromParent) { try { W.dispatchEvent(new Event('resize')); } catch (e) {} }
  }

  W.__zt = { set: set, get: cur, map: mapValue };

  /* ------------------------------------------- canvas 2D + three.js */
  // Orbs, sparklines, demo charts JS se canvas par bante hain -- CSS wahan
  // nahi pahunchti. Light mode mein canvas ke rang bhi wahi mapping lete hain.
  function canvasLight(ctx) {
    if (!isLight() || nativeLight) return false;
    var c = ctx && ctx.canvas;
    if (c && c.__ztd === undefined) c.__ztd = !!(c.closest && c.closest('.zt-dark'));
    return !(c && c.__ztd);
  }
  function hookCanvas() {
    var C = W.CanvasRenderingContext2D, P = C && C.prototype;
    if (!P || P.__zt) return;
    P.__zt = 1;
    ['fillStyle', 'strokeStyle', 'shadowColor'].forEach(function (k) {
      var d = Object.getOwnPropertyDescriptor(P, k);
      if (!d || !d.set) return;
      Object.defineProperty(P, k, {
        configurable: true, enumerable: d.enumerable, get: d.get,
        set: function (v) {
          if (typeof v === 'string' && canvasLight(this)) v = mapValue(v, 'paint');
          d.set.call(this, v);
        }
      });
    });
    var G = W.CanvasGradient && W.CanvasGradient.prototype;
    if (G && G.addColorStop) {
      var ac = G.addColorStop;
      G.addColorStop = function (o, c) {
        if (typeof c === 'string' && isLight() && !nativeLight) c = mapValue(c, 'bg');
        return ac.call(this, o, c);
      };
    }
  }

  // three.js: Scene.onBeforeRender har frame chalta hai (prototype par) --
  // wahan se scene ke materials theme ke hisaab se badal do.
  function lightFrag(src) {
    var i = src.lastIndexOf('gl_FragColor');
    if (i < 0) return src;
    var j = src.indexOf('vec4(', i);
    if (j < 0) return src;
    var k = j + 5, depth = 1;
    for (; k < src.length && depth; k++) { if (src[k] === '(') depth++; else if (src[k] === ')') depth--; }
    var args = splitTop(src.slice(j + 5, k - 1), ',');
    if (args.length !== 2) return src;
    // dark-design rang: gehra hissa -> moti jaisa safed, roshan hissa -> gehra rang
    var body = '{vec3 zc=(' + args[0] + ');float zl=dot(zc,vec3(.299,.587,.114));' +
      'vec3 zo=mix(vec3(.97,.98,1.),zc*.6,smoothstep(.12,.8,zl));' +
      'gl_FragColor=vec4(zo,clamp((' + args[1] + ')*ZT_A,0.,1.));}';
    var end = src.indexOf(';', k);
    return src.slice(0, i) + body + src.slice(end + 1);
  }
  function themeMat(m, light, T) {
    if (!m.__zto) m.__zto = { b: m.blending, o: m.opacity, c: m.color && m.color.clone ? m.color.clone() : null,
                              f: m.isShaderMaterial ? m.fragmentShader : null };
    var o = m.__zto, add = o.b === T.AdditiveBlending;
    if (!light) {
      m.blending = o.b; m.opacity = o.o;
      if (o.c) m.color.copy(o.c);
      if (o.f) m.fragmentShader = o.f;
    } else {
      if (add) { m.blending = T.NormalBlending; m.opacity = Math.min(.9, o.o * 1.6); }
      if (o.c && !m.isShaderMaterial) m.color.copy(o.c).multiplyScalar(.6);
      if (o.f) m.fragmentShader = lightFrag(o.f).replace('ZT_A', add ? '0.35' : '1.0');
    }
    m.needsUpdate = true;
  }
  function themeScene(sc, T) {
    var want = isLight() && !nativeLight;
    if (sc.__ztL === want) return;
    sc.__ztL = want;
    sc.traverse(function (ob) {
      var m = ob.material;
      if (!m) return;
      (Array.isArray(m) ? m : [m]).forEach(function (mt) { try { themeMat(mt, want, T); } catch (e) {} });
    });
  }
  function hookThree() {
    var T = W.THREE;
    if (!T || !T.Scene || T.__zt) return;
    T.__zt = 1;
    var orig = T.Scene.prototype.onBeforeRender;
    T.Scene.prototype.onBeforeRender = function () {
      try { themeScene(this, T); } catch (e) {}
      if (orig) return orig.apply(this, arguments);
    };
  }

  function init() {
    var t = null;
    if (!IN_FRAME) { try { t = localStorage.getItem(KEY); } catch (e) {} }
    // ?theme=light / ?theme=dark -- link share karne aur testing ke liye
    var q = /[?&]theme=(light|dark)\b/.exec(location.search);
    if (q) { t = q[1]; try { localStorage.setItem(KEY, t); } catch (e) {} }
    if (t === 'light' || t === 'dark') R.setAttribute('data-theme', t);
    else if (!R.getAttribute('data-theme')) R.setAttribute('data-theme', 'dark');
    hookCanvas();
    hookThree();
    addBaseCss();
    addButtons();
    apply();
    // late stylesheets (async link) + iframes jo baad mein load hon
    W.addEventListener('load', function () { hookThree(); if (isLight() && !nativeLight) { convAllSheets(); mapTree(R); } allFrames(); });
    D.addEventListener('load', function (e) {
      var t2 = e.target;
      if (t2 && t2.tagName === 'IFRAME') frameTheme(t2);
      else if (t2 && t2.tagName === 'LINK' && isLight()) convSheet(t2.sheet);
    }, true);
    // dusri tab mein badla to yahan bhi
    W.addEventListener('storage', function (e) {
      if (e.key === KEY && (e.newValue === 'light' || e.newValue === 'dark') && e.newValue !== cur()) set(e.newValue, true);
    });
  }

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init);
  else init();
})();
