/* Resources (mobile): deck tabs, Iris-picks rail dots, and the "notify me" form */
(function () {
  // ---- deck tabs (F&B / Fashion). Without JS both panels simply show.
  var tabs = [].slice.call(document.querySelectorAll('.m-rs-tab'));
  function select(tab) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { select(t); });
    t.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      var next = tabs[(i + d + tabs.length) % tabs.length];
      select(next); next.focus();
    });
  });
  if (tabs.length) select(tabs[0]);

  // ---- picks rail: one dot per card, the card nearest the left edge is "on"
  var rail = document.getElementById('mRsRail'), dots = document.getElementById('mRsDots');
  if (rail && dots) {
    var cards = [].slice.call(rail.children);
    cards.forEach(function () { dots.appendChild(document.createElement('i')); });
    var pips = [].slice.call(dots.children);
    var cur = -1;
    function sync() {
      var n = 0, best = Infinity, left = rail.getBoundingClientRect().left;
      cards.forEach(function (c, k) {
        var d = Math.abs(c.getBoundingClientRect().left - left);
        if (d < best) { best = d; n = k; }
      });
      if (n === cur) return;
      cur = n;
      pips.forEach(function (p, k) { p.classList.toggle('is-on', k === n); });
    }
    rail.addEventListener('scroll', function () { requestAnimationFrame(sync); }, { passive: true });
    sync();
  }

  // ---- notify me (same endpoint and messages as the desktop page)
  var form = document.getElementById('mRsForm');
  if (!form) return;
  var input = document.getElementById('mRsEmail'), btn = document.getElementById('mRsBtn'), msg = document.getElementById('mRsMsg');
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function show(text, kind) { msg.textContent = text; msg.className = 'm-rs-msg ' + kind; msg.hidden = false; }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = (input.value || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) { show('Please enter a valid email address.', 'err'); input.focus(); return; }
    var label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Sending…'; msg.hidden = true;
    function fail(text) { btn.disabled = false; btn.textContent = label; show(text, 'err'); }

    fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email })
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (res.ok && res.j && res.j.ok) {
          form.hidden = true;
          show("You're on the list — new resources will land in your inbox first.", 'ok');
        } else fail('Something went wrong — please try again in a moment.');
      })
      .catch(function () { fail("Couldn't reach the server — please try again."); });
  });
})();
