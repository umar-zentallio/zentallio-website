/**
 * Booking core — shared logic for the "Book a walkthrough / call" flow.
 *
 * PROTOTYPE MODE: availability, booking creation, and confirmation email are
 * mocked so the feature runs end-to-end with no external accounts. Each mock is
 * marked with a `REAL:` comment showing exactly where the live Cal.com / email
 * calls plug in once keys are provided.
 *
 * Timezone: the business operates from Lahore (PKT, UTC+5). Slots are presented
 * in PKT; a production build would convert to the visitor's timezone.
 */

const TZ_LABEL = "PKT (UTC+5)";
const BUSINESS_START = 10; // 10:00
const BUSINESS_END = 17; // 17:00 (last slot starts 16:30)
const SLOT_MINUTES = 30;
const DAYS_AHEAD = 7; // look this many days ahead
const MAX_DAYS = 5; // return at most this many bookable days

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
  return typeof email === "string" && EMAIL_RE.test(email.trim());
}

function fmtDate(d) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function humanDate(d) {
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/**
 * Returns available days + time slots.
 * REAL: replace the generated slots with a Cal.com call:
 *   GET https://api.cal.com/v2/slots?eventTypeId=...&startTime=...&endTime=...
 *   (Authorization: Bearer ${process.env.CALCOM_API_KEY}); map response to this shape.
 */
function getAvailability(now = new Date()) {
  const days = [];
  for (let i = 1; i <= DAYS_AHEAD && days.length < MAX_DAYS; i++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + i);
    const dow = d.getUTCDay(); // 0 Sun … 6 Sat
    if (dow === 0) continue; // skip Sunday (Sat is a working day here)
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
 * REAL: send the confirmation via Resend / SendGrid, e.g.
 *   POST https://api.resend.com/emails  (Authorization: Bearer ${process.env.RESEND_API_KEY})
 *   { from, to: email, subject, html }
 */
function sendConfirmationEmail({ name, email, date, time, type }) {
  const subject = `Your Zentallio ${type} is confirmed — ${date} ${time} ${TZ_LABEL}`;
  // Prototype: no real send. Return a preview payload the API can echo/log.
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

/**
 * Create a booking.
 * REAL: POST https://api.cal.com/v2/bookings with { eventTypeId, start, responses:{name,email,notes} }
 *   then trigger sendConfirmationEmail() (Cal.com can also send its own confirmation).
 */
function createBooking({ name, email, date, time, type, notes }) {
  if (!isValidEmail(email)) {
    return { ok: false, error: "invalid_email", message: "Please provide a valid email address." };
  }
  if (!date || !time) {
    return { ok: false, error: "missing_slot", message: "Please choose a day and time." };
  }
  const kind = type === "call" ? "call" : "walkthrough";
  // Deterministic mock id (no Math.random — keeps prototype output stable/testable).
  const bookingId = "ZEN-" + String(date).replace(/-/g, "") + "-" + String(time).replace(":", "");
  const email_preview = sendConfirmationEmail({ name, email, date, time, type: kind });
  return {
    ok: true,
    bookingId,
    type: kind,
    name: name || null,
    email,
    date,
    time,
    timezone: TZ_LABEL,
    notes: notes || null,
    meetingUrl: "https://meet.zentallio.com/" + bookingId, // REAL: Cal.com returns the video link
    email: email_preview,
    message:
      `Your ${kind} is confirmed for ${date} at ${time} ${TZ_LABEL}. ` +
      `A calendar invite is on its way to ${email}.`,
  };
}

module.exports = { getAvailability, createBooking, sendConfirmationEmail, isValidEmail, TZ_LABEL };
