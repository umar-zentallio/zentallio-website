/* Ask Iris card — tap a question, Iris reasons L1 -> L2 -> L3, then answers with a chart and the move to approve */
(function () {
  var root = document.getElementById('mAsk');
  if (!root) return;
  var chips = [].slice.call(root.querySelectorAll('.m-az-chip'));
  var qEl = document.getElementById('mAzQ'), think = document.getElementById('mAzThink'), ans = document.getElementById('mAzAns');
  var layers = [].slice.call(think.children);
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // A page can bring its own questions (window.M_ASK_QA, loaded before this
  // file); otherwise these F&B ones -- short versions of the desktop Ask Iris
  // answers, same order as the desktop chips.
  var pct = function (v) { return v + '%'; };
  var QA = window.M_ASK_QA || [
    { q: 'Android orders in the last hour?',
      a: '<b>3,180</b> — <em class="up">▲ 18%</em>, your busiest channel right now.',
      unit: 'Orders · last hour', max: 3400, fmt: function (v) { return v.toLocaleString(); },
      bars: [{ l: 'Android', v: 3180, c: 'hi' }, { l: 'iOS', v: 2040 }, { l: 'Web', v: 1160 }] },
    { q: 'Which market is over on food cost?',
      a: '<b>Austria</b> is at <em class="am">32%</em> — <em class="bad">2 pts over</em> plan, from evening portion drift.',
      unit: 'Food cost · plan 30%', max: 36, plan: 30, fmt: pct,
      bars: [{ l: 'Austria', v: 32, c: 'hot' }, { l: 'France', v: 30 }, { l: 'Belgium', v: 29 }],
      act: { d: 'Portion test on 3 items', m: '+1.8 pts margin', b: 'Approve' } },
    { q: 'How is delivery margin trending?',
      a: 'Up to <em class="up">14.6%</em> by Sunday — <b>+1.8 pts</b> as route-batching cut commission.',
      unit: 'Delivery margin · plan 13%', min: 12, max: 15, plan: 13, fmt: pct,
      bars: [{ l: 'Mon', v: 12.8 }, { l: 'Thu', v: 13.7 }, { l: 'Sun', v: 14.6, c: 'hi' }],
      act: { d: 'Route-batching in all markets', m: '+0.9 pt margin', b: 'Approve' } },
    { q: 'Build the weekly performance report.',
      a: 'Done — revenue <em class="up">+9.4%</em>, with delivery growing fastest.',
      kpis: [{ l: 'Revenue', v: '$12.4M', d: '+9.4%' }, { l: 'Orders', v: '894K', d: '+6.1%' },
             { l: 'Avg ticket', v: '$13.87', d: '+3.1%' }, { l: 'Net margin', v: '6.8%', d: '+0.5 pt' }],
      act: { d: 'Email it every Monday', m: 'PDF + live link', b: 'Schedule' } },
    { q: 'Do we need more chicken in Austria?',
      a: '<b>Yes</b> — only <em class="bad">1.6 days</em> left, with the weekend <em class="am">+18%</em>.',
      unit: 'Days of cover', max: 5, fmt: function (v) { return v + 'd'; },
      bars: [{ l: 'Chicken', v: 1.6, c: 'hot' }, { l: 'Buns', v: 3.2 }, { l: 'Fries', v: 4.1 }],
      act: { d: 'Order 60 kg chicken', m: 'Arrives Thursday', b: 'Order' } }
  ];

  var gen = 0;
  function later(fn, ms, g) { setTimeout(function () { if (g === gen) fn(); }, reduce ? 0 : ms); }
  function replay(el) { el.classList.remove('in'); void el.offsetWidth; el.classList.add('in'); }

  function answerHTML(o) {
    var h = '<p class="m-az-text">' + o.a + '</p>';
    if (o.kpis) {
      h += '<div class="m-az-kpis">';
      o.kpis.forEach(function (k) { h += '<span><small>' + k.l + '</small><b>' + k.v + '</b>' + (k.d ? '<em>' + k.d + '</em>' : '') + '</span>'; });
      h += '</div>';
    } else {
      h += '<div class="m-az-bars' + (o.wide ? ' is-wide' : '') + '"><span class="m-az-unit">' + o.unit + '</span>';
      var lo = o.min || 0, w = function (v) { return (v - lo) / (o.max - lo) * 100; };  // bars can start above zero
      o.bars.forEach(function (b) {
        var plan = o.plan ? '<span class="m-az-plan" style="left:' + w(o.plan) + '%"></span>' : '';
        h += '<div class="m-az-row ' + (b.c || '') + '"><span>' + b.l + '</span><span class="m-az-track"><i data-w="' +
          w(b.v) + '"></i>' + plan + '</span><b>' + o.fmt(b.v) + '</b></div>';
      });
      h += '</div>';
    }
    if (o.act) h += '<div class="m-az-act" hidden><strong>' + o.act.d + '</strong><span>' + o.act.m + '</span><button type="button" class="m-az-ok">' + o.act.b + '</button></div>';
    return h;
  }

  function show(n) {
    var g = ++gen, o = QA[n];
    chips.forEach(function (c, k) { c.classList.toggle('is-on', k === n); c.setAttribute('aria-selected', k === n); });
    qEl.textContent = o.q; replay(qEl);
    layers.forEach(function (l) { l.classList.remove('is-on'); });
    ans.style.visibility = 'hidden';
    layers.forEach(function (l, k) { later(function () { l.classList.add('is-on'); }, 350 + k * 320, g); });
    later(function () {
      ans.innerHTML = answerHTML(o); ans.style.visibility = ''; replay(ans);
      later(function () { [].forEach.call(ans.querySelectorAll('.m-az-track i'), function (i) { i.style.width = i.dataset.w + '%'; }); }, 80, g);
      later(function () { var a = ans.querySelector('.m-az-act'); if (a) { a.hidden = false; replay(a); } }, 700, g);
    }, 1400, g);
  }

  chips.forEach(function (c, k) { c.addEventListener('click', function () { show(k); }); });
  ans.addEventListener('click', function (e) {
    var b = e.target.closest('.m-az-ok');
    if (b && !b.classList.contains('done')) { b.classList.add('done'); b.textContent = 'Done ✓'; }
  });

  // play the first question once the card scrolls into view
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es, ob) {
      if (es[0].isIntersecting) { ob.disconnect(); show(0); }
    }, { threshold: 0.35 }).observe(root);
  } else show(0);
})();
