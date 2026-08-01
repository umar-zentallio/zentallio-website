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
  "Collect, in a natural conversation: (1) whether they want a 'walkthrough' or a 'call', (2) their email, (3) a preferred slot.",
  "Ask the visitor which timezone they're in (default Asia/Karachi / PKT if they don't say). Call get_availability with that timezone to show real options, then confirm and call create_booking.",
  "When calling create_booking, pass the chosen slot's exact `start` value (the ISO instant from get_availability) and the same `timezone`. Never invent times — only offer slots from get_availability. Keep replies short and warm.",
].join(" ");

const TOOLS = [
  {
    name: "get_availability",
    description: "List available booking slots. Returns each slot's absolute `start` (ISO) plus a human `label` in the given timezone. Call before offering times.",
    input_schema: {
      type: "object",
      properties: { timezone: { type: "string", description: "IANA timezone to label slots in, e.g. 'Europe/London'. Defaults to Asia/Karachi." } },
      additionalProperties: false,
    },
  },
  {
    name: "create_booking",
    description: "Create the booking once type, email, slot and timezone are known.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["walkthrough", "call"] },
        email: { type: "string" },
        start: { type: "string", description: "The chosen slot's exact ISO `start` from get_availability" },
        timezone: { type: "string", description: "The visitor's IANA timezone (e.g. 'Europe/London'), default 'Asia/Karachi'" },
        name: { type: "string" },
        notes: { type: "string" },
      },
      required: ["type", "email", "start"],
      additionalProperties: false,
    },
  },
];

async function runTool(name, input) {
  input = input || {};
  if (name === "get_availability") {
    const tz = input.timezone || core.TZ_DEFAULT;
    const av = await core.getAvailability();
    return {
      timezone: tz,
      slots: (av.slots || []).slice(0, 12).map((iso) => {
        const f = core.formatSlot(iso, tz);
        return { start: iso, label: `${f.dayLabel} ${f.time}` };
      }),
    };
  }
  if (name === "create_booking") {
    return core.createBooking({ type: input.type, email: input.email, start: input.start, tz: input.timezone, name: input.name, notes: input.notes });
  }
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
          const out = await runTool(block.name, block.input);
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
async function mockTurn(history, state) {
  state = state || {};
  const tz = state.tz || core.TZ_DEFAULT;
  const lastUser = [...history].reverse().find((m) => m.role === "user");
  const text = (lastUser && lastUser.content) || "";
  const lower = text.toLowerCase();

  if (!state.type) {
    if (/walk|demo|tour/.test(lower)) state.type = "walkthrough";
    else if (/call|consult|talk|speak/.test(lower)) state.type = "call";
  }
  const emailMatch = text.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
  if (emailMatch) {
    const addr = emailMatch[0].replace(/[.,;:!?)\]]+$/, ""); // drop trailing punctuation
    if (core.isValidEmail(addr)) state.email = addr;
  }

  if (!state.type) return { reply: "Happy to help you book! Would you like a walkthrough or a call with a consultant?", booking: null, state };
  if (!state.email) return { reply: `Great — a ${state.type} it is. What's the best email to send the invite to?`, booking: null, state };

  // Offer numbered slots, then book the one they pick.
  if (!state.offered) {
    const av = await core.getAvailability();
    state.offered = (av.slots || []).slice(0, 6);
    const list = state.offered.map((iso, i) => { const f = core.formatSlot(iso, tz); return `${i + 1}. ${f.dayLabel} ${f.time}`; }).join("\n");
    return {
      reply: `Thanks! Here are the next openings (times in PKT — use the Quick form to pick another timezone). Reply with a number 1–${state.offered.length}:\n${list}`,
      booking: null,
      state,
    };
  }
  const numMatch = text.match(/\b([1-9])\b/);
  if (numMatch) {
    const iso = state.offered[parseInt(numMatch[1], 10) - 1];
    if (iso) {
      const booking = await core.createBooking({ type: state.type, email: state.email, start: iso, tz });
      return { reply: booking.message, booking: booking.ok ? booking : null, state };
    }
  }
  return { reply: `Please reply with a number 1–${state.offered.length}, or open the Quick form to choose a day, time and timezone.`, booking: null, state };
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
    return res.status(200).json(await mockTurn(history, body.state));
  } catch (e) {
    // On any AI error, degrade to the scripted assistant so booking still works.
    return res.status(200).json(await mockTurn(history, body.state));
  }
};
