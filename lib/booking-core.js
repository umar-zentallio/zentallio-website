/**
 * Booking core — shared logic for the "Book a walkthrough / call" flow.
 *
 * Availability is a flat list of absolute UTC instants; the client (or Cal.com)
 * formats them into whatever timezone the visitor picks, so changing zone just
 * re-labels the same slots. Business hours are defined in PKT (Asia/Karachi,
 * fixed UTC+5, no DST), which makes generating the instants trivial.
 *
 * Two modes, chosen by env:
 *   • LIVE  — CALCOM_API_KEY (+ event id) set → availability + bookings via
 *             Cal.com, which also sends the invite/email and returns the link.
 *   • MOCK  — no key → deterministic instants + booking, so it runs with no
 *             accounts. A live failure degrades to mock for availability and
 *             is surfaced honestly for a booking.
 */

const TZ_DEFAULT = "Asia/Karachi"; // PKT, no DST
const BUSINESS_START = 10; // 10:00 PKT
const BUSINESS_END = 17; // 17:00 PKT (last slot 16:30)
const SLOT_MINUTES = 30;
const DAYS_AHEAD = 7;
const MAX_DAYS = 5;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ---------------------------------------------------------------- Cal.com --- */
const CAL_BASE = "https://api.cal.com/v2";
const CAL_SLOTS_VERSION = "2024-09-04";
const CAL_BOOKINGS_VERSION = "2024-08-13";
const DEFAULT_EVENT_ID = "6503154"; // Zentallio walkthrough/call event type

function calKey() {
  return process.env.CALCOM_API_KEY || "";
}
function calEventId(kind) {
  const specific = kind === "call" ? process.env.CALCOM_EVENT_ID_CALL : process.env.CALCOM_EVENT_ID_WALKTHROUGH;
  return specific || process.env.CALCOM_EVENT_TYPE_ID || DEFAULT_EVENT_ID;
}
function calEnabled(kind) {
  return Boolean(calKey() && calEventId(kind));
}
function calHeaders(version) {
  return { "content-type": "application/json", Authorization: "Bearer " + calKey(), "cal-api-version": version };
}

/* ---------------------------------------------------------------- helpers --- */
function isValidEmail(email) {
  return typeof email === "string" && EMAIL_RE.test(email.trim());
}
function pad(n) {
  return String(n).padStart(2, "0");
}
function validTz(tz) {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch (e) {
    return false;
  }
}
// Format an absolute instant into a target timezone.
function formatSlot(iso, tz) {
  const d = new Date(iso),
    p = {};
  new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })
    .formatToParts(d)
    .forEach((x) => (p[x.type] = x.value));
  const dateKey = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return { dateKey, dayLabel: `${p.weekday}, ${p.day} ${p.month}`, time: `${p.hour}:${p.minute}` };
}
function tzAbbr(iso, tz) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(new Date(iso));
    const z = parts.find((x) => x.type === "timeZoneName");
    return z ? z.value : tz;
  } catch (e) {
    return tz;
  }
}

/* ------------------------------------------------------------- availability --- */
function businessInstants(now) {
  const out = [];
  let added = 0;
  for (let i = 1; i <= DAYS_AHEAD && added < MAX_DAYS; i++) {
    const pkt = new Date(now.getTime() + 5 * 3600 * 1000); // PKT wall clock
    pkt.setUTCDate(pkt.getUTCDate() + i);
    if (pkt.getUTCDay() === 0) continue; // skip Sunday in PKT
    const y = pkt.getUTCFullYear(),
      m = pkt.getUTCMonth() + 1,
      d = pkt.getUTCDate();
    for (let h = BUSINESS_START; h < BUSINESS_END; h++) {
      for (let min = 0; min < 60; min += SLOT_MINUTES) {
        out.push(new Date(`${y}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(min)}:00+05:00`).toISOString());
      }
    }
    added++;
  }
  return out;
}

/**
 * Cal.com slots: GET /v2/slots?eventTypeId&start&end&timeZone (v2024-09-04)
 * Response: { data: { "YYYY-MM-DD": [ { start: ISO }, … ] } }.
 * We keep only the absolute instant of each slot; the client re-labels by tz.
 */
async function fetchCalSlots(now) {
  const id = calEventId("walkthrough");
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() + 1);
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + DAYS_AHEAD);
  const qs = new URLSearchParams({
    eventTypeId: String(id),
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    timeZone: TZ_DEFAULT,
  });
  const r = await fetch(`${CAL_BASE}/slots?${qs}`, { headers: calHeaders(CAL_SLOTS_VERSION) });
  if (!r.ok) throw new Error("cal_slots_" + r.status);
  const json = await r.json();
  const data = (json && json.data) || {};
  const instants = [];
  const days = Object.keys(data).sort().slice(0, MAX_DAYS);
  for (const date of days) {
    (data[date] || []).forEach((s) => {
      const iso = typeof s === "string" ? s : s.start || s.time;
      if (iso) instants.push(new Date(iso).toISOString());
    });
  }
  if (!instants.length) throw new Error("cal_slots_empty");
  return { defaultTz: TZ_DEFAULT, slots: instants };
}

