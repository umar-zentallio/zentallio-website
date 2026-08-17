const newsletter = require("../lib/radar-newsletter");

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body) return resolve(typeof req.body === "string" ? safeParse(req.body) : req.body);
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => resolve(safeParse(raw)));
    req.on("error", () => resolve({}));
  });
}
function safeParse(s) {
  try {
    return JSON.parse(s || "{}");
  } catch (e) {
    return {};
  }
}

// Pragmatic email check — good enough to reject typos and junk without
// rejecting valid-but-unusual addresses.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  const body = await readBody(req);
  const email = String(body.email || "").trim().toLowerCase();

  if (!email || !EMAIL_RE.test(email) || email.length > 254) {
    return res.status(400).json({ ok: false, error: "invalid_email" });
  }

  const result = await newsletter.subscribe(email);

  // No Radar keys wired yet — accept the signup gracefully so the visitor
  // never sees an error, and log it for later reconciliation.
  if (result.disabled) {
    console.log("[subscribe] captured (Radar not configured):", email);
    return res.status(200).json({ ok: true, pending: true });
  }
  if (!result.ok) return res.status(502).json({ ok: false, error: "subscribe_failed" });

  return res.status(200).json({ ok: true, created: result.created });
};
