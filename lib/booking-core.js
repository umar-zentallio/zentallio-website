/**
 * Booking core — shared logic for the "Book a walkthrough / call" flow.
 *
 * Two modes, chosen automatically by which env vars are present:
 *
 *  • LIVE  — when CALCOM_API_KEY (+ an event-type id) is set, availability and
 *            bookings go through Cal.com. Cal.com also sends the confirmation
 *            email and calendar invite and returns the video-call link, so no
 *            separate email service is needed.
 *  • MOCK  — with no key, availability/booking are generated deterministically
 *            so the feature runs end-to-end with no external accounts.
 *
 * If a live call fails, availability degrades to the mock (the picker still
 * works); a booking failure is surfaced honestly rather than faked.
 *
 * Timezone: the business operates in PKT (UTC+5 / Asia/Karachi). Slots are
 * presented in PKT.
 */

const TZ_LABEL = "PKT (UTC+5)";
const CAL_TZ = "Asia/Karachi"; // IANA zone for PKT, used with Cal.com
const BUSINESS_START = 10; // 10:00
const BUSINESS_END = 17; // 17:00 (last slot starts 16:30)
const SLOT_MINUTES = 30;
const DAYS_AHEAD = 7; // look this many days ahead
const MAX_DAYS = 5; // return at most this many bookable days

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ---------------------------------------------------------------- Cal.com --- */
// All Cal.com specifics live here so the version pins / endpoints are easy to
// bump in one place. See BOOKING.md for setup.
const CAL_BASE = "https://api.cal.com/v2";
const CAL_SLOTS_VERSION = "2024-09-04";
const CAL_BOOKINGS_VERSION = "2024-08-13";

function calKey() {
  return process.env.CALCOM_API_KEY || "";
}
// One event type can serve both, or set separate ids per kind.
function calEventId(kind) {
  const specific = kind === "call" ? process.env.CALCOM_EVENT_ID_CALL : process.env.CALCOM_EVENT_ID_WALKTHROUGH;
  return specific || process.env.CALCOM_EVENT_TYPE_ID || "";
}
function calEnabled(kind) {
  return Boolean(calKey() && calEventId(kind));
}
function calHeaders(version) {
  return {
    "content-type": "application/json",
    Authorization: "Bearer " + calKey(),
    "cal-api-version": version,
  };
}

function isValidEmail(email) {
  return typeof email === "string" && EMAIL_RE.test(email.trim());
}

function fmtDate(d) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function humanDate(d) {
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/* ------------------------------------------------------------- availability --- */

function mockAvailability(now) {
  const days = [];
  for (let i = 1; i <= DAYS_AHEAD && days.length < MAX_DAYS; i++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + i);
    if (d.getUTCDay() === 0) continue; // skip Sunday (Sat is a working day here)
    const slots = [];
    for (let h = BUSINESS_START; h < BUSINESS_END; h++) {
      for (let m = 0; m < 60; m += SLOT_MINUTES) {
        slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      }
    }
    days.push({ date: fmtDate(d), label: humanDate(d), slots });
  }
  return { timezone: TZ_LABEL, days };
}

/**
 * Cal.com slots:
 *   GET /v2/slots?eventTypeId=&start=&end=&timeZone=  (cal-api-version 2024-09-04)
 * Response: { status, data: { "YYYY-MM-DD": [ { start: ISO }, … ] } }
 */
async function fetchCalSlots(now) {
  const id = calEventId("walkthrough"); // picker uses the walkthrough type's availability
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() + 1);
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + DAYS_AHEAD);
  const qs = new URLSearchParams({
    eventTypeId: String(id),
    start: fmtDate(start),
    end: fmtDate(end),
    timeZone: CAL_TZ,
  });
  const r = await fetch(`${CAL_BASE}/slots?${qs}`, { headers: calHeaders(CAL_SLOTS_VERSION) });
  if (!r.ok) throw new Error("cal_slots_" + r.status);
  const json = await r.json();
  const data = (json && json.data) || {};
  const days = [];
  for (const date of Object.keys(data).sort()) {
    if (days.length >= MAX_DAYS) break;
    const times = (data[date] || [])
      .map((s) => {
        const iso = typeof s === "string" ? s : s.start || s.time;
        // iso carries the +05:00 offset (timeZone=Asia/Karachi) → HH:MM is local PKT
        const m = String(iso).match(/T(\d{2}:\d{2})/);
        return m ? m[1] : null;
      })
      .filter(Boolean);
    if (!times.length) continue;
    days.push({ date, label: humanDate(new Date(date + "T00:00:00Z")), slots: times });
  }
  if (!days.length) throw new Error("cal_slots_empty");
  return { timezone: TZ_LABEL, days };
}

