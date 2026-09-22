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

  /* ---- 4b. Sector selector — desktop ke #sector= hash ke sath compatible -- */
  var tabs = document.querySelectorAll('.m-sector-tabs .m-pill');
  if (tabs.length) {
    var panels = document.querySelectorAll('.m-sector-panel');
    var bar = document.querySelector('.m-sector-tabs');

    var show = function (id, scroll) {
      var found = false;
      panels.forEach(function (p) {
        var on = p.dataset.sector === id;
        p.hidden = !on;
        p.classList.toggle('is-on', on);
        if (on) found = true;
      });
      if (!found) return false;
      panels.forEach(function (p) {
        if (p.hidden) stopBanner(p); else playBanner(p);
      });
      tabs.forEach(function (t) {
        var on = t.dataset.sector === id;
        t.classList.toggle('is-on', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        if (on && bar) {
          // chuna hua pill hamesha nazar mein rahe
          var l = t.offsetLeft - (bar.clientWidth - t.offsetWidth) / 2;
          bar.scrollTo({ left: Math.max(l, 0), behavior: 'smooth' });
        }
      });
      if (scroll && bar) {
        var top = bar.getBoundingClientRect().bottom + window.scrollY - 8;
        window.scrollTo({ top: top, behavior: 'smooth' });
      }
      return true;
    };

    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        if (show(t.dataset.sector, false)) {
          history.replaceState(null, '', '#sector=' + t.dataset.sector);
        }
      });
    });

    var fromHash = function (scroll) {
      var m = (location.hash || '').match(/sector=([a-z0-9-]+)/i);
      if (m) show(m[1].toLowerCase(), scroll);
    };
    window.addEventListener('hashchange', function () { fromHash(true); });
    fromHash(false);

    // khula hua panel sirf tab chale jab wo screen par ho -- warna page khulte
    // hi ek clip bekaar download hota hai
    var first = document.querySelector('.m-sector-panel:not([hidden])');
    if (first && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (e, obs) {
        e.forEach(function (en) {
          var p = document.querySelector('.m-sector-panel:not([hidden])');
          if (en.isIntersecting) playBanner(p); else stopBanner(p);
        });
      }, { threshold: 0.15 }).observe(first.parentNode);
    } else if (first) {
      playBanner(first);
    }
  }

  /* ---- 4c. Banner clips — sirf khula hua panel apna video load kare ------ */
  var slowNet = (navigator.connection &&
                 (navigator.connection.saveData ||
                  /^(slow-)?2g$/.test(navigator.connection.effectiveType || '')));
  var noMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function playBanner(panel) {
    if (!panel) return;
    var v = panel.querySelector('.m-banner-vid');
    if (!v) return;
    // poster pehle -- kuch to foran nazar aaye
    if (!v.poster && v.dataset.poster) v.poster = v.dataset.poster;
    if (slowNet || noMotion) return;             // poster hi kaafi hai
    if (!v.src && v.dataset.src) v.src = v.dataset.src;
    var p = v.play();
    if (p && p.catch) p.catch(function () {});   // autoplay block ho to poster rahega
  }

  function stopBanner(panel) {
    if (!panel) return;
    var v = panel.querySelector('.m-banner-vid');
    if (!v) return;
    try {
      v.pause();
      // src hata do -- warna 10 clips background mein buffer karte rehte hain
      if (v.src) { v.removeAttribute('src'); v.load(); }
    } catch (e) {}
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
