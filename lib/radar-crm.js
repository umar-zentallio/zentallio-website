/**
 * Radar CRM adapter — Zentallio's own CRM, built on Frappe CRM (FCRM).
 *
 * Radar lives at https://pm.lucrumerp.com and its leads are the standard FCRM
 * `CRM Lead` DocType. This adapter pushes qualified Ask-Iris leads into that
 * pipeline via the Frappe REST API. It is a safe no-op until the env vars are
 * set, so the whole chat pipeline runs in dev without Radar:
 *
 *   RADAR_URL              Frappe site root, e.g. https://pm.lucrumerp.com
 *   RADAR_API_KEY          Frappe API key
 *   RADAR_API_SECRET       Frappe API secret
 *   RADAR_LEAD_DOCTYPE     target DocType (default "CRM Lead")
 *   RADAR_LEAD_SOURCE      CRM Lead Source to stamp (default "Website")
 *
 * Frappe REST:
 *   find:   GET  {URL}/api/resource/CRM Lead?filters=[["email","=","…"]]&fields=["name"]
 *   create: POST {URL}/api/resource/CRM Lead
 *   update: PUT  {URL}/api/resource/CRM Lead/{name}
 *   note:   POST {URL}/api/resource/Comment   (timeline comment)
 *   headers: Authorization: token <key>:<secret>
 *
 * Schema was confirmed live against Radar (FCRM). `CRM Lead` has NO custom
 * fields for score/tier/locations/timeline/pain points, so the rich
 * qualification context is written as a timeline Comment on first create; the
 * structured columns (name/email/company/role/status/source/industry) update
 * in place on every upsert.
 */
const URL = (process.env.RADAR_URL || "").replace(/\/+$/, "");
const KEY = process.env.RADAR_API_KEY;
const SECRET = process.env.RADAR_API_SECRET;
const DOCTYPE = process.env.RADAR_LEAD_DOCTYPE || "CRM Lead";
const SOURCE = process.env.RADAR_LEAD_SOURCE || "Website";
const LEAD_OWNER = process.env.RADAR_LEAD_OWNER || ""; // a real Radar User (email); must exist or the Link fails

function enabled() {
  return Boolean(URL && KEY && SECRET);
}

function authHeaders() {
  return { "content-type": "application/json", Authorization: `token ${KEY}:${SECRET}` };
}

// Iris stage → real FCRM CRM Lead Status (confirmed live: New, Contacted,
// Qualified, Proposal, Converted, Unqualified, Not Attending).
const STATUS_BY_STAGE = {
  engage: "New",
  qualify: "Contacted",
  educate: "Contacted",
  demonstrate: "Qualified",
  pricing: "Proposal",
  convert: "Qualified", // a booked walkthrough is a strong qualified lead, not a won deal
  handoff: "Qualified",
};

function statusFor(lead) {
  if (lead && lead.flags && lead.flags.booked) return "Qualified";
  return STATUS_BY_STAGE[lead && lead.stage] || "New";
}

// Iris sector → a valid CRM Industry record (confirmed live). Only returns a
// value that exists in Radar, so the Link never fails validation; else null.
function industryFor(sector) {
  const s = String(sector || "").toLowerCase();
  if (!s) return null;
  if (/food|beverage|restaurant|f\s*&\s*b|fnb|cafe|catering|qsr/.test(s)) return "Food";
  if (/fashion|apparel|garment|textile|retail|clothing/.test(s)) return "Fashion Retail";
  return null;
}

function splitName(lead) {
  const raw = (lead.name || "").trim();
  if (raw) {
    const parts = raw.split(/\s+/);
    return { first_name: parts[0], last_name: parts.slice(1).join(" ") || undefined, full: raw };
  }
  if (lead.email) {
    const local = lead.email.split("@")[0];
    return { first_name: local, last_name: undefined, full: local };
  }
  return { first_name: "Website Visitor", last_name: undefined, full: "Website Visitor" };
}

// Map Iris's lead record → Radar `CRM Lead` fields. Only confirmed-existing
// columns and validated Link values are emitted.
function mapToRadar(lead) {
  const n = splitName(lead);
  const industry = industryFor(lead.sector);
  const doc = {
    first_name: n.first_name,        // required in FCRM
    last_name: n.last_name,
    lead_name: n.full,               // title field
    email: lead.email || undefined,
    organization: lead.company || undefined,
    job_title: lead.role || undefined,
    status: statusFor(lead),         // required
    source: SOURCE,
  };
  if (industry) doc.industry = industry;
  if (LEAD_OWNER) doc.lead_owner = LEAD_OWNER; // primary owner (e.g. the Iris bot user)
  // strip undefined so Frappe doesn't choke on nulls for Link fields
  Object.keys(doc).forEach((k) => doc[k] === undefined && delete doc[k]);
  return doc;
}

