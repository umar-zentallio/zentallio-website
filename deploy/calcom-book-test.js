#!/usr/bin/env node
/**
 * First-booking test for the Cal.com integration — timezone-aware.
 *
 * Run from a machine with open internet (the site's build environment blocks
 * api.cal.com). It makes the SAME two calls the app makes — get slots, then
 * create a booking in a chosen visitor timezone — and prints the full
 * responses so you can confirm the invite/email arrive at the right LOCAL time.
 *
 * ⚠️ Creates a REAL booking and sends REAL emails. Use your own address and
 *    cancel it afterwards from Cal.com.
 *
 *   export CALCOM_API_KEY='cal_live_...'
 *   node deploy/calcom-book-test.js you@brand.com                 # your detected tz
 *   node deploy/calcom-book-test.js you@brand.com Europe/London   # a specific visitor tz
 *   node deploy/calcom-book-test.js you@brand.com America/New_York 6503154
 */
const KEY = process.env.CALCOM_API_KEY;
const EMAIL = process.argv[2];
let TZ = process.argv[3];
const EVENT_ID = process.argv[4] || "6503154";
const BASE = "https://api.cal.com/v2";

try { TZ = TZ || Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) {}
TZ = TZ || "Asia/Karachi";

if (!KEY) { console.error("Set CALCOM_API_KEY first:  export CALCOM_API_KEY='cal_live_...'"); process.exit(1); }
if (!EMAIL || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(EMAIL)) { console.error("Pass an attendee email:  node deploy/calcom-book-test.js you@brand.com [timezone]"); process.exit(1); }
try { new Intl.DateTimeFormat("en", { timeZone: TZ }); } catch (e) { console.error("Invalid timezone:", TZ); process.exit(1); }

const pad = (n) => String(n).padStart(2, "0");
const day = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
function label(iso, tz) {
  const p = {};
  new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZoneName: "shortOffset" })
    .formatToParts(new Date(iso)).forEach((x) => (p[x.type] = x.value));
  return `${p.weekday}, ${p.day} ${p.month} ${p.hour}:${p.minute} (${p.timeZoneName})`;
}

(async () => {
  console.log(`\nVisitor timezone under test: ${TZ}\n`);
  const now = new Date();
  const start = new Date(now); start.setUTCDate(start.getUTCDate() + 1);
  const end = new Date(now); end.setUTCDate(end.getUTCDate() + 7);

  // 1. slots (labelled in the visitor's timezone)
  const qs = new URLSearchParams({ eventTypeId: EVENT_ID, start: day(start), end: day(end), timeZone: TZ });
  console.log(`[1] GET ${BASE}/slots?${qs}`);
  const sres = await fetch(`${BASE}/slots?${qs}`, { headers: { Authorization: `Bearer ${KEY}`, "cal-api-version": "2024-09-04" } });
  const sjson = await sres.json().catch(() => ({}));
  console.log(`    HTTP ${sres.status}`);
  console.log("    body:", JSON.stringify(sjson).slice(0, 800));

  const data = (sjson && sjson.data) || {};
  const firstDate = Object.keys(data).sort()[0];
  const firstSlot = firstDate && data[firstDate] && data[firstDate][0];
  const startIso = typeof firstSlot === "string" ? firstSlot : firstSlot && (firstSlot.start || firstSlot.time);
  if (!startIso) { console.error("\n❌ No slots returned — check the calendar is connected and the event has availability."); process.exit(2); }
  const startUtc = new Date(startIso).toISOString();
  console.log(`\n    first slot in ${TZ}:  ${label(startUtc, TZ)}   (UTC ${startUtc})`);

  // 2. booking (attendee.timeZone = visitor tz)
  const body = { start: startUtc, eventTypeId: Number(EVENT_ID), attendee: { name: "Zentallio Test", email: EMAIL, timeZone: TZ, language: "en" }, metadata: { source: "zentallio-website", notes: "First-booking test" } };
  console.log(`\n[2] POST ${BASE}/bookings`);
  console.log("    request:", JSON.stringify(body));
  const bres = await fetch(`${BASE}/bookings`, { method: "POST", headers: { "content-type": "application/json", Authorization: `Bearer ${KEY}`, "cal-api-version": "2024-08-13" }, body: JSON.stringify(body) });
  const bjson = await bres.json().catch(() => ({}));
  console.log(`    HTTP ${bres.status}`);
  console.log("    body:", JSON.stringify(bjson, null, 2));

  if (bres.ok) {
    const d = bjson.data || {};
    console.log(`\n✅ Booked. ref=${d.uid || d.id || "?"}  meetingUrl=${d.meetingUrl || d.videoCallUrl || d.location || "(none)"}`);
    console.log(`   The invite email should show ${label(startUtc, TZ)} for the attendee.`);
    console.log("   Check your inbox + Outlook, confirm the local time matches, then cancel the test booking.");
  } else {
    console.log("\n❌ Booking failed — paste the body above back to me (it shows what Cal.com expects) and I'll adjust lib/booking-core.js.");
  }
})().catch((e) => { console.error("\nRequest error:", e && e.message); process.exit(3); });
