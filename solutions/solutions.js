/* Zentallio — Solutions pages: sector selector + reveal. Markup: tools/build_solutions.py */
(function () {
  'use strict';
  var root = document.getElementById('sectors');
  if (root) {
    var bar = document.getElementById('zsSxbar');
    var tabs = root.querySelectorAll('.zs-ind button');
    var rows = root.querySelectorAll('.zs-sxrow');
    var pills = root.querySelectorAll('.zs-pill');
    var panels = root.querySelectorAll('.zs-panel');
    var last = { fb: 'qsr', fa: 'apparel' };

    var showInd = function (ind) {
      tabs.forEach(function (t) { t.setAttribute('aria-selected', t.dataset.ind === ind ? 'true' : 'false'); });
      rows.forEach(function (r) { r.hidden = r.dataset.row !== ind; });
    };

    var select = function (id, opts) {
      opts = opts || {};
      var panel = root.querySelector('.zs-panel[data-sec="' + id + '"]');
      if (!panel) return;
      var ind = panel.dataset.ind;
      last[ind] = id;
      showInd(ind);
      panels.forEach(function (p) { p.hidden = p !== panel; });
      pills.forEach(function (b) {
        var on = b.dataset.sec === id;
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        if (on) {
          bar.style.setProperty('--cur', b.style.getPropertyValue('--sh'));
          var row = b.parentNode;
          if (row.scrollWidth > row.clientWidth) {
            row.scrollTo({ left: b.offsetLeft - 16, behavior: opts.instant ? 'auto' : 'smooth' });
          }
        }
      });
      if (opts.hash !== false) {
        try { history.replaceState(null, '', '#sector-' + id); } catch (e) {}
      }
      if (opts.scroll) {
        var top = root.querySelector('.zs-panels').getBoundingClientRect().top + window.scrollY - bar.offsetHeight - 90;
        if (window.scrollY > top + 40 || opts.force) window.scrollTo({ top: top, behavior: 'smooth' });
      }
    };

    pills.forEach(function (b) {
      b.addEventListener('click', function () { select(b.dataset.sec, { scroll: true }); });
    });
    tabs.forEach(function (t) {
      t.addEventListener('click', function () { select(last[t.dataset.ind], { scroll: true }); });
    });

    var fromHash = function (instant) {
      var m = /^#sector-([\w-]+)$/.exec(location.hash);
      if (m && root.querySelector('.zs-panel[data-sec="' + m[1] + '"]')) {
        select(m[1], { hash: false, instant: instant });
        if (!instant) root.scrollIntoView({ behavior: 'smooth' });
        return true;
      }
      return false;
    };
    if (!fromHash(true)) select('qsr', { hash: false, instant: true });
    window.addEventListener('hashchange', function () { fromHash(false); });
  }

  /* scroll reveal */
  var els = document.querySelectorAll('.zs-sechead, .zs-card, .zs-layer, .zs-pil, .zs-out, .zs-cta');
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
    els.forEach(function (el) { el.classList.add('zs-rv'); io.observe(el); });
  }
})();
