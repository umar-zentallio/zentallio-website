/**
 * Radar CRM adapter (Zentallio's own CRM, built on Frappe).
 *
 * Pushes qualified leads into Radar via the Frappe REST API. No-op stub until
 * the env vars are set, so the whole pipeline runs in dev without Radar:
 *
 *   RADAR_URL              e.g. https://radar.zentallio.com
 *   RADAR_API_KEY          Frappe API key
 *   RADAR_API_SECRET       Frappe API secret
 *   RADAR_LEAD_DOCTYPE     target DocType (default "Lead")
 *
 * Frappe REST: POST {RADAR_URL}/api/resource/{DocType}
 *   headers: Authorization: token <key>:<secret>
 *
 * NOTE (Phase C): confirm the real DocType + field names in Radar and adjust
 * mapToRadar() below. Field names here are placeholders/guesses.
 */
const URL = process.env.RADAR_URL;
const KEY = process.env.RADAR_API_KEY;
const SECRET = process.env.RADAR_API_SECRET;
const DOCTYPE = process.env.RADAR_LEAD_DOCTYPE || "Lead";

function enabled() {
  return Boolean(URL && KEY && SECRET);
}

// Map Iris's lead record → Radar DocType fields. TODO(Phase C): confirm names.
function mapToRadar(lead) {
  return {
    lead_name: lead.name || (lead.email ? lead.email.split("@")[0] : "Website visitor"),
    email_id: lead.email || undefined,
    company_name: lead.company || undefined,
    source: "Website · Ask Iris",
    // custom fields (rename to match Radar):
    custom_sector: lead.sector || undefined,
    custom_locations: lead.locations != null ? String(lead.locations) : undefined,
    custom_score: lead.score,
    custom_tier: lead.tier,
    custom_timeline: lead.timeline || undefined,
    custom_stage: lead.stage,
    custom_web_lead_id: lead.id,
    notes: lead.recommendedNext || undefined,
  };
}

async function upsertLead(lead) {
  if (!enabled()) {
    console.log("[radar] (stub) would upsert lead", lead.id, "tier=" + lead.tier, "score=" + lead.score);
    return { ok: false, stub: true };
  }
  try {
    const r = await fetch(`${URL}/api/resource/${encodeURIComponent(DOCTYPE)}`, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `token ${KEY}:${SECRET}` },
      body: JSON.stringify(mapToRadar(lead)),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error("radar_" + r.status + "_" + JSON.stringify(j).slice(0, 160));
    return { ok: true, name: j.data && j.data.name };
  } catch (e) {
    console.error("[radar] upsert failed:", e.message);
    return { ok: false, error: e.message };
  }
}

module.exports = { enabled, upsertLead, mapToRadar };
