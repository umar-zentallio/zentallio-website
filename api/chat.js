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
const leadStore = require("../lib/lead-store");
const { scoreLead } = require("../lib/lead-scoring");
const radar = require("../lib/radar-crm");
const handoff = require("../lib/handoff");

const MODEL = process.env.BOOKING_MODEL || "claude-sonnet-5";
const API_KEY = process.env.ANTHROPIC_API_KEY;

const SYSTEM_BASE = [
  "You are Iris, Zentallio's autonomous pre-sales agent on its website. Your job is to run a visitor through the pre-sales cycle — understand them, educate them, and get a qualified, sales-ready lead booked with a consultant — then hand off to a human.",
  "",
  "ROLE & POSTURE:",
  "- Be a helpful, consultative guide first — genuinely answer questions about sectors, solutions, how it works, implementation, buying, support, pricing and the company.",
  "- Warm, concise, confident. Short paragraphs. Weave ONE qualifying question at a time into your helpful answers — never interrogate.",
  "",
  "PRE-SALES STAGES — move the lead through these and set `stage` via capture_lead as you progress:",
  "1) engage — understand why they're here.",
  "2) qualify — learn their sector, number of locations/outlets, their role & authority, main pain point, and timeline. Persist each via capture_lead.",
  "3) educate — map their pain to the right solutions; answer, grounded in the KB.",
  "4) demonstrate — offer a walkthrough and point them to a relevant resource.",
  "5) pricing — give illustrative pricing + ROI framing; handle objections.",
  "6) convert — capture full details and book a walkthrough/call.",
  "7) handoff — once booked (or clearly hot, or when the visitor wants a person), hand the lead to a human via request_human and confirm a consultant will follow up.",
  "You may move back and forth; qualification and education usually interleave.",
  "",
  "QUALIFYING & SCORING:",
  "- capture_lead scores the lead (fit + intent) and returns a tier: cold, warm, or hot.",
  "- warm/hot → actively steer toward booking a walkthrough or call. cold/early → keep educating and building interest before pushing.",
  "- Set flags via capture_lead when they happen: askedPricing, askedDemo.",
  "",
  "GROUNDING RULES (important):",
  "- Answer ONLY from the KNOWLEDGE BASE below. Do NOT invent facts, numbers, prices, timelines, integrations, customers, or claims.",
  "- Pricing: follow the pricing policy in the knowledge base — you may share the illustrative ranges it lists (always framed as illustrative), and route to a consultant for a firm quote.",
  "",
  "WHEN YOU DON'T HAVE THE ANSWER (important):",
  "- Never dead-end with just 'I can't find that.' If the KB doesn't cover something (a specific integration, SLA, timeline, contractual/technical detail), briefly say you want to get them an accurate answer, then PROACTIVELY offer a quick call with a consultant who can confirm it for their exact setup — capture their name + work email (capture_lead), or book it.",
  "- Always convert an unknown into a next step, framed as 'the fastest way to a precise answer.'",
  "",
  "HANDOFF (important):",
  "- Call request_human when: the visitor asks to talk to a person; a lead is hot/ready-to-buy; right after a booking (so a consultant is briefed to follow up); or a question genuinely needs a human expert. You need at least a work email first — capture it with capture_lead before handing off.",
  "- request_human notifies the team and files the lead in our CRM with a full brief. After it succeeds, reassure the visitor in plain language that a consultant will follow up (don't mention CRMs or tools).",
  "",
  "TOOLS:",
  "- capture_lead: persist ANY detail you learn (name, email, company, sector, locations, role, authority, timeline, painPoints, interests), set flags, and set the current `stage`. Call it whenever you learn something new; it scores the lead and returns the tier.",
  "- get_availability + create_booking: to book. Ask the visitor's timezone (default Asia/Karachi/PKT). Only offer slots from get_availability; when booking, pass the chosen slot's exact ISO `start` and the same `timezone`.",
  "- request_human: hand a qualified lead to a human consultant (see HANDOFF above). Requires an email on file.",
  "",
  "KNOWLEDGE BASE:",
  kb.knowledge,
].join("\n");

function summarizeLead(lead) {
  if (!lead) return {};
  return {
    stage: lead.stage, score: lead.score, tier: lead.tier,
    name: lead.name, email: lead.email, company: lead.company,
    sector: lead.sector, locations: lead.locations, role: lead.role,
    authority: lead.authority, timeline: lead.timeline,
    painPoints: lead.painPoints, interests: lead.interests, flags: lead.flags,
    handoff: lead.handoff && lead.handoff.status ? lead.handoff.status : undefined,
  };
}

