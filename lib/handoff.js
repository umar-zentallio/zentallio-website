/**
 * Human handoff — turns a qualified Iris lead into a sales-ready brief and
 * alerts the team.
 *
 * The brief is rendered two ways: HTML for the Radar CRM timeline, and plain
 * text for a chat webhook (Slack-compatible `{text}` payload). The alert
 * channel is optional and pluggable:
 *
 *   HANDOFF_WEBHOOK_URL   e.g. a Slack incoming-webhook URL. If unset, the
 *                         Radar lead + timeline brief is the alert (a rep sees
 *                         it in Radar's "Hot leads / ready to call" view).
 */
function line(k, v) {
  if (v == null || v === "" || (Array.isArray(v) && !v.length)) return null;
  return { k, v: Array.isArray(v) ? v.join(", ") : String(v) };
}

function rows(lead, reason, urgency) {
  const f = lead.flags || {};
  return [
    line("Reason", reason),
    line("Urgency", urgency === "hot" ? "🔥 HOT — pick up ASAP" : "standard"),
    line("Score", lead.score != null ? `${lead.score}/100 (${lead.tier || "cold"})` : null),
    line("Name", lead.name),
    line("Email", lead.email),
    line("Company", lead.company),
    line("Role", lead.role),
    line("Authority", lead.authority),
    line("Sector", lead.sector),
    line("Sub-sector", lead.subSector),
    line("Locations", lead.locations),
    line("Timeline", lead.timeline),
    line("Region", lead.region),
    line("Pain points", lead.painPoints),
    line("Interests", lead.interests),
    line("Asked pricing", f.askedPricing ? "yes" : null),
    line("Booked walkthrough", f.booked ? "yes" : null),
    line("Recommended next", lead.recommendedNext),
    line("Web lead id", lead.id),
  ].filter(Boolean);
}

function buildBrief(lead, reason, urgency) {
  const r = rows(lead, reason, urgency);
  const title = "Ask Iris — lead ready for a human";
  const html =
    `<b>${title}</b><ul>` +
    r.map((x) => `<li><b>${x.k}:</b> ${x.v}</li>`).join("") +
    `</ul>`;
  const text = `*${title}*\n` + r.map((x) => `• ${x.k}: ${x.v}`).join("\n");
  const subject = `${urgency === "hot" ? "🔥 Hot lead" : "New lead"} — ${lead.company || lead.name || lead.email || "website visitor"}`;
  return { html, text, subject };
}

async function notify(brief) {
  const url = process.env.HANDOFF_WEBHOOK_URL;
  if (!url) return { webhook: false };
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: `${brief.subject}\n\n${brief.text}` }),
    });
    return { webhook: r.ok };
  } catch (e) {
    return { webhook: false, error: e.message };
  }
}

module.exports = { buildBrief, notify };
