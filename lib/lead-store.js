/**
 * Lead store — server-side persistence for the Iris pre-sales agent.
 *
 * Keyed by a lead id the browser holds (localStorage) and sends with each
 * /api/chat call, so Iris remembers a visitor across turns and return visits.
 * In-memory primary + best-effort JSON on disk (LEAD_STORE_DIR, default a temp
 * dir; the server's filesystem is read-only except temp/ReadWritePaths). Radar
 * (Frappe) is the eventual system of record — this is the working cache.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const DIR = process.env.LEAD_STORE_DIR || path.join(os.tmpdir(), "zentallio-leads");
let diskOk = false;
try {
  fs.mkdirSync(DIR, { recursive: true });
  diskOk = true;
} catch (e) {
  console.warn("[lead-store] disk persistence off (in-memory only):", e.message);
}

const mem = new Map();

function newId() {
  return "lead_" + crypto.randomBytes(9).toString("hex");
}
function fileFor(id) {
  return path.join(DIR, String(id).replace(/[^a-z0-9_]/gi, "") + ".json");
}
function blank(id) {
  return {
    id,
    createdAt: new Date().toISOString(),
    updatedAt: null,
    stage: "engage", // engage → qualify → educate → demonstrate → pricing → convert → handoff
    score: 0,
    tier: "cold", // cold | warm | hot
    name: null,
    email: null,
    company: null,
    sector: null,
    subSector: null,
    locations: null,
    role: null,
    authority: null, // decision_maker | influencer | researcher | unknown
    timeline: null, // now | this_quarter | this_year | exploring | unknown
    region: null,
    painPoints: [],
    interests: [],
    flags: {}, // askedPricing, askedDemo, booked, …
    recommendedNext: null,
    handoff: { status: "none" }, // none | queued | done
  };
}
function load(id) {
  if (mem.has(id)) return mem.get(id);
  if (diskOk) {
    try {
      const d = JSON.parse(fs.readFileSync(fileFor(id), "utf8"));
      mem.set(id, d);
      return d;
    } catch (e) {}
  }
  return null;
}
function save(lead) {
  mem.set(lead.id, lead);
  if (diskOk) {
    try {
      fs.writeFileSync(fileFor(lead.id), JSON.stringify(lead));
    } catch (e) {}
  }
}

function get(id) {
  return id ? load(id) : null;
}

/** Merge a partial patch into a lead (arrays union, flags shallow-merge). */
function upsert(id, patch) {
  id = id || newId();
  const lead = load(id) || blank(id);
  patch = patch || {};
  for (const k in patch) {
    const v = patch[k];
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      lead[k] = Array.from(new Set([...(lead[k] || []), ...v.map((x) => String(x))]));
    } else if (k === "flags" && typeof v === "object") {
      lead.flags = Object.assign({}, lead.flags, v);
    } else if (k === "handoff" && typeof v === "object") {
      lead.handoff = Object.assign({}, lead.handoff, v);
    } else {
      lead[k] = v;
    }
  }
  lead.updatedAt = new Date().toISOString();
  save(lead);
  return lead;
}

module.exports = { newId, get, upsert, blank, _dir: DIR, _diskOk: () => diskOk };