function buildSystem(lead) {
  return (
    SYSTEM_BASE +
    "\n\nCURRENT LEAD (server-tracked — do not re-ask what's already known; advance `stage` and call capture_lead as you learn more):\n" +
    JSON.stringify(summarizeLead(lead))
  );
}

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
    description: "Persist any detail you learn about the visitor and advance the pre-sales stage. Call whenever you learn something new (not just email). Returns the updated score, tier and stage.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        email: { type: "string" },
        company: { type: "string" },
        sector: { type: "string", description: "e.g. 'casual dining', 'apparel retail'" },
        subSector: { type: "string" },
        locations: { type: "string", description: "number of outlets/locations, e.g. '12'" },
        role: { type: "string", description: "their job title/role" },
        authority: { type: "string", enum: ["decision_maker", "influencer", "researcher", "unknown"] },
        timeline: { type: "string", enum: ["now", "this_quarter", "this_year", "exploring", "unknown"] },
        region: { type: "string" },
        painPoints: { type: "array", items: { type: "string" } },
        interests: { type: "array", items: { type: "string" }, description: "solutions/topics they're interested in" },
        flags: {
          type: "object",
          description: "set booleans as they happen",
          properties: { askedPricing: { type: "boolean" }, askedDemo: { type: "boolean" } },
          additionalProperties: true,
        },
        stage: { type: "string", enum: ["engage", "qualify", "educate", "demonstrate", "pricing", "convert", "handoff"] },
      },
      required: [],
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
  {
    name: "request_human",
    description:
      "Hand the lead off to a human consultant: files the lead in the CRM with a full sales brief and alerts the team. Call when the visitor asks for a person, when a hot/ready-to-buy lead should be picked up, right after a booking, or when a question needs a human expert. Requires an email on file — capture it first.",
    input_schema: {
      type: "object",
      properties: {
        reason: { type: "string", description: "one line on why you're handing off" },
        urgency: { type: "string", enum: ["standard", "hot"], description: "'hot' = ready-to-buy / high intent, pick up ASAP" },
        summary: { type: "string", description: "your own 1–2 sentence summary of the lead and what they need" },
      },
      required: ["reason"],
      additionalProperties: false,
    },
  },
];

// Rescore + persist, then mirror the lead into Radar (fire-and-forget).
function rescoreAndSync(leadId, patch) {
  let lead = leadStore.upsert(leadId, patch);
  const { score, tier } = scoreLead(lead);
  lead = leadStore.upsert(leadId, { score, tier });
  radar.upsertLead(lead).catch(() => {});
  return lead;
}

// Hand the lead to a human once (idempotent on handoff status): build a brief,
// file it in Radar with an alert, and mark the lead handed off.
async function doHandoff(leadId, reason, urgency, summary) {
  let lead = leadStore.get(leadId);
  if (!lead || !lead.email) return { ok: false, need: "email" };
  if (lead.handoff && lead.handoff.status === "sent") return { ok: true, already: true };
  lead = leadStore.upsert(leadId, {
    stage: "handoff",
    recommendedNext: summary || lead.recommendedNext,
    handoff: { status: "requested", reason, urgency: urgency || "standard", summary },
  });
  const { score, tier } = scoreLead(lead);
  lead = leadStore.upsert(leadId, { score, tier });
  const brief = handoff.buildBrief(lead, reason || "qualified lead", urgency || "standard");
  const r = await radar.handoff(lead, brief.html).catch((e) => ({ ok: false, error: e.message }));
  const n = await handoff.notify(brief).catch(() => ({ webhook: false }));
  leadStore.upsert(leadId, { handoff: { status: "sent" } });
  return { ok: true, radar: r && r.ok ? r.name : null, alerted: !!(n && n.webhook) };
}

