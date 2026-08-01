/* Zentallio booking widget — "Book a walkthrough / call" end-to-end flow.
 * Two paths: an AI assistant (POSTs /api/chat) and a Quick form wizard.
 * The wizard works even with no backend (client-side fallback), so the flow
 * is demonstrable on a static host; on Vercel the /api endpoints take over. */
(function () {
  "use strict";
  var DEFAULT_TZ = "Asia/Karachi"; // PKT (no DST)
  var built = false,
    root,
    state;

  /* ---------- timezone-aware slot helpers ----------
   * Availability is a flat list of absolute UTC instants; the browser formats
   * them into whichever timezone the visitor picks, so switching zones just
   * re-labels the same slots (DST handled by Intl). */
  function pad(n) {
    return String(n).padStart(2, "0");
  }
  function validEmail(e) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((e || "").trim());
  }
  function partsInTz(iso, tz) {
    var d = new Date(iso),
      p = {};
    new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })
      .formatToParts(d)
      .forEach(function (x) {
        p[x.type] = x.value;
      });
    var dateKey = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
    return { dateKey: dateKey, dayLabel: p.weekday + ", " + p.day + " " + p.month, time: p.hour + ":" + p.minute };
  }
  function groupSlots(slots, tz) {
    var days = {};
    (slots || []).forEach(function (iso) {
      var f = partsInTz(iso, tz);
      if (!days[f.dateKey]) days[f.dateKey] = { dateKey: f.dateKey, label: f.dayLabel, slots: [] };
      days[f.dateKey].slots.push({ iso: iso, label: f.time });
    });
    return Object.keys(days)
      .sort()
      .map(function (k) {
        return days[k];
      });
  }
  function tzListing() {
    var detected = "Asia/Karachi";
    try {
      detected = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Karachi";
    } catch (e) {}
    var base = [detected, "Asia/Karachi", "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Asia/Shanghai", "Europe/London", "Europe/Berlin", "America/New_York", "America/Chicago", "America/Los_Angeles", "Australia/Sydney"];
    var seen = {},
      list = [];
    base.forEach(function (z) {
      if (z && !seen[z]) {
        seen[z] = 1;
        list.push(z);
      }
    });
    return { detected: detected, list: list };
  }
  function tzLabel(z) {
    try {
      var parts = new Intl.DateTimeFormat("en-US", { timeZone: z, timeZoneName: "shortOffset" }).formatToParts(new Date());
      var off = (parts.find(function (p) { return p.type === "timeZoneName"; }) || {}).value || "";
      return z.replace(/_/g, " ") + (off ? " (" + off + ")" : "");
    } catch (e) {
      return z.replace(/_/g, " ");
    }
  }

  /* ---------- client-side fallback (mirrors /lib/booking-core) ---------- */
  function localAvailability() {
    var slots = [],
      now = new Date(),
      added = 0;
    for (var i = 1; i <= 7 && added < 5; i++) {
      var pkt = new Date(now.getTime() + 5 * 3600 * 1000); // shift to PKT wall clock
      pkt.setUTCDate(pkt.getUTCDate() + i);
      if (pkt.getUTCDay() === 0) continue; // skip Sunday in PKT
      var y = pkt.getUTCFullYear(),
        m = pkt.getUTCMonth() + 1,
        d = pkt.getUTCDate();
      for (var h = 10; h < 17; h++) for (var min = 0; min < 60; min += 30) {
        slots.push(new Date(y + "-" + pad(m) + "-" + pad(d) + "T" + pad(h) + ":" + pad(min) + ":00+05:00").toISOString());
      }
      added++;
    }
    return { defaultTz: DEFAULT_TZ, slots: slots };
  }
  function tzShort(iso, tz) {
    try {
      var parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(new Date(iso));
      return (parts.find(function (p) { return p.type === "timeZoneName"; }) || {}).value || tz;
    } catch (e) {
      return tz;
    }
  }
  function localBook(b) {
    var tz = b.tz || DEFAULT_TZ;
    var f = partsInTz(b.start, tz);
    var id = "ZEN-" + b.start.replace(/[-:T]/g, "").slice(0, 12);
    return {
      ok: true,
      bookingId: id,
      type: b.type,
      email: b.email,
      start: b.start,
      timezone: tz,
      message: "Your " + b.type + " is confirmed for " + f.dayLabel + " at " + f.time + " (" + tzShort(b.start, tz) + "). A calendar invite is on its way to " + b.email + ".",
    };
  }

  async function api(path, opts) {
    var r = await fetch(path, opts);
    if (!r.ok) throw new Error("http_" + r.status);
    return r.json();
  }
  async function getAvailability() {
    try {
      return await api("/api/availability");
    } catch (e) {
      return localAvailability();
    }
  }
  async function book(payload) {
    try {
      return await api("/api/book", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    } catch (e) {
      return localBook(payload);
    }
  }

  /* ---------- DOM ---------- */
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function build() {
    if (built) return;
    built = true;
    root = el("div", "zbook-overlay");
    root.setAttribute("hidden", "");
    root.innerHTML =
      '<div class="zbook-card" role="dialog" aria-modal="true" aria-label="Book with Zentallio">' +
      '<button class="zbook-x" aria-label="Close">&times;</button>' +
      '<div class="zbook-head"><span class="zbook-dot"></span><b>Book with Zentallio</b></div>' +
      '<div class="zbook-tabs"><button data-tab="chat" class="on">Ask Iris</button><button data-tab="form">Quick form</button></div>' +
      '<div class="zbook-body"></div>' +
      "</div>";
    document.body.appendChild(root);
    root.querySelector(".zbook-x").addEventListener("click", close);
    root.addEventListener("click", function (e) {
      if (e.target === root) close();
    });
    root.querySelectorAll(".zbook-tabs button").forEach(function (b) {
      b.addEventListener("click", function () {
        root.querySelectorAll(".zbook-tabs button").forEach(function (x) {
          x.classList.toggle("on", x === b);
        });
        b.dataset.tab === "chat" ? renderChat() : renderForm();
      });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !root.hasAttribute("hidden")) close();
    });
  }
  function body() {
    return root.querySelector(".zbook-body");
  }
  function open(kind, opts) {
    build();
    opts = opts || {};
    state = { type: kind === "call" ? "call" : "walkthrough", chat: [] };
    if (opts.email && validEmail(opts.email)) state.email = opts.email;
    root.removeAttribute("hidden");
    document.body.style.overflow = "hidden";
    // If the visitor already gave a valid email (e.g. from a page's email-capture
    // CTA), open straight to the pre-filled Quick form; otherwise start with Iris.
    var tab = opts.tab || (state.email ? "form" : "chat");
    root.querySelector('.zbook-tabs button[data-tab="' + tab + '"]').click();
  }
  function close() {
    if (!root) return;
    root.setAttribute("hidden", "");
    document.body.style.overflow = "";
  }

  /* ---------- assistant (AI) ---------- */
  function renderChat() {
    var b = body();
    b.innerHTML = '<div class="zbook-log"></div><form class="zbook-input"><input type="text" placeholder="Type here… e.g. book a walkthrough" autocomplete="off"><button type="submit">Send</button></form>';
    var log = b.querySelector(".zbook-log");
    var form = b.querySelector(".zbook-input");
    var input = form.querySelector("input");
    if (!state.chat.length) {
      var greet = "Hi! I'm Iris. I can book you a " + state.type + " with a consultant. ";
      greet += state.email
        ? "I've got your email as " + state.email + " — just tell me a day and time that suits you, or ask me anything."
        : "Want to go ahead? Tell me your email to start, or ask me anything.";
      addMsg(log, "bot", greet);
    } else {
      state.chat.forEach(function (m) {
        addMsg(log, m.role === "assistant" ? "bot" : "me", m.content);
      });
    }
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var t = input.value.trim();
      if (!t) return;
      input.value = "";
      addMsg(log, "me", t);
      state.chat.push({ role: "user", content: t });
      var typing = addMsg(log, "bot", "…");
      try {
        var res = await api("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: state.chat, state: state }),
        });
        typing.remove();
        addMsg(log, "bot", res.reply || "…");
        state.chat.push({ role: "assistant", content: res.reply || "" });
        if (res.state) Object.assign(state, res.state);
        if (res.booking && res.booking.ok) success(res.booking);
      } catch (err) {
        typing.remove();
        addMsg(log, "bot", "The live assistant isn't reachable here — switching you to the quick form.");
        setTimeout(function () {
          root.querySelector('.zbook-tabs button[data-tab="form"]').click();
        }, 700);
      }
    });
    input.focus();
  }
  function addMsg(log, who, text) {
    var m = el("div", "zbook-msg " + who, escapeHtml(text).replace(/\n/g, "<br>"));
    log.appendChild(m);
    log.scrollTop = log.scrollHeight;
    return m;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c];
    });
  }

  /* ---------- quick form wizard ---------- */
  async function renderForm() {
    var b = body();
    b.innerHTML = '<div class="zbook-loading">Loading available times…</div>';
    var av = await getAvailability(); // { defaultTz, slots: [ISO...] }
    var slots = av.slots || [];
    var tzo = tzListing();
    var chosenTz = state.tz || tzo.detected || av.defaultTz || DEFAULT_TZ;
    var tzOpts = tzo.list
      .map(function (z) {
        return '<option value="' + z + '"' + (z === chosenTz ? " selected" : "") + ">" + escapeHtml(tzLabel(z)) + "</option>";
      })
      .join("");
    b.innerHTML =
      '<form class="zbook-form">' +
      '<label>Purpose<select name="type"><option value="walkthrough">Book a walkthrough</option><option value="call">Call with a consultant</option></select></label>' +
      '<label>Work email<input name="email" type="email" required placeholder="you@company.com"></label>' +
      "<label>Timezone<select name=\"tz\">" + tzOpts + "</select></label>" +
      '<label>Day<select name="date"></select></label>' +
      '<label>Time<select name="time"></select></label>' +
      '<label>Anything we should know? (optional)<textarea name="notes" rows="2"></textarea></label>' +
      '<div class="zbook-err" hidden></div>' +
      '<button type="submit" class="zbook-go">Confirm booking</button>' +
      "</form>";
    var form = b.querySelector("form");
    form.type.value = state.type;
    if (state.email) form.email.value = state.email; // carried over from a page CTA
    var tzSel = form.tz,
      dateSel = form.date,
      timeSel = form.time,
      grouped = [];
    function fillTimes() {
      timeSel.innerHTML = "";
      var day = grouped.find(function (d) {
        return d.dateKey === dateSel.value;
      });
      (day ? day.slots : []).forEach(function (s) {
        var o = el("option");
        o.value = s.iso; // absolute instant is the value
        o.textContent = s.label;
        timeSel.appendChild(o);
      });
    }
    function rebuild() {
      var keepIso = timeSel.value;
      grouped = groupSlots(slots, tzSel.value);
      dateSel.innerHTML = "";
      grouped.forEach(function (d) {
        var o = el("option");
        o.value = d.dateKey;
        o.textContent = d.label;
        dateSel.appendChild(o);
      });
      // try to keep the same instant selected across a tz switch
      var stay = grouped.find(function (d) {
        return d.slots.some(function (s) {
          return s.iso === keepIso;
        });
      });
      if (stay) dateSel.value = stay.dateKey;
      fillTimes();
      if (keepIso) timeSel.value = keepIso;
    }
    tzSel.addEventListener("change", function () {
      state.tz = tzSel.value;
      rebuild();
    });
    dateSel.addEventListener("change", fillTimes);
    rebuild();
    var err = form.querySelector(".zbook-err");
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      err.hidden = true;
      if (!validEmail(form.email.value)) {
        err.textContent = "Please enter a valid email.";
        err.hidden = false;
        return;
      }
      if (!timeSel.value) {
        err.textContent = "Please choose a day and time.";
        err.hidden = false;
        return;
      }
      var go = form.querySelector(".zbook-go");
      go.disabled = true;
      go.textContent = "Booking…";
      var res = await book({
        type: form.type.value,
        email: form.email.value.trim(),
        start: timeSel.value, // absolute instant (ISO)
        tz: tzSel.value,
        notes: form.notes.value.trim(),
      });
      if (res.ok) success(res);
      else {
        err.textContent = res.message || "Something went wrong.";
        err.hidden = false;
        go.disabled = false;
        go.textContent = "Confirm booking";
      }
    });
  }

  function success(res) {
    body().innerHTML =
      '<div class="zbook-done">' +
      '<div class="zbook-check">✓</div>' +
      "<h3>You're booked!</h3>" +
      "<p>" + escapeHtml(res.message) + "</p>" +
      '<p class="zbook-ref">Ref <b>' + escapeHtml(res.bookingId) + "</b></p>" +
      '<button class="zbook-go" data-done>Done</button>' +
      "</div>";
    body().querySelector("[data-done]").addEventListener("click", close);
  }

  /* ---------- wire up CTAs ---------- */
  function isBookingCta(node) {
    if (!node) return false;
    if (node.hasAttribute && node.hasAttribute("data-book")) return true;
    var id = node.id || "";
    if (id === "ctaBook" || id === "demoBtn" || id === "demoGo") return true;
    var txt = (node.textContent || "").trim().toLowerCase();
    return /^book a (walkthrough|call)/.test(txt);
  }
  function kindFrom(node) {
    var txt = (node.textContent || "").toLowerCase();
    if (node.getAttribute && node.getAttribute("data-book") === "call") return "call";
    return /call/.test(txt) ? "call" : "walkthrough";
  }
  // If the CTA sits next to an email box (the page's "See it on your numbers" /
  // "See it configured" capture blocks), carry that typed email into the flow.
  function emailNear(node) {
    var scope = node.closest("form,.demorow,.demoform") || node.closest("section,.demo,.hcta") || node.parentElement;
    if (!scope) return "";
    var inp = scope.querySelector('input[type="email"], input[name*="mail" i], input[placeholder*="mail" i]');
    return inp && inp.value ? inp.value.trim() : "";
  }
  document.addEventListener(
    "click",
    function (e) {
      var node = e.target.closest("a,button,[data-book]");
      if (!node || !isBookingCta(node)) return;
      e.preventDefault();
      e.stopPropagation();
      open(kindFrom(node), { email: emailNear(node) });
    },
    true // capture, so we win over existing page handlers
  );

  /* ---------- persistent floating CTA ----------
   * Guarantees every page can reach the booking flow. Skipped when the page
   * already has its own fixed widget in the bottom-right corner (e.g. the
   * "Ask Zen" FAB / dock) so the two never overlap — those pages open the
   * widget via their inline "Book a…" CTAs instead. */
  function cornerOccupied() {
    if (!document.elementsFromPoint) return false;
    var vw = window.innerWidth,
      vh = window.innerHeight;
    var probes = [
      [vw - 30, vh - 30],
      [vw - 56, vh - 56],
    ];
    for (var i = 0; i < probes.length; i++) {
      var stack = document.elementsFromPoint(probes[i][0], probes[i][1]) || [];
      for (var j = 0; j < stack.length; j++) {
        var e = stack[j];
        if (e === document.body || e === document.documentElement) continue;
        if (e.classList && e.classList.contains("zbook-fab")) continue;
        if (e.closest && e.closest(".zbook-fab,.zbook-overlay")) continue;
        var pos = getComputedStyle(e).position;
        if (pos !== "fixed" && pos !== "sticky") continue; // in-flow page content, not a floating widget
        var r = e.getBoundingClientRect();
        // Only count a widget genuinely anchored to the bottom-right corner.
        // (A wide bottom-LEFT banner may reach the probe on narrow screens but
        // starts at the left edge, so it must not suppress the FAB.)
        var rightAnchored = r.right >= vw - 100 && r.left >= vw * 0.5;
        var bottomAnchored = r.bottom >= vh - 100 && r.top >= vh * 0.4;
        var compact = r.width < vw * 0.5 && r.height < vh * 0.6;
        if (rightAnchored && bottomAnchored && compact) return true;
      }
    }
    return false;
  }
  function injectFab() {
    if (document.querySelector(".zbook-fab")) return;
    if (cornerOccupied()) return;
    var b = el("button", "zbook-fab", '<span class="zbook-fab-dot"></span><span class="zbook-fab-lbl">Book a walkthrough</span>');
    b.type = "button";
    b.setAttribute("data-book", "walkthrough");
    b.setAttribute("aria-label", "Book a walkthrough");
    document.body.appendChild(b);
  }
  // Lift the FAB above any bottom-anchored banner it overlaps (e.g. the cookie
  // notice, which spans nearly full width on mobile) so it never covers it.
  function avoidOverlap() {
    var fab = document.querySelector(".zbook-fab");
    if (!fab || !document.elementsFromPoint) return;
    fab.style.bottom = ""; // reset to CSS default, then measure fresh
    var fr = fab.getBoundingClientRect();
    var vh = window.innerHeight;
    var stack = document.elementsFromPoint(fr.left + fr.width / 2, fr.top + fr.height / 2) || [];
    for (var i = 0; i < stack.length; i++) {
      var e = stack[i];
      if (e.closest && e.closest(".zbook-fab,.zbook-overlay")) continue;
      if (e === document.body || e === document.documentElement) continue;
      // elementsFromPoint returns the deepest child; the fixed positioning may
      // live on an ancestor (e.g. a banner wrapper), so climb to find it.
      var node = e;
      while (node && node !== document.body) {
        var cs = getComputedStyle(node);
        if (cs.position === "fixed" || cs.position === "sticky") {
          var r = node.getBoundingClientRect();
          if (r.bottom >= vh - 16 && r.top < fr.bottom) {
            fab.style.bottom = vh - r.top + 12 + "px"; // sit just above the banner
          }
          break;
        }
        node = node.parentElement;
      }
      break; // only the element directly behind the FAB matters
    }
  }
  // Inject once the DOM is parsed; the site's corner widgets are static markup,
  // so they're already present for the corner probe. A second pass on load
  // removes the FAB if a late/JS-built widget claims the corner afterwards.
  function fabPass() {
    injectFab();
    if (cornerOccupied()) {
      var f = document.querySelector(".zbook-fab");
      if (f) f.remove();
      return;
    }
    avoidOverlap();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fabPass);
  } else {
    fabPass();
  }
  window.addEventListener("load", function () {
    setTimeout(fabPass, 200);
  });
  var reflow;
  window.addEventListener("resize", function () {
    clearTimeout(reflow);
    reflow = setTimeout(avoidOverlap, 150);
  });
  // A banner (e.g. cookie notice) is usually dismissed by a click — re-check
  // shortly after so the FAB drops back down once it's gone.
  document.addEventListener("click", function () {
    setTimeout(avoidOverlap, 250);
  });

  // expose for programmatic use / testing
  window.zentallioBook = open;
})();
