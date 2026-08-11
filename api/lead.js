const crypto = require("crypto");

const SHEET_ID = process.env.GOOGLE_SHEET_ID || "1am5C51B_lfQIWp1aGdhYCxXpXobhD2GAn_1IVYStHdU";
const SHEET_TAB = process.env.GOOGLE_SHEET_NAME || "Sheet1";
const SA_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const SA_KEY = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "").replace(/\\n/g, "\n");

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
function base64url(input) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: SA_EMAIL,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const unsigned = `${header}.${claims}`;
  const signature = crypto.createSign("RSA-SHA256").update(unsigned).sign(SA_KEY, "base64");
  const jwt = `${unsigned}.${signature.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!r.ok) throw new Error("token_exchange_failed");
  const data = await r.json();
  return data.access_token;
}

async function appendRow(token, row) {
  const range = encodeURIComponent(`${SHEET_TAB}!A:F`);
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [row] }),
    }
  );
  if (!r.ok) throw new Error("sheet_append_failed: " + (await r.text()));
}

async function ensureHeader(token) {
  const range = encodeURIComponent(`${SHEET_TAB}!A1:F1`);
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return;
  const data = await r.json();
  if (!data.values || !data.values.length) {
    await appendRow(token, ["Timestamp", "Name", "Email", "Company", "Message", "Page"]);
  }
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  const body = await readBody(req);
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim();
  const company = String(body.company || "").trim();
  const message = String(body.message || "").trim();

  if (!name || !message) return res.status(400).json({ error: "missing_fields" });
  if (!SA_EMAIL || !SA_KEY) return res.status(500).json({ error: "sheet_not_configured" });

  try {
    const token = await getAccessToken();
    await ensureHeader(token);
    await appendRow(token, [new Date().toISOString(), name, email, company, message, req.headers.referer || ""]);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(502).json({ error: "sheet_write_failed" });
  }
};
