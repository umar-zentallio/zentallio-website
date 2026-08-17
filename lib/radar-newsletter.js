/**
 * Radar newsletter adapter — website subscribers → an FCRM `Email Group`.
 *
 * The "Notify me" form on /resources drops an email here. We push it into a
 * Radar Email Group as an `Email Group Member`; AWS SES (configured as Radar's
 * outbound SMTP) is what actually sends to that group. This adapter never
 * sends mail itself — it only maintains the subscriber list in Radar.
 *
 * It is a safe no-op until the env vars are set, so the site runs in dev
 * without Radar:
 *
 *   RADAR_URL              Frappe site root, e.g. https://pm.lucrumerp.com
 *   RADAR_API_KEY          Frappe API key
 *   RADAR_API_SECRET       Frappe API secret
 *   RADAR_EMAIL_GROUP      target Email Group title (default "Zentallio Resources")
 *
 * Frappe REST (Email Group Member DocType):
 *   find:   GET  {URL}/api/resource/Email Group Member?filters=[["email_group","=",G],["email","=",E]]&fields=["name"]
 *   create: POST {URL}/api/resource/Email Group Member  { email_group, email }
 *   headers: Authorization: token <key>:<secret>
 *
 * Schema confirmed live against Radar: `Email Group Member` has
 *   email_group (Link → Email Group, required),
 *   email       (Data, required),
 *   unsubscribed (Check).
 */
const URL = (process.env.RADAR_URL || "").replace(/\/+$/, "");
const KEY = process.env.RADAR_API_KEY;
const SECRET = process.env.RADAR_API_SECRET;
const GROUP = process.env.RADAR_EMAIL_GROUP || "Zentallio Resources";
const MEMBER_DOCTYPE = "Email Group Member";

function enabled() {
  return Boolean(URL && KEY && SECRET);
}

function authHeaders() {
  return { "content-type": "application/json", Authorization: `token ${KEY}:${SECRET}` };
}

// Is this email already a member of the group? Returns the member `name` or null.
async function findMember(email) {
  const filters = JSON.stringify([
    ["email_group", "=", GROUP],
    ["email", "=", email],
  ]);
  const q =
    `filters=${encodeURIComponent(filters)}` +
    `&fields=${encodeURIComponent(JSON.stringify(["name", "unsubscribed"]))}&limit_page_length=1`;
  const r = await fetch(`${URL}/api/resource/${encodeURIComponent(MEMBER_DOCTYPE)}?${q}`, { headers: authHeaders() });
  if (!r.ok) return null;
  const j = await r.json().catch(() => ({}));
  return j.data && j.data.length ? j.data[0] : null;
}

/**
 * Subscribe an email to the resources newsletter group. Deduped by
 * (group, email) so re-submits are harmless. Returns:
 *   { ok:true, created:true }   newly added
 *   { ok:true, created:false }  already a member
 *   { ok:false, disabled:true } no Radar keys (dev)
 *   { ok:false, error:"…" }     Radar rejected the write
 */
async function subscribe(email) {
  if (!enabled()) {
    console.log("[newsletter] (disabled — no keys) would subscribe", email, "to", GROUP);
    return { ok: false, disabled: true };
  }
  try {
    const existing = await findMember(email);
    if (existing) return { ok: true, created: false, name: existing.name };
    const r = await fetch(`${URL}/api/resource/${encodeURIComponent(MEMBER_DOCTYPE)}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ email_group: GROUP, email }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error("radar_subscribe_" + r.status + "_" + JSON.stringify(j).slice(0, 160));
    return { ok: true, created: true, name: j.data && j.data.name };
  } catch (e) {
    console.error("[newsletter] subscribe failed:", e.message);
    return { ok: false, error: e.message };
  }
}

module.exports = { enabled, subscribe, GROUP };