async function runTool(name, input, ctx) {
  input = input || {};
  ctx = ctx || {};
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
    const lead = rescoreAndSync(ctx.leadId, input);
    return { ok: true, stage: lead.stage, score: lead.score, tier: lead.tier };
  }
  if (name === "create_booking") {
    const out = await core.createBooking({ type: input.type, email: input.email, start: input.start, tz: input.timezone, name: input.name, notes: input.notes });
    if (out.ok) {
      rescoreAndSync(ctx.leadId, { stage: "convert", email: input.email, name: input.name, flags: { booked: true } });
      // a booked walkthrough is a handoff-worthy event — brief the team automatically
      await doHandoff(ctx.leadId, "walkthrough booked", "hot", "Booked a walkthrough via Ask Iris.").catch(() => {});
    }
    return out;
  }
  if (name === "request_human") {
    const r = await doHandoff(ctx.leadId, input.reason, input.urgency, input.summary);
    if (!r.ok && r.need === "email") {
      return { ok: false, need: "email", message: "I just need a work email so a consultant can reach you — what's the best one?" };
    }
    return { ok: true, handoff: true, message: "A consultant will follow up shortly." };
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

async function callClaude(messages, system) {
  const body = { model: MODEL, max_tokens: 1024, system: system, tools: TOOLS, messages };
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

async function aiTurn(history, ctx) {
  // history: [{role, content(text)}]. Build Anthropic messages and run the tool loop.
  const messages = history.map((m) => ({ role: m.role, content: m.content }));
  const system = buildSystem(leadStore.get(ctx.leadId));
  let booking = null;
  for (let hop = 0; hop < 6; hop++) {
    const resp = await callClaude(messages, system);
    if (resp.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: resp.content });
      const results = [];
      for (const block of resp.content) {
        if (block.type === "tool_use") {
          const out = await runTool(block.name, block.input, ctx);
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

  if (/walk|demo|tour/.test(lower)) state.type = "walkthrough";
  else if (/call|consult|talk|speak/.test(lower)) state.type = "call";
  const emailMatch = text.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
  if (emailMatch) {
    const addr = emailMatch[0].replace(/[.,;:!?)\]]+$/, ""); // drop trailing punctuation
    if (core.isValidEmail(addr)) state.email = addr;
  }

  // The scripted fallback has no knowledge base — it can only route to a human
  // or take a booking. If the visitor is clearly asking for information (not
  // giving an email or picking a slot), be honest and helpful instead of
  // looping on the email question.
  const slotNum = /^\s*[1-9]\s*$/.test(text.trim());

  // A plain greeting should get a greeting — not an abrupt jump to the email
  // ask, even if a booking CTA pre-seeded the type.
  if (!state.email && !slotNum && /^\s*(hi+|hey+|hello+|yo|salaam|assalam\w*|hola|good (morning|afternoon|evening))\b[\s!.]*$/.test(lower)) {
    return {
      reply:
        "Hi! I'm Iris. I can walk you through what Zentallio does for Food & Beverage and Fashion retail, how it works, and how pricing is shaped — or set up a walkthrough or a call whenever you're ready. What would you like to explore?",
      booking: null,
      state,
    };
  }

  const wantsInfo =
    !emailMatch && !slotNum && !state.offered &&
    /\b(info|information|questions?|ask|tell me|explain|what|whats|how|why|which|where|who|pricing|price|cost|sectors?|solutions?|features?|integrat\w*|support|help|difference|dashboard)\b/.test(lower);
  if (wantsInfo) {
    return {
      reply:
        "Happy to help. Our live assistant is briefly unavailable, so I'm in a limited mode right now — the fastest way to get precise answers on your own setup is a short walkthrough or a quick call with one of our consultants. Want me to set one up? Just say “walkthrough” or “call” and share your work email. Or you can email us any time at info@zentallio.com.",
      booking: null,
      state,
    };
  }

  if (!state.type)
    return {
      reply:
        "Happy to help! I can point you to the right sectors and solutions, and the quickest way to get your questions answered on your own numbers is a short walkthrough or a call with a consultant. Which would you like — a walkthrough or a call?",
      booking: null,
      state,
    };
  if (!state.email) return { reply: `Great — a ${state.type} it is. What's the best email to send the invite to? (Or tell me what you'd like to know.)`, booking: null, state };

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
  const leadId = body.leadId || leadStore.newId(); // browser holds this across turns/visits
  if (!API_KEY) {
    console.warn("[chat] no ANTHROPIC_API_KEY — using scripted fallback (set it in .env / api.env to enable the AI)");
    return res.status(200).json({ ...(await mockTurn(history, body.state)), leadId });
  }
  try {
    const out = await aiTurn(history, { leadId });
    return res.status(200).json({ ...out, state: body.state || {}, leadId, lead: summarizeLead(leadStore.get(leadId)) });
  } catch (e) {
    // Make the reason visible, then degrade to the scripted assistant so booking still works.
    console.error("[chat] AI call failed, falling back to scripted flow:", (e && e.message) || e, "(a 401 usually means the ANTHROPIC_API_KEY is invalid or revoked)");
    return res.status(200).json({ ...(await mockTurn(history, body.state)), leadId });
  }
};