async function getAvailability(now = new Date()) {
  if (calEnabled("walkthrough")) {
    try {
      return await fetchCalSlots(now);
    } catch (e) {
      console.error("[booking] Cal.com slots failed, using fallback:", e && e.message);
    }
  }
  return { defaultTz: TZ_DEFAULT, slots: businessInstants(now) };
}

/* ---------------------------------------------------------- confirmation ---- */
// LIVE mode: Cal.com sends the email itself. This is only used in MOCK mode.
function sendConfirmationEmail({ email, start, tz, type }) {
  const f = formatSlot(start, tz);
  return {
    sent: false,
    mock: true,
    to: email,
    subject: `Your Zentallio ${type} is confirmed — ${f.dayLabel} ${f.time} (${tzAbbr(start, tz)})`,
  };
}

/* -------------------------------------------------------------- booking ----- */
function bookingRef(start) {
  return "ZEN-" + String(start).replace(/[-:T]/g, "").slice(0, 12); // YYYYMMDDHHmm (UTC)
}

function mockBooking({ start, tz, email, type, name, notes }) {
  const f = formatSlot(start, tz);
  const id = bookingRef(start);
  return {
    ok: true,
    bookingId: id,
    type,
    name: name || null,
    email,
    start,
    date: f.dateKey,
    time: f.time,
    timezone: tz,
    notes: notes || null,
    meetingUrl: "https://meet.zentallio.com/" + id,
    emailPreview: sendConfirmationEmail({ email, start, tz, type }),
    message: `Your ${type} is confirmed for ${f.dayLabel} at ${f.time} (${tzAbbr(start, tz)}). A calendar invite is on its way to ${email}.`,
  };
}

/**
 * Cal.com booking: POST /v2/bookings (v2024-08-13)
 *   { start: <UTC ISO>, eventTypeId, attendee: { name, email, timeZone, language } }
 * Cal.com emails both parties in the attendee's timezone and returns the link.
 */
async function createCalBooking({ start, tz, email, type, name, notes }) {
  const body = {
    start: new Date(start).toISOString(),
    eventTypeId: Number(calEventId(type)),
    attendee: { name: name || email.split("@")[0], email, timeZone: tz, language: "en" },
    metadata: { source: "zentallio-website", notes: (notes || "").slice(0, 480) },
  };
  const r = await fetch(`${CAL_BASE}/bookings`, { method: "POST", headers: calHeaders(CAL_BOOKINGS_VERSION), body: JSON.stringify(body) });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("cal_book_" + r.status + "_" + JSON.stringify(json).slice(0, 200));
  const d = (json && json.data) || {};
  const ref = d.uid || d.id || bookingRef(start);
  const meetingUrl = d.meetingUrl || d.videoCallUrl || d.location || (d.locations && d.locations[0] && d.locations[0].link) || null;
  const f = formatSlot(start, tz);
  return {
    ok: true,
    bookingId: String(ref),
    type,
    name: name || null,
    email,
    start,
    date: f.dateKey,
    time: f.time,
    timezone: tz,
    notes: notes || null,
    meetingUrl,
    message: `Your ${type} is confirmed for ${f.dayLabel} at ${f.time} (${tzAbbr(start, tz)}). Cal.com has emailed a calendar invite${meetingUrl ? " and meeting link" : ""} to ${email}.`,
  };
}

async function createBooking({ start, tz, email, type, name, notes }) {
  if (!isValidEmail(email)) {
    return { ok: false, error: "invalid_email", message: "Please provide a valid email address." };
  }
  if (!start || isNaN(Date.parse(start))) {
    return { ok: false, error: "missing_slot", message: "Please choose a day and time." };
  }
  const zone = validTz(tz) ? tz : TZ_DEFAULT;
  const kind = type === "call" ? "call" : "walkthrough";
  if (calEnabled(kind)) {
    try {
      return await createCalBooking({ start, tz: zone, email, type: kind, name, notes });
    } catch (e) {
      console.error("[booking] Cal.com booking failed:", e && e.message);
      return { ok: false, error: "scheduler_error", message: "We couldn't confirm that slot just now — please try another time, or email hello@zentallio.com." };
    }
  }
  return mockBooking({ start, tz: zone, email, type: kind, name, notes });
}

module.exports = { getAvailability, createBooking, sendConfirmationEmail, isValidEmail, formatSlot, TZ_DEFAULT };
