/* Zentallio booking widget — "Book a walkthrough / call" end-to-end flow.
 * Two paths: an AI assistant (the Zentallio Knowledge Agent) and a Quick form wizard.
 * If /api/availability is unreachable the wizard falls back to local slots,
 * but a booking is only ever confirmed by /api/book. */
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
  var BOOK_FAIL = "We couldn't confirm your booking just now — please try again, or email info@zentallio.com.";
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
  // Never fake a confirmation: if the booking didn't go through, the visitor must see it.
  async function book(payload) {
    try {
      var r = await fetch("/api/book", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      var data = await r.json().catch(function () { return {}; });
      if (r.ok && data.ok) return data;
      return { ok: false, message: data.message || BOOK_FAIL };
    } catch (e) {
      return { ok: false, message: BOOK_FAIL };
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
      '<div class="zbook-card" role="dialog" aria-modal="true" aria-label="Ask Iris — Zentallio">' +
      '<button class="zbook-x" aria-label="Close">&times;</button>' +
      '<div class="zbook-head"><span class="zbook-dot"></span><b>Ask Iris</b></div>' +
      '<div class="zbook-tabs"><button data-tab="chat" class="on">Chat</button><button data-tab="form">Quick form</button></div>' +
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
  function isOpen() {
    return root && !root.hasAttribute("hidden");
  }
  function open(kind, opts) {
    build();
    opts = opts || {};
    // Two presentations: a docked, non-blocking chat "panel" (Ask Iris launcher)
    // and a centered "modal" (booking CTAs).
    var mode = opts.mode || "modal";
    state = { type: kind === "call" ? "call" : "walkthrough", chat: [] };
    if (opts.email && validEmail(opts.email)) state.email = opts.email;
    root.classList.toggle("zbook-panel", mode === "panel");
    root.removeAttribute("hidden");
    document.body.style.overflow = mode === "modal" ? "hidden" : ""; // only the modal locks scroll
    // panel → chat; modal → the Quick form (pre-filled if we have an email), unless told otherwise
    var tab = opts.tab || (mode === "panel" ? "chat" : state.email ? "form" : "form");
    root.querySelector('.zbook-tabs button[data-tab="' + tab + '"]').click();
  }
  function close() {
    if (!root) return;
    root.setAttribute("hidden", "");
    document.body.style.overflow = "";
  }

  /* ---------- assistant (AI) ----------
   * Iris = the Zentallio Knowledge Agent (answers from our knowledge base).
   * Docs: https://zentallio-agent.lucrumerp.com/docs — POST /api/chat/stream
   * {message, thread_id} → SSE events: thread, tool, token, sources, done | error.
   * The agent keeps the conversation server-side; we only hold its thread_id. */
  var AGENT_URL = window.ZEN_AGENT_URL || "https://zentallio-agent.lucrumerp.com";
  var THREAD_KEY = "zentallio_iris_thread";
  function getThread() {
    try {
      return localStorage.getItem(THREAD_KEY) || null;
    } catch (e) {
      return null;
    }
  }
  function setThread(id) {
    try {
      if (id) localStorage.setItem(THREAD_KEY, id);
    } catch (e) {}
  }
  // Stream one answer; onToken(fullTextSoFar). Resolves with the final text.
  async function askAgent(message, onToken) {
    var r = await fetch(AGENT_URL + "/api/chat/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: message, thread_id: getThread() }),
    });
    if (!r.ok || !r.body) throw new Error("http_" + r.status);
    var reader = r.body.getReader(), dec = new TextDecoder(), buf = "", text = "";
    for (;;) {
      var chunk = await reader.read();
      if (chunk.done) break;
      buf += dec.decode(chunk.value, { stream: true });
      var cut;
      while ((cut = buf.indexOf("\n\n")) >= 0) {
        var block = buf.slice(0, cut);
        buf = buf.slice(cut + 2);
        var ev = (block.match(/^event: *(.*)$/m) || [])[1];
        var raw = block.split("\n").filter(function (l) { return l.indexOf("data:") === 0; })
          .map(function (l) { return l.slice(5).replace(/^ /, ""); }).join("\n");
        var data;
        try { data = JSON.parse(raw); } catch (e) { continue; }
        if (ev === "thread" || ev === "done") setThread(data.thread_id);
        else if (ev === "token") { text += data.text || ""; onToken(text); }
        else if (ev === "error") throw new Error(data.message || "agent_error");
      }
    }
    if (!text) throw new Error("empty_answer");
    return text;
  }
  var CHIPS = ["What can Zentallio do for my business?", "Food & Beverage solutions", "Fashion retail solutions", "Book a walkthrough"];
  function wantsBooking(t) {
    return /^book a (walkthrough|call)\b/i.test(t);
  }
  function renderChat() {
    var b = body();
    b.innerHTML =
      '<div class="zbook-log"></div>' +
      '<div class="zbook-chips"></div>' +
      '<form class="zbook-input"><input type="text" maxlength="2000" placeholder="Ask Iris anything about Zentallio…" autocomplete="off"><button type="submit">Send</button></form>';
    var log = b.querySelector(".zbook-log");
    var chips = b.querySelector(".zbook-chips");
    var form = b.querySelector(".zbook-input");
    var input = form.querySelector("input");
    var sendBtn = form.querySelector("button");
    if (!state.chat.length) {
      addMsg(log, "bot", "Hi, I'm Iris — Zentallio's AI guide. Ask me anything about our sectors, solutions and how it works. Want to see it live? I can set up a walkthrough too.");
      CHIPS.forEach(function (c) {
        var chip = el("button", "zbook-chip", escapeHtml(c));
        chip.type = "button";
        chip.addEventListener("click", function () {
          send(c);
        });
        chips.appendChild(chip);
      });
    } else {
      chips.remove();
      state.chat.forEach(function (m) {
        addMsg(log, m.role === "assistant" ? "bot" : "me", m.content);
      });
    }
    var busy = false;
    async function send(t) {
      t = (t || "").trim();
      if (!t || busy) return;
      input.value = "";
      if (chips) chips.remove();
      if (wantsBooking(t)) {
        // The knowledge agent can't book — hand straight over to the Quick form.
        state.type = /call/i.test(t) ? "call" : "walkthrough";
        root.querySelector('.zbook-tabs button[data-tab="form"]').click();
        return;
      }
      addMsg(log, "me", t);
      state.chat.push({ role: "user", content: t });
      var reply = addMsg(log, "bot typing", "…");
      busy = true;
      sendBtn.disabled = true;
      try {
        var got = false;
        var onToken = function (sofar) {
          got = true;
          reply.classList.remove("typing");
          setMsg(reply, sofar);
          log.scrollTop = log.scrollHeight;
        };
        var answer;
        try {
          answer = await askAgent(t, onToken);
        } catch (e) {
          if (got) throw e;
          answer = await askAgent(t, onToken); // one retry if nothing arrived (flaky mobile networks)
        }
        setMsg(reply, answer);
        state.chat.push({ role: "assistant", content: answer });
      } catch (err) {
        reply.remove();
        state.chat.pop();
        addMsg(log, "bot", "I can't reach the live assistant right now — you can book directly on the quick form, or email info@zentallio.com.");
      }
      busy = false;
      sendBtn.disabled = false;
      input.focus();
    }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      send(input.value);
    });
    input.focus();
  }
  // Agent answers are light Markdown: [text](url), **bold**, "- " bullets, newlines.
  // Escape first, then re-enable only those — links limited to http(s).
  function renderRich(text) {
    return escapeHtml(text)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, function (_, label, url) {
        var same = url.indexOf("https://zentallio.com/") === 0;
        var href = same ? url.slice("https://zentallio.com".length) : url;
        return '<a href="' + href.replace(/"/g, "%22") + '"' + (same ? "" : ' target="_blank" rel="noopener"') + ">" + label + "</a>";
      })
      .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
      .replace(/^[-*] /gm, "• ")
      .replace(/\n/g, "<br>");
  }
  function setMsg(m, text) {
    m.innerHTML = m.classList.contains("bot") ? renderRich(text) : escapeHtml(text).replace(/\n/g, "<br>");
  }
  function addMsg(log, who, text) {
    var m = el("div", "zbook-msg " + who, "");
    setMsg(m, text);
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
      if (node.closest(".m-form")) return; // mobile lead forms submit themselves
      e.preventDefault();
      e.stopPropagation();
      // A booking CTA → the centered booking modal (Quick form), email carried over.
      open(kindFrom(node), { mode: "modal", tab: "form", email: emailNear(node) });
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
    // One launcher: Ask Iris. Booking is a capability inside (chat, the Quick
    // form tab, and a "Book a walkthrough" chip) — no separate booking icon.
    var b = el("button", "zbook-fab", '<span class="zbook-fab-ic" aria-hidden="true">✦</span><span class="zbook-fab-lbl">Ask Iris</span>');
    b.type = "button";
    b.setAttribute("aria-label", "Ask Iris — questions or book a walkthrough");
    b.addEventListener("click", function () {
      // toggle the docked chat panel
      if (isOpen() && root.classList.contains("zbook-panel")) close();
      else open("walkthrough", { mode: "panel", tab: "chat" });
    });
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

  /* ---------- retire the legacy "Ask Zen" bot ----------
   * The old solution pages define toggleZen/askZen/bookCall for an on-page
   * scripted bot whose launcher is now hidden. booking.js is deferred, so it
   * runs after those definitions — reroute every legacy entry point to the one
   * global Iris so no old trigger is left dangling. */
  ["toggleZen", "askZen", "openZen", "askAbout"].forEach(function (fn) {
    window[fn] = function () {
      open("walkthrough", { mode: "panel", tab: "chat" }); // "ask" → chat panel
      return false;
    };
  });
  window.bookCall = function () {
    open("call", { mode: "modal", tab: "form" }); // "book" → booking modal
    return false;
  };
})();
