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
const kb = require("../lib/iris-knowledge");

const MODEL = process.env.BOOKING_MODEL || "claude-sonnet-5";
const API_KEY = process.env.ANTHROPIC_API_KEY;

const SYSTEM = [
  "You are Iris, Zentallio's AI guide on its website. You help visitors understand Zentallio and, when they're interested, get them to a walkthrough or a call with a consultant.",
  "",
  "ROLE & POSTURE:",
  "- Be a helpful, consultative guide first — genuinely answer questions about sectors, solutions, how it works, implementation, buying, support, pricing and the company.",
  "- Warm, concise, confident. Short paragraphs. When useful, ask one clarifying question (e.g. their sector or size) to tailor the answer.",
  "- When a visitor shows buying intent (asks about price, a demo, timelines, 'how do we start'), offer to book a walkthrough or a call, and capture their details.",
  "",
  "GROUNDING RULES (important):",
  "- Answer ONLY from the KNOWLEDGE BASE below. Do NOT invent facts, numbers, prices, timelines, integrations, customers, or claims.",
  "- Pricing: follow the pricing policy exactly — describe the model, never quote specific numbers, and route to a call for a quote.",
  "- If something isn't in the knowledge base, say so plainly and offer to connect them with a consultant. Never guess.",
  "",
  "TOOLS:",
  "- capture_lead: when you learn a visitor's details (name/email/company/sector/interest), record them. Do this before or alongside booking.",
  "- get_availability + create_booking: to book. Ask the visitor's timezone (default Asia/Karachi/PKT). Only offer slots returned by get_availability; when booking, pass the chosen slot's exact ISO `start` and the same `timezone`.",
  "",
  "KNOWLEDGE BASE:",
  kb.knowledge,
].join("\n");

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
    name: "capture_lead",
    description: "Record an interested visitor's details as a lead. Call as soon as you learn them, even before booking.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        email: { type: "string" },
        company: { type: "string" },
        sector: { type: "string", description: "e.g. 'casual dining', 'apparel retail'" },
        interest: { type: "string", description: "what they're looking for / their need" },
      },
      required: ["email"],
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
        notes: { type: "string", description: "Include company, sector and interest here so they ride along with the booking" },
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
  if (name === "capture_lead") {
    // Leads surface in the service logs and ride along with the booking notes.
    // (Wire a CRM/email/webhook here later — see BOOKING.md.)
    console.log("[lead]", JSON.stringify({ ...input, at: new Date().toISOString() }));
    return { ok: true, captured: true };
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

  if (!state.type)
    return {
      reply:
        "Happy to help! I can point you to the right sectors and solutions, and the quickest way to get your questions answered on your own numbers is a short walkthrough or a call with a consultant. Which would you like — a walkthrough or a call?",
      booking: null,
      state,
    };
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
