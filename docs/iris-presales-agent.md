# Iris — autonomous pre-sales agent

Iris runs a website visitor through the pre-sales cycle — engage → qualify →
educate → demonstrate → pricing → convert (book) → **hand a sales-ready lead to
a human**. LLM-driven on the existing stack (Claude tool-use loop in
`api/chat.js`), with a persisted lead record and CRM sync.

## Decisions (v1)
- **Autonomy:** fully autonomous on the website through *qualify → book*, then hand off. No autonomous outbound (nurture is v2).
- **System of record:** **Radar** (Zentallio's Frappe-based CRM), via its REST API.
- **Channels:** website chat (Ask Iris) + human handoff.
- **Architecture:** LLM-driven — the model advances the stage and calls tools; a lead record persists state; Radar is the source of truth.

## Node graph
| # | Node | Iris does | Tools | Advances when |
|---|---|---|---|---|
| 1 | engage | greet, detect intent | KB | intent known |
| 2 | qualify | learn sector, #locations, role/authority, pain, timeline → **score** | `capture_lead` | scored cold/warm/hot |
| 3 | educate | map pain → solutions, answer (grounded) | KB | needs understood |
| 4 | demonstrate | offer walkthrough, point to a resource | (`send_resource` — Phase D) | interest confirmed |
| 5 | pricing | illustrative pricing, ROI, objections | KB pricing | resolved / escalated |
| 6 | convert | capture details, **book** | `get_availability`, `create_booking` | booked |
| 7 | handoff | brief + notify + Radar record | `crm_upsert`, `request_human` (Phase B/C) | human owns it |

## Lead record
Persisted server-side (`lib/lead-store.js`), keyed by a `leadId` the browser
holds in `localStorage` and sends with each `/api/chat` call (memory across
turns *and* return visits). Radar is the eventual SoR.
```
{ id, createdAt, updatedAt, stage, score(0–100), tier(cold|warm|hot),
  name, email, company, sector, subSector, locations, role, authority,
  timeline, region, painPoints[], interests[], flags{askedPricing,askedDemo,booked},
  recommendedNext, handoff{status} }
```

## Scoring (`lib/lead-scoring.js`)
Transparent fit + intent rubric → tier. Fit: sector +10; locations 1–9/10–49/
50–99/100+ = +5/+15/+25/+35; authority decision-maker +20 / influencer +10.
Intent: timeline now/quarter/year = +20/+12/+6; gave email +15; asked pricing
+8; asked demo +8; booked +20. `≥70 hot, ≥40 warm, else cold`. Tier drives how
hard Iris pushes a booking.

## Phase status
- **A — Foundations (this branch, done):** `lead-store`, `lead-scoring`, `radar-crm` adapter (stub until keys), a node/stage-aware system prompt with the current lead injected each turn, an upgraded `capture_lead` (persists every field + flags + stage, returns score/tier), `create_booking` marks the lead converted, and `leadId` plumbed client↔server. Radar upsert fires on every lead update (stub logs until keys).
- **B — Convert + Handoff (done):** `request_human` tool + `lib/handoff.js`. Iris calls it when a visitor wants a person, a lead is hot, or right after a booking; a booking also auto-hands-off. It builds a sales brief (HTML for Radar, text for chat), files/updates the lead in Radar with the brief on the timeline, **assigns it to the primary owner** (`RADAR_LEAD_OWNER`), and fires an optional alert (`HANDOFF_WEBHOOK_URL`, Slack-compatible). Idempotent per lead (won't double-send), gated on an email being on file.
- **C — Radar wire-up (done, pending live keys):** Radar is **Frappe CRM (FCRM)** at `https://pm.lucrumerp.com`; leads are the standard **`CRM Lead`** DocType (schema confirmed live). `radar-crm.js` now upserts into `CRM Lead` via the Frappe REST API — deduped by email (only pushes once there's an email to key on), mapping name→`first_name/last_name/lead_name`, `email`, company→`organization`, role→`job_title`, Iris stage→`status` (real FCRM statuses: New/Contacted/Qualified/Proposal/Converted/Unqualified/Not Attending), and sector→`industry` (only when it maps to a real `CRM Industry`; `Food` / `Fashion Retail`). `source` = `Website` (a real `CRM Lead Source`). The rich qualification context (score, tier, #locations, timeline, pain points — FCRM has no field for these) is written once as a **timeline Comment** on first create. Still needs the live API key/secret in server env to switch from no-op to live.
- **D — Recommend:** `send_resource` tool tied to the Resources section.
- **E (optional):** funnel analytics, proactive greeting.

## Config (env)
```
ANTHROPIC_API_KEY=…            # real Iris (required for the agent to reason)
LEAD_STORE_DIR=/var/lib/zentallio/leads   # writable dir for the lead cache (server FS is read-only elsewhere)
# Radar (Phase C) — Frappe CRM at pm.lucrumerp.com:
RADAR_URL=https://pm.lucrumerp.com
RADAR_API_KEY=…
RADAR_API_SECRET=…
RADAR_LEAD_DOCTYPE=CRM Lead
RADAR_LEAD_SOURCE=Website
RADAR_LEAD_OWNER=iris@…            # primary owner (a real Radar User); must exist or the Link is skipped
# Handoff alert (optional): a Slack incoming-webhook URL (or any endpoint taking {text}).
# If unset, the Radar lead + timeline brief IS the alert.
HANDOFF_WEBHOOK_URL=
```
On the systemd unit, add the lead dir to `ReadWritePaths` (the service is `ProtectSystem=strict`).

## Still to confirm
- **Primary owner:** decided — Iris is the primary owner. Needs an **Iris User account in Radar** (none exists yet); set its email as `RADAR_LEAD_OWNER`. Until it exists, owner assignment is skipped (everything else still works).
- **Alert channel:** `HANDOFF_WEBHOOK_URL` supports Slack today; if email is preferred, point it at an email-to-webhook (or add an email sender in `lib/handoff.js`).
- **Live chat**: real-time human takeover needs an agent console — v1 handoff = Radar lead + brief + assignment + optional alert + booked meeting.
- Radar `CRM Lead` **DocType + field names** — ✅ confirmed live (Phase C). No custom fields for score/tier/locations, hence the timeline-Comment brief.
