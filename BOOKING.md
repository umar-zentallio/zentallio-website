# Booking — "Book a walkthrough / call with our consultant"

An end-to-end booking flow: a visitor can start from any page, talk to the
**Iris** assistant (AI chat) or use a **Quick form**, pick a slot, and get a
confirmed meeting with a calendar invite, an email, and a video-call link.

It runs in two modes, chosen automatically by which environment variables are
present — no code change to switch:

| Mode | When | Behaviour |
|---|---|---|
| **Live** | `CALCOM_API_KEY` (+ event id) set | Real availability + bookings via Cal.com; Cal.com sends the invite/email and returns the meeting link. `ANTHROPIC_API_KEY` also turns on the real Iris chat. |
| **Mock** | no keys | Deterministic availability + booking so the flow works with no accounts (great for local dev / preview). |

If a live Cal.com call fails, availability quietly falls back to generated
slots; a booking failure is reported honestly (never faked).

## How a visitor reaches it (CTAs)

- **Floating "Book a walkthrough" button** injected on every page (suppressed
  where a page already has its own corner widget; lifts above the mobile cookie
  banner).
- **Inline CTAs** — the "See it on your numbers" / "See it configured" capture
  blocks and any "Book a walkthrough / call" link. If the visitor typed an email
  in the block, it's carried into a pre-filled Quick form.
- **Programmatic** — `window.zentallioBook('walkthrough' | 'call')`.

## Files

| File | Role |
|---|---|
| `booking.js` / `booking.css` | Self-contained widget (modal, chat, form, floating CTA). Falls back to client-side logic if `/api` is unreachable. |
| `lib/booking-core.js` | Availability, validation, `createBooking`, Cal.com integration, mock fallback. |
| `api/availability.js` | `GET /api/availability` → open days & slots. |
| `api/book.js` | `POST /api/book` → create a booking (Quick form). |
| `api/chat.js` | `POST /api/chat` → the Iris AI assistant (Claude tool-use loop). |

---

## What you need to do to go live (two accounts)

### 1. Cal.com — scheduling + email + calendar  (free tier is enough)

1. Create an account at **cal.com**.
2. **Connect your calendar:** Settings → *Apps / Calendars* → connect
   **Microsoft 365 / Outlook** (zentallio.com is on Microsoft, so bookings will
   check your real availability and land on your actual Outlook calendar).
3. **Create an event type** for the walkthrough (e.g. "Zentallio walkthrough",
   30 min, location = Cal Video or Teams). Optionally a second one for "Call
   with a consultant". Open the event type and note its **numeric id** (in the
   URL / event-type settings).
4. **Get an API key:** Settings → *Developer / API keys* → create one.
5. Set these environment variables:
   - `CALCOM_API_KEY` = your key
   - `CALCOM_EVENT_TYPE_ID` = the walkthrough event-type id (used for both), **or**
     set both `CALCOM_EVENT_ID_WALKTHROUGH` and `CALCOM_EVENT_ID_CALL` for
     separate event types.

Cal.com then sends the confirmation email + calendar invite to the visitor and
you, and includes the video link — so **no separate email service is needed**.
(If you ever want a custom-branded email from `@zentallio.com` on top of that,
hook a sender into `sendConfirmationEmail()` in `lib/booking-core.js`.)

### 2. Anthropic — the real "Ask Iris" chat

1. Create a key at the Anthropic console.
2. Set `ANTHROPIC_API_KEY`. (Optional `BOOKING_MODEL`, default `claude-sonnet-5`.)

Without this key the chat still works via a scripted fallback, and the Quick
form is unaffected.

### Where to put the variables

- **nginx / systemd deploy:** add them to `/etc/zentallio/api.env` (see
  `deploy/README.md`), then `systemctl restart zentallio-api`.
- **Local dev:** a `.env` file next to `api-server.js` (real env always wins).
- **Vercel (if used):** Project → Settings → Environment Variables.

Verify with `curl localhost:3001/health` → `{"ok":true,"ai":true}` once the
Anthropic key is live.

---

## Env var reference

| Variable | Required? | Enables |
|---|---|---|
| `CALCOM_API_KEY` | for live booking | Real availability + bookings + Cal.com email/invite |
| `CALCOM_EVENT_TYPE_ID` | with the key | Event type for both kinds (fallback) |
| `CALCOM_EVENT_ID_WALKTHROUGH` / `CALCOM_EVENT_ID_CALL` | optional | Separate event types per kind |
| `ANTHROPIC_API_KEY` | optional | Real Iris AI chat (else scripted) |
| `BOOKING_MODEL` | optional | Model override (default `claude-sonnet-5`) |

## Business rules (edit in `lib/booking-core.js`)

- Timezone: **PKT (UTC+5)** — `Asia/Karachi` for Cal.com
- Hours / slots in mock mode: 10:00–17:00, 30-min slots, next 5 working days,
  Sundays skipped. In live mode these come from your Cal.com availability.
- Booking ref: Cal.com's booking `uid` in live mode; `ZEN-YYYYMMDD-HHMM` in mock.
