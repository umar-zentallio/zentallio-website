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

  // 4b ka show() hash par foran chalta hai -- ye pehle se tayyar hon
  var noMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var rotTimers = [];

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
      stopRot();
      panels.forEach(function (p) {
        if (p.hidden) { stopBanner(p); } else { playBanner(p); startRot(p); }
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

    // Tabs ki row khud aahista aage khisakti hai (end par wapas) -- haath se
    // swipe/tap karo to ruk jaati hai, chhorne ke kuch der baad phir chal parti hai.
    if (bar && !noMotion) {
      var SPEED = 18, IDLE = 3500;        // px/s, aur interaction ke baad wait
      var pos = bar.scrollLeft, dir = 1, last = 0, hold = 0, drifting = false;
      var pause = function () {
        hold = Date.now() + IDLE;
        if (drifting) { drifting = false; bar.classList.remove('is-drifting'); }
      };
      ['touchstart', 'pointerdown', 'wheel', 'click'].forEach(function (ev) {
        bar.addEventListener(ev, pause, { passive: true });
      });
      var tick = function (now) {
        var max = bar.scrollWidth - bar.clientWidth;
        var dt = last ? Math.min(now - last, 64) / 1000 : 0;
        last = now;
        if (max > 4 && Date.now() > hold && !document.hidden) {
          if (!drifting) { drifting = true; pos = bar.scrollLeft; bar.classList.add('is-drifting'); }
          pos += dir * SPEED * dt;
          if (pos >= max) { pos = max; dir = -1; hold = Date.now() + 1200; }
          else if (pos <= 0) { pos = 0; dir = 1; hold = Date.now() + 1200; }
          bar.scrollLeft = pos;
        }
        requestAnimationFrame(tick);
      };
      hold = Date.now() + 1500;           // page khulte hi foran nahi
      requestAnimationFrame(tick);
    }

    // Banner sirf tab chale jab wo waqai screen par ho. Observer har
    // .m-banner par lagta hai (section par nahi -- wo itna bada hai ke
    // threshold kabhi poora nahi hota).
    if ('IntersectionObserver' in window) {
      var bio = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var panel = en.target.closest('.m-sector-panel');
          if (!panel || panel.hidden) { stopBanner(panel); return; }
          if (en.isIntersecting) { playBanner(panel); startRot(panel); }
          else { stopBanner(panel); stopRot(); }
        });
      }, { threshold: 0.25 });
      document.querySelectorAll('.m-banner').forEach(function (b) { bio.observe(b); });
    } else {
      var f0 = document.querySelector('.m-sector-panel:not([hidden])');
      if (f0) { playBanner(f0); startRot(f0); }
    }
  }

  /* ---- 4c. Banner clips — sirf khula hua panel apna video load kare ------ */
  var slowNet = (navigator.connection &&
                 (navigator.connection.saveData ||
                  /^(slow-)?2g$/.test(navigator.connection.effectiveType || '')));

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

  /* ---- 4d. Banner ki rotating headline (desktop jaisa) ------------------ */

  function stopRot() {
    rotTimers.forEach(clearInterval);
    rotTimers = [];
  }

  function startRot(panel) {
    if (!panel || noMotion) return;
    var wrap = panel.querySelector('.m-rot');
    if (!wrap) return;
    var items = wrap.querySelectorAll('.m-rot-item');
    var ticks = panel.querySelectorAll('.m-rot-ticks .m-tick');
    if (items.length < 2) return;

    var i = 0;
    var paint = function (n) {
      i = n % items.length;
      items.forEach(function (el, k) { el.classList.toggle('is-on', k === i); });
      ticks.forEach(function (el, k) { el.classList.toggle('is-on', k === i); });
    };
    ticks.forEach(function (t) {
      t.addEventListener('click', function () {
        paint(+t.dataset.r);
        stopRot();                       // haath se chuna to auto rotate band
      });
    });
    rotTimers.push(setInterval(function () { paint(i + 1); }, 5200));
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

  /* ---- Lead forms -> /api/lead (contact + walkthrough) ------------------ */
  document.querySelectorAll('form.m-form[data-source]').forEach(function (form) {
    var btn  = form.querySelector('button[type="submit"]');
    var note = form.querySelector('.m-form-note');
    var done = form.parentNode.querySelector('.m-form-done');
    var noteText = note ? note.textContent : '';
    var when = '';
    var emailRE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    var val = function (n) { var f = form.elements[n]; return f ? f.value.trim() : ''; };
    var flag = function (n) {
      var f = form.elements[n]; if (!f) return;
      f.closest('.m-field').classList.add('err'); f.focus();
    };
    form.addEventListener('input', function (e) {
      var w = e.target.closest('.m-field'); if (w) w.classList.remove('err');
    });
    form.querySelectorAll('.m-chip').forEach(function (c) {
      c.addEventListener('click', function () {
        form.querySelectorAll('.m-chip').forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
        c.setAttribute('aria-pressed', 'true'); when = c.getAttribute('data-when');
      });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (btn.disabled) return;
      var source = form.getAttribute('data-source');
      var email = val('email'), name = val('name'), message = val('message');
      if (source === 'walkthrough') {
        if (!emailRE.test(email)) return flag('email');
        name = name || email;
        message = 'Walkthrough request (' + (form.getAttribute('data-topic') || 'site') +
                  ') — preferred window: ' + (when || 'not specified');
      } else {
        if (!name) return flag('name');
        if (!message) return flag('message');
      }
      var label = btn.textContent;
      btn.disabled = true; btn.textContent = 'Sending…';
      if (note) { note.textContent = noteText; note.classList.remove('err'); }
      fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: source, name: name, email: email,
          company: val('company'), phone: val('phone'), message: message })
      }).then(function (r) {
        if (!r.ok) throw new Error('lead_failed');
        form.reset(); when = '';
        form.querySelectorAll('.m-chip').forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
        form.hidden = true; if (done) done.hidden = false;
      }).catch(function () {
        if (note) { note.textContent = 'Something went wrong — please email info@zentallio.com directly.'; note.classList.add('err'); }
      }).then(function () { btn.disabled = false; btn.textContent = label; });
    });
    var again = done && done.querySelector('[data-again]');
    if (again) again.addEventListener('click', function () { done.hidden = true; form.hidden = false; });
  });

  /* ---- 5b. Pill rows auto-slide right → left (home ka marquee pattern) ---
     Static rows only — interactive tab rows (.m-sector-tabs) are left alone. */
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('.m-pills:not(.m-sector-tabs):not(.m-pills--marquee)').forEach(function (row) {
      if (row.querySelector('a,button')) return;
      var track = document.createElement('div');
      track.className = 'm-marquee-track';
      while (row.firstChild) track.appendChild(row.firstChild);
      Array.prototype.slice.call(track.children).forEach(function (p) {
        var c = p.cloneNode(true); c.setAttribute('aria-hidden', 'true'); track.appendChild(c);
      });
      row.appendChild(track);
      row.classList.add('m-pills--marquee');
      // same speed as home (~35px/s) whatever the row length
      track.style.animationDuration = Math.max(12, track.scrollWidth / 2 / 35) + 's';
    });
  }

  /* ---- 6. Overflow guard (dev only) ------------------------------------- */
  if (location.hostname === 'localhost' || location.hostname.indexOf('local.') === 0) {
    requestAnimationFrame(function () {
      var w = document.documentElement.clientWidth, bad = [];
      document.querySelectorAll('body *').forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.width > 0 && (r.right > w + 1 || r.left < -1) && !el.closest('.m-pills--marquee')) bad.push(el);
      });
      if (bad.length) console.warn('[overflow]', bad.length, 'element(s) baahar ja rahe hain:', bad);
      else console.info('[overflow] clean ✓');
    });
  }
})();
