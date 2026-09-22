/* Zentallio mobile — sirf wahi behaviour jo phone par chahiye. */
(function () {
  'use strict';

  /* ---- 1. Menu ---------------------------------------------------------- */
  var burger = document.getElementById('mBurger');
  var menu   = document.getElementById('mMenu');
  if (burger && menu) {
    var setMenu = function (open) {
      document.body.classList.toggle('menu-open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      menu.setAttribute('aria-hidden', open ? 'false' : 'true');
    };
    burger.addEventListener('click', function () {
      setMenu(!document.body.classList.contains('menu-open'));
    });
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setMenu(false);
    });
  }

  /* ---- 2. Scroll reveal -------------------------------------------------- */
  var revs = document.querySelectorAll('.m-rev');
  if (revs.length && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    revs.forEach(function (el) { io.observe(el); });
  } else {
    revs.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---- 3. Sticky CTA — hero guzarne ke baad ----------------------------- */
  var cta  = document.querySelector('.m-sticky-cta');
  var hero = document.querySelector('.m-hero');
  if (cta && hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (e) {
      cta.classList.toggle('is-on', !e[0].isIntersecting);
    }, { threshold: 0 }).observe(hero);
  }

  /* ---- 4. Counter animation (desktop ke data-n chips) -------------------- */
  var nums = document.querySelectorAll('[data-n]');
  if (nums.length && 'IntersectionObserver' in window &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var nio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target, to = parseFloat(el.dataset.n) || 0, t0 = null;
        var dec = (String(el.dataset.n).split('.')[1] || '').length;
        (function step(ts) {
          if (!t0) t0 = ts;
          var p = Math.min((ts - t0) / 900, 1);
          var v = to * (1 - Math.pow(1 - p, 3));
          el.textContent = dec ? v.toFixed(dec) : Math.round(v).toLocaleString();
          if (p < 1) requestAnimationFrame(step);
        })(performance.now());
        nio.unobserve(el);
      });
    }, { threshold: 0.4 });
    nums.forEach(function (el) { nio.observe(el); });
  } else {
    nums.forEach(function (el) {
      var n = parseFloat(el.dataset.n);
      if (!isNaN(n)) el.textContent = n.toLocaleString();
    });
  }

  /* ---- 5. Desktop / mobile switch — cookie dono hosts par chalti hai ----- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-view]');
    if (!a) return;
    var host = location.hostname;
    var root = host.replace(/^m\./, '');
    document.cookie = 'zv=' + a.dataset.view + ';path=/;max-age=2592000;domain=.' +
                      root + (location.protocol === 'https:' ? ';secure' : '') + ';samesite=lax';
  });

  /* ---- 6. Overflow guard (dev only) ------------------------------------- */
  if (location.hostname === 'localhost' || location.hostname.indexOf('local.') === 0) {
    requestAnimationFrame(function () {
      var w = document.documentElement.clientWidth, bad = [];
      document.querySelectorAll('body *').forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.width > 0 && (r.right > w + 1 || r.left < -1)) bad.push(el);
      });
      if (bad.length) console.warn('[overflow]', bad.length, 'element(s) baahar ja rahe hain:', bad);
      else console.info('[overflow] clean ✓');
    });
  }
})();
