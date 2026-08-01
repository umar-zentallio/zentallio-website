const { createBooking } = require("../lib/booking-core");

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

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  const body = await readBody(req);
  const result = await createBooking({
    name: body.name,
    email: body.email,
    start: body.start, // absolute instant (ISO)
    tz: body.tz, // visitor's IANA timezone
    type: body.type,
    notes: body.notes,
  });
  const code = result.ok ? 200 : result.error === "scheduler_error" ? 502 : 400;
  res.status(code).json(result);
};