async function getAvailability(now = new Date()) {
  if (calEnabled("walkthrough")) {
    try {
      return await fetchCalSlots(now);
    } catch (e) {
      console.error("[booking] Cal.com slots failed, using fallback:", e && e.message);
    }
  }
  return mockAvailability(now);
}

/* ---------------------------------------------------------- confirmation ---- */

/**
 * In LIVE mode Cal.com sends the confirmation + invite itself, so this is only
 * used in MOCK mode. (Hook a real sender here if you ever want a custom email
 * on top of Cal.com's — e.g. Microsoft 365 Graph or Resend.)
 */
function sendConfirmationEmail({ name, email, date, time, type }) {
  const subject = `Your Zentallio ${type} is confirmed — ${date} ${time} ${TZ_LABEL}`;
  return {
    sent: false,
    mock: true,
    to: email,
    subject,
    body:
      `Hi ${name || "there"}, your ${type} with a Zentallio consultant is booked for ` +
      `${date} at ${time} ${TZ_LABEL}. We'll email a calendar invite and meeting link shortly.`,
  };
}

/* -------------------------------------------------------------- booking ----- */

function bookingId(date, time) {
  return "ZEN-" + String(date).replace(/-/g, "") + "-" + String(time).replace(":", "");
}

function mockBooking({ name, email, date, time, type, notes }) {
  const kind = type === "call" ? "call" : "walkthrough";
  return {
    ok: true,
    bookingId: bookingId(date, time),
    type: kind,
    name: name || null,
    email,
    date,
    time,
    timezone: TZ_LABEL,
    notes: notes || null,
    meetingUrl: "https://meet.zentallio.com/" + bookingId(date, time),
    emailPreview: sendConfirmationEmail({ name, email, date, time, type: kind }),
    message:
      `Your ${kind} is confirmed for ${date} at ${time} ${TZ_LABEL}. ` +
      `A calendar invite is on its way to ${email}.`,
  };
}

/**
 * Cal.com booking:
 *   POST /v2/bookings  (cal-api-version 2024-08-13)
 *   { start: <UTC ISO>, eventTypeId, attendee: { name, email, timeZone, language } }
 * Cal.com emails both parties and returns the meeting link.
 */
async function createCalBooking({ name, email, date, time, type, notes }) {
  const kind = type === "call" ? "call" : "walkthrough";
  const startUtc = new Date(`${date}T${time}:00+05:00`).toISOString(); // PKT → UTC
  const body = {
    start: startUtc,
    eventTypeId: Number(calEventId(kind)),
    attendee: {
      name: name || email.split("@")[0],
      email,
      timeZone: CAL_TZ,
      language: "en",
    },
    metadata: { source: "zentallio-website", notes: (notes || "").slice(0, 480) },
  };
  const r = await fetch(`${CAL_BASE}/bookings`, {
    method: "POST",
    headers: calHeaders(CAL_BOOKINGS_VERSION),
    body: JSON.stringify(body),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("cal_book_" + r.status + "_" + JSON.stringify(json).slice(0, 200));
  const d = (json && json.data) || {};
  const ref = d.uid || d.id || bookingId(date, time);
  const meetingUrl = d.meetingUrl || d.videoCallUrl || d.location || (d.locations && d.locations[0] && d.locations[0].link) || null;
  return {
    ok: true,
    bookingId: String(ref),
    type: kind,
    name: name || null,
    email,
    date,
    time,
    timezone: TZ_LABEL,
    notes: notes || null,
    meetingUrl,
    message:
      `Your ${kind} is confirmed for ${date} at ${time} ${TZ_LABEL}. ` +
      `Cal.com has emailed a calendar invite${meetingUrl ? " and meeting link" : ""} to ${email}.`,
  };
}

async function createBooking({ name, email, date, time, type, notes }) {
  if (!isValidEmail(email)) {
    return { ok: false, error: "invalid_email", message: "Please provide a valid email address." };
  }
  if (!date || !time) {
    return { ok: false, error: "missing_slot", message: "Please choose a day and time." };
  }
  const kind = type === "call" ? "call" : "walkthrough";
  if (calEnabled(kind)) {
    try {
      return await createCalBooking({ name, email, date, time, type: kind, notes });
    } catch (e) {
      console.error("[booking] Cal.com booking failed:", e && e.message);
      return {
        ok: false,
        error: "scheduler_error",
        message: "We couldn't confirm that slot just now — please try another time, or email hello@zentallio.com.",
      };
    }
  }
  return mockBooking({ name, email, date, time, type: kind, notes });
}

module.exports = { getAvailability, createBooking, sendConfirmationEmail, isValidEmail, TZ_LABEL };