// Human-readable qualification brief for the lead's timeline (what a
// salesperson needs at a glance — the columns FCRM has no field for).
function qualificationNote(lead) {
  const row = (k, v) => (v == null || v === "" || (Array.isArray(v) && !v.length) ? "" : `<li><b>${k}:</b> ${Array.isArray(v) ? v.join(", ") : v}</li>`);
  const f = lead.flags || {};
  return [
    `<b>Ask Iris — qualified lead</b>`,
    `<ul>`,
    row("Score", lead.score != null ? `${lead.score}/100 (${lead.tier || "cold"})` : null),
    row("Sector", lead.sector),
    row("Sub-sector", lead.subSector),
    row("Locations", lead.locations),
    row("Role", lead.role),
    row("Authority", lead.authority),
    row("Timeline", lead.timeline),
    row("Region", lead.region),
    row("Pain points", lead.painPoints),
    row("Interests", lead.interests),
    row("Asked pricing", f.askedPricing ? "yes" : ""),
    row("Asked demo", f.askedDemo ? "yes" : ""),
    row("Booked", f.booked ? "yes" : ""),
    row("Recommended next", lead.recommendedNext),
    row("Web lead id", lead.id),
    `</ul>`,
  ].filter(Boolean).join("");
}

async function findByEmail(email) {
  const q =
    `filters=${encodeURIComponent(JSON.stringify([["email", "=", email]]))}` +
    `&fields=${encodeURIComponent(JSON.stringify(["name"]))}&limit_page_length=1`;
  const r = await fetch(`${URL}/api/resource/${encodeURIComponent(DOCTYPE)}?${q}`, { headers: authHeaders() });
  if (!r.ok) return null;
  const j = await r.json().catch(() => ({}));
  return j.data && j.data.length ? j.data[0].name : null;
}

// Post an HTML comment to a lead's Radar timeline (best-effort).
async function comment(refName, html) {
  try {
    await fetch(`${URL}/api/resource/Comment`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        comment_type: "Comment",
        reference_doctype: DOCTYPE,
        reference_name: refName,
        content: html,
      }),
    });
    return true;
  } catch (_) {
    return false;
  }
}

// Assign the lead to a Radar user (creates the ToDo that drives FCRM's
// "assigned to" / notifications). Best-effort.
async function assign(refName, owner) {
  if (!owner) return false;
  try {
    const r = await fetch(`${URL}/api/method/frappe.desk.form.assign_to.add`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ doctype: DOCTYPE, name: refName, assign_to: [owner] }),
    });
    return r.ok;
  } catch (_) {
    return false;
  }
}

// Create-or-update the CRM Lead, deduped by email. Returns { name, created }.
// Does NOT post any timeline note — callers decide what to write.
async function ensure(lead) {
  const existing = await findByEmail(lead.email);
  const body = JSON.stringify(mapToRadar(lead));
  if (existing) {
    const r = await fetch(`${URL}/api/resource/${encodeURIComponent(DOCTYPE)}/${encodeURIComponent(existing)}`, {
      method: "PUT",
      headers: authHeaders(),
      body,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error("radar_update_" + r.status + "_" + JSON.stringify(j).slice(0, 160));
    return { name: existing, created: false };
  }
  const r = await fetch(`${URL}/api/resource/${encodeURIComponent(DOCTYPE)}`, {
    method: "POST",
    headers: authHeaders(),
    body,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("radar_create_" + r.status + "_" + JSON.stringify(j).slice(0, 160));
  return { name: j.data && j.data.name, created: true };
}

/**
 * Upsert a lead into Radar. Deduped by email — we only push once there's an
 * email to key on (a lead with no contact info isn't sales-ready and would
 * just create junk in the pipeline). Fields update in place on every call; the
 * qualification brief is posted once, when the lead is first created.
 */
async function upsertLead(lead) {
  if (!enabled()) {
    console.log("[radar] (disabled — no keys) would upsert", lead.id, "tier=" + lead.tier, "score=" + lead.score);
    return { ok: false, disabled: true };
  }
  if (!lead.email) return { ok: false, skipped: "no_email" };
  try {
    const { name, created } = await ensure(lead);
    if (created && name) await comment(name, qualificationNote(lead)); // context on first create only
    return { ok: true, name, created };
  } catch (e) {
    console.error("[radar] upsert failed:", e.message);
    return { ok: false, error: e.message };
  }
}

/**
 * Hand a lead off to a human in Radar: ensure the CRM Lead exists/updated,
 * post the sales brief to its timeline, and assign it to the configured owner
 * so it surfaces in the rep's queue.
 */
async function handoff(lead, briefHtml) {
  if (!enabled()) {
    console.log("[radar] (disabled — no keys) would hand off", lead.id, "tier=" + lead.tier);
    return { ok: false, disabled: true };
  }
  if (!lead.email) return { ok: false, skipped: "no_email" };
  try {
    const { name } = await ensure(lead);
    if (name) {
      await comment(name, briefHtml || qualificationNote(lead));
      if (LEAD_OWNER) await assign(name, LEAD_OWNER);
    }
    return { ok: true, name };
  } catch (e) {
    console.error("[radar] handoff failed:", e.message);
    return { ok: false, error: e.message };
  }
}

module.exports = { enabled, upsertLead, handoff, comment, assign, mapToRadar, statusFor, industryFor };
