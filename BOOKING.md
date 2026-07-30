# Booking — "Book a walkthrough / call with our consultant"

An end-to-end booking flow: a visitor can start from any page, talk to the
**Iris** assistant (AI chat) or use a **Quick form**, and get a confirmed slot
with a booking reference and (once wired) a real calendar invite + email.

It ships as a **working prototype**: every external dependency (calendar,
email, AI) is mocked deterministically, so the flow works today on a static
host. The real integrations are gated behind environment variables and marked
in the code with `REAL:` comments — flip them on without touching the UI.

## How a visitor reaches it (CTAs)

- **Floating "Book a walkthrough" button** — injected by `booking.js` on every
  page. It's suppressed automatically on pages that already have their own
  fixed corner widget (the "Ask Zen" FAB / dock) so the two never overlap, and
  it lifts above the cookie banner on mobile so it never covers it.
- **Inline CTAs** — any link/button whose text starts with "Book a walkthrough"
  or "Book a call" (e.g. the buttons on the sector pages, the nav, the About
  page) is intercepted and opens the same widget.
- **Programmatic** — `window.zentallioBook('walkthrough' | 'call')`.

## Files

| File | Role |
|---|---|
| `booking.js` / `booking.css` | Self-contained widget (modal, chat, form, FAB). Client-side fallback lets it work with no backend. |
| `lib/booking-core.js` | Shared booking logic: availability, validation, `createBooking`, confirmation email. |
| `api/availability.js` | `GET /api/availability` → open days & slots. |
| `api/book.js` | `POST /api/book` → create a booking (used by the Quick form). |
| `api/chat.js` | `POST /api/chat` → the Iris AI assistant (Claude tool-use loop). |

On Vercel the `/api/*` serverless functions take over; on a plain static host
the widget falls back to the equivalent client-side logic.

## Going from prototype → production

Set these environment variables in Vercel (Project → Settings → Environment
Variables). None are required for the prototype; each one activates a real
integration where a mock currently runs.

| Variable | Enables | Where it's used |
|---|---|---|
| `ANTHROPIC_API_KEY` | Real Iris AI assistant (otherwise a scripted fallback) | `api/chat.js` |
| `BOOKING_MODEL` | Override the model (default `claude-sonnet-5`) | `api/chat.js` |
| `CALCOM_API_KEY` | Real availability + real bookings via Cal.com | `lib/booking-core.js` (`REAL:` markers) |
| `RESEND_API_KEY` | Real confirmation emails (Resend or SendGrid) | `lib/booking-core.js` (`sendConfirmationEmail`) |

Search the code for `REAL:` — each marker shows the exact request to make
(Cal.com `GET slots` / `POST /v2/bookings`, and the email send). The mock and
the real path return the same shape, so the widget needs no changes.

## Business rules (edit in `lib/booking-core.js`)

- Timezone label: **PKT (UTC+5)**
- Hours: **10:00–17:00**, 30-minute slots
- Next 7 days, up to 5 offered, Sundays skipped
- Booking ref format: `ZEN-YYYYMMDD-HHMM`
