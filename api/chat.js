/**
 * AI booking assistant.
 *
 * With ANTHROPIC_API_KEY set, this drives a real Claude tool-use loop
 * (get_availability + create_booking). Without a key it falls back to a
 * deterministic scripted assistant so the flow still works end-to-end.
 *
 * Request:  { messages: [{ role: "user"|"assistant", content: "..." }], state?: {} }
 * Response: { reply: "...", booking: {...}|null, state: {} }
 */
const core = require("../lib/booking-core");

const MODEL = process.env.BOOKING_MODEL || "claude-sonnet-5";
const API_KEY = process.env.ANTHROPIC_API_KEY;

const SYSTEM = [
  "You are Iris, Zentallio's friendly booking assistant. Your only job is to book a walkthrough or a call with a consultant.",
  "Collect, in a natural conversation: (1) whether they want a 'walkthrough' or a 'call', (2) their email, (3) a preferred day and time.",
  "Use get_availability to show real options before asking them to pick a time. Confirm the details back to them, then use create_booking.",
  "After booking, give them the confirmation clearly. Keep replies short and warm. Never invent times — only offer slots from get_availability.",
].join(" ");

const TOOLS = [
  {
    name: "get_availability",
    description: "List available days and time slots for a booking. Call before offering times.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "create_booking",
    description: "Create the booking once email, day, time and type are known.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["walkthrough", "call"] },
        email: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD from get_availability" },
        time: { type: "string", description: "HH:MM from get_availability" },
        name: { type: "string" },
        notes: { type: "string" },
      },
      required: ["type", "email", "date", "time"],
      additionalProperties: false,
    },
  },
];

function runTool(name, input) {
  if (name === "get_availability") return core.getAvailability();
  if (name === "create_booking") return core.createBooking(input || {});
  return { error: "unknown_tool" };
}

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body) return resolve(typeof req.body === "string" ? parse(req.body) : req.body);
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => resolve(parse(raw)));
    req.on("error", () => resolve({}));
  });
}
const parse = (s) => {
  try {
    return JSON.parse(s || "{}");
  } catch (e) {
    return {};
  }
};

async function callClaude(messages) {
  const body = { model: MODEL, max_tokens: 1024, system: SYSTEM, tools: TOOLS, messages };
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("anthropic_" + r.status);
  return r.json();
}

async function aiTurn(history) {
  // history: [{role, content(text)}]. Build Anthropic messages and run the tool loop.
  const messages = history.map((m) => ({ role: m.role, content: m.content }));
  let booking = null;
  for (let hop = 0; hop < 6; hop++) {
    const resp = await callClaude(messages);
    if (resp.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: resp.content });
      const results = [];
      for (const block of resp.content) {
        if (block.type === "tool_use") {
          const out = runTool(block.name, block.input);
          if (block.name === "create_booking" && out.ok) booking = out;
          results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(out) });
        }
      }
      messages.push({ role: "user", content: results });
      continue;
    }
    const text = (resp.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return { reply: text || "…", booking };
  }
  return { reply: "Sorry, I got stuck — try the quick form instead.", booking };
}

/* ---- deterministic fallback (no API key) ---- */
function mockTurn(history, state) {
  state = state || {};
  const lastUser = [...history].reverse().find((m) => m.role === "user");
  const text = (lastUser && lastUser.content) || "";
  const lower = text.toLowerCase();

  if (!state.type) {
    if (/walk|demo|tour/.test(lower)) state.type = "walkthrough";
    else if (/call|consult|talk|speak/.test(lower)) state.type = "call";
  }
  const emailMatch = text.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
  if (emailMatch && core.isValidEmail(emailMatch[0])) state.email = emailMatch[0];
  const timeMatch = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (timeMatch) state.time = timeMatch[0].padStart(5, "0");
  const dateMatch = text.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (dateMatch) state.date = dateMatch[0];

  if (!state.type)
    return { reply: "Happy to help you book! Would you like a walkthrough or a call with a consultant?", booking: null, state };
  if (!state.email)
    return { reply: `Great — a ${state.type} it is. What's the best email to send the invite to?`, booking: null, state };
  if (!state.date || !state.time) {
    const av = core.getAvailability();
    const opts = av.days
      .slice(0, 3)
      .map((d) => `• ${d.label} (${d.date}) — ${d.slots.slice(0, 4).join(", ")}…`)
      .join("\n");
    return {
      reply: `Thanks! Here are some openings (${av.timezone}). Reply with a date (YYYY-MM-DD) and time (HH:MM):\n${opts}`,
      booking: null,
      state,
    };
  }
  const booking = core.createBooking(state);
  return { reply: booking.ok ? booking.message : booking.message, booking: booking.ok ? booking : null, state };
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  const body = await readBody(req);
  const history = Array.isArray(body.messages) ? body.messages : [];
  try {
    if (API_KEY) {
      const out = await aiTurn(history);
      return res.status(200).json({ ...out, state: body.state || {} });
    }
    return res.status(200).json(mockTurn(history, body.state));
  } catch (e) {
    // On any AI error, degrade to the scripted assistant so booking still works.
    return res.status(200).json(mockTurn(history, body.state));
  }
};
