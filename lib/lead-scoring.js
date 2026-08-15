/**
 * Lead scoring for the Iris pre-sales agent — a transparent fit + intent
 * rubric that yields a 0–100 score and a cold/warm/hot tier. Tune the weights
 * here; the agent uses the tier to decide how hard to push a booking and when
 * to hand off to a human.
 */
function parseLocations(v) {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const m = String(v).match(/\d[\d,]*/);
  return m ? parseInt(m[0].replace(/,/g, ""), 10) : 0;
}

function scoreLead(lead) {
  lead = lead || {};
  let s = 0;
  const why = [];

  // --- Fit ---
  if (lead.sector) { s += 10; why.push("sector +10"); }
  const loc = parseLocations(lead.locations);
  if (loc >= 100) { s += 35; why.push("100+ locations +35"); }
  else if (loc >= 50) { s += 25; why.push("50–99 locations +25"); }
  else if (loc >= 10) { s += 15; why.push("10–49 locations +15"); }
  else if (loc >= 1) { s += 5; why.push("1–9 locations +5"); }
  if (lead.authority === "decision_maker") { s += 20; why.push("decision-maker +20"); }
  else if (lead.authority === "influencer") { s += 10; why.push("influencer +10"); }

  // --- Intent ---
  const t = lead.timeline;
  if (t === "now") { s += 20; why.push("timeline now +20"); }
  else if (t === "this_quarter") { s += 12; why.push("this quarter +12"); }
  else if (t === "this_year") { s += 6; why.push("this year +6"); }
  if (lead.email) { s += 15; why.push("gave email +15"); }
  const f = lead.flags || {};
  if (f.askedPricing) { s += 8; why.push("asked pricing +8"); }
  if (f.askedDemo) { s += 8; why.push("asked demo +8"); }
  if (f.booked) { s += 20; why.push("booked +20"); }

  s = Math.max(0, Math.min(100, s));
  const tier = s >= 70 ? "hot" : s >= 40 ? "warm" : "cold";
  return { score: s, tier, why };
}

module.exports = { scoreLead, parseLocations };
