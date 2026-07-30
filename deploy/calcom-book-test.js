#!/usr/bin/env node
/**
 * First-booking test for the Cal.com integration.
 *
 * Run this from a machine with open internet (the site's build environment
 * blocks api.cal.com). It makes the SAME two calls the app makes — get slots,
 * then create a booking — and prints the full responses so you can confirm the
 * invite/email arrive and we can verify Cal.com's exact response shape.
 *
 * ⚠️ This creates a REAL booking and sends REAL emails. Use your own address;
 *    cancel it afterwards from Cal.com / your calendar.
 *
 *   export CALCOM_API_KEY='cal_live_...'
 *   node deploy/calcom-book-test.js you@yourbrand.com
 *
 * Optional: pass a specific event id as the 2nd arg (defaults to 6503154).
 */
const KEY = process.env.CALCOM_API_KEY;
const EMAIL = process.argv[2];
const EVENT_ID = process.argv[3] || "6503154";
const TZ = "Asia/Karachi";
const BASE = "https://api.cal.com/v2";

if (!KEY) {
  console.error("Set CALCOM_API_KEY first:  export CALCOM_API_KEY='cal_live_...'");
  process.exit(1);
}
if (!EMAIL || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(EMAIL)) {
  console.error("Pass an attendee email:  node deploy/calcom-book-test.js you@yourbrand.com");
  process.exit(1);
}

const pad = (n) => String(n).padStart(2, "0");
const day = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

(async () => {
  const now = new Date();
  const start = new Date(now); start.setUTCDate(start.getUTCDate() + 1);
  const end = new Date(now); end.setUTCDate(end.getUTCDate() + 7);

  // ---- 1. available slots ----
  const qs = new URLSearchParams({ eventTypeId: EVENT_ID, start: day(start), end: day(end), timeZone: TZ });
  console.log(`\n[1] GET ${BASE}/slots?${qs}`);
  const sres = await fetch(`${BASE}/slots?${qs}`, {
    headers: { Authorization: `Bearer ${KEY}`, "cal-api-version": "2024-09-04" },
  });
  const sjson = await sres.json().catch(() => ({}));
  console.log(`    HTTP ${sres.status}`);
  console.log("    body:", JSON.stringify(sjson).slice(0, 900));

  const data = sjson && sjson.data ? sjson.data : {};
  const firstDate = Object.keys(data).sort()[0];
  const firstSlot = firstDate && data[firstDate] && data[firstDate][0];
  const startIso = typeof firstSlot === "string" ? firstSlot : firstSlot && (firstSlot.start || firstSlot.time);
  if (!startIso) {
    console.error("\n❌ No slots returned — check the calendar is connected in Cal.com and the event has availability.");
    process.exit(2);
  }
  const startUtc = new Date(startIso).toISOString();
  console.log(`\n    first available slot: ${startIso}  → UTC ${startUtc}`);

  // ---- 2. create booking ----
  const body = {
    start: startUtc,
    eventTypeId: Number(EVENT_ID),
    attendee: { name: "Zentallio Test", email: EMAIL, timeZone: TZ, language: "en" },
    metadata: { source: "zentallio-website", notes: "First-booking test" },
  };
  console.log(`\n[2] POST ${BASE}/bookings`);
  console.log("    request:", JSON.stringify(body));
  const bres = await fetch(`${BASE}/bookings`, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${KEY}`, "cal-api-version": "2024-08-13" },
    body: JSON.stringify(body),
  });
  const bjson = await bres.json().catch(() => ({}));
  console.log(`    HTTP ${bres.status}`);
  console.log("    body:", JSON.stringify(bjson, null, 2));

  if (bres.ok) {
    const d = bjson.data || {};
    console.log(`\n✅ Booked. ref=${d.uid || d.id || "?"}  meetingUrl=${d.meetingUrl || d.videoCallUrl || d.location || "(none)"}`);
    console.log("   Check your inbox + Outlook calendar for the invite, then cancel the test booking.");
  } else {
    console.log("\n❌ Booking failed — paste the body above back to me (it shows what Cal.com expects) and I'll adjust the request.");
  }
})().catch((e) => {
  console.error("\nRequest error:", e && e.message);
  process.exit(3);
});
