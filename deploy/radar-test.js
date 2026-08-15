#!/usr/bin/env node
/**
 * Radar CRM connectivity + upsert test.
 *
 * Run on the server (or any machine with open internet — the site's build
 * environment blocks pm.lucrumerp.com). It verifies the Frappe REST auth and,
 * optionally, pushes a real test lead through the same adapter the app uses.
 *
 *   export RADAR_URL='https://pm.lucrumerp.com'
 *   export RADAR_API_KEY='...'
 *   export RADAR_API_SECRET='...'
 *
 *   node deploy/radar-test.js                     # read-only: verify auth + read CRM Lead
 *   node deploy/radar-test.js --create you@x.com  # ALSO create/upsert a real test lead
 *
 * ⚠️ --create writes a real lead into the Radar pipeline. Use a throwaway email
 *    and delete it from Radar afterwards.
 */
const URL = (process.env.RADAR_URL || "").replace(/\/+$/, "");
const KEY = process.env.RADAR_API_KEY;
const SECRET = process.env.RADAR_API_SECRET;
const DOCTYPE = process.env.RADAR_LEAD_DOCTYPE || "CRM Lead";

if (!URL || !KEY || !SECRET) {
  console.error("Set RADAR_URL, RADAR_API_KEY and RADAR_API_SECRET first.");
  process.exit(1);
}
const headers = { "content-type": "application/json", Authorization: `token ${KEY}:${SECRET}` };

(async () => {
  // 1) read-only connectivity/auth check
  const q = `fields=${encodeURIComponent(JSON.stringify(["name", "lead_name", "status"]))}&limit_page_length=3`;
  const r = await fetch(`${URL}/api/resource/${encodeURIComponent(DOCTYPE)}?${q}`, { headers });
  const j = await r.json().catch(() => ({}));
  console.log(`GET ${DOCTYPE} -> HTTP ${r.status}`);
  if (!r.ok) {
    console.error("Auth/connectivity failed:", JSON.stringify(j).slice(0, 300));
    process.exit(1);
  }
  console.log("OK. Sample rows:", JSON.stringify(j.data, null, 2));

  // 2) optional real upsert through the app's own adapter
  const createIdx = process.argv.indexOf("--create");
  if (createIdx !== -1) {
    const email = process.argv[createIdx + 1];
    if (!email) {
      console.error("--create needs an email: node deploy/radar-test.js --create you@x.com");
      process.exit(1);
    }
    const radar = require("../lib/radar-crm");
    const lead = {
      id: "lead_test_" + Date.now(),
      name: "Radar Test (delete me)",
      email,
      company: "Zentallio QA",
      role: "QA",
      sector: "Food & Beverage",
      locations: 12,
      authority: "decision_maker",
      timeline: "quarter",
      painPoints: ["stockouts", "manual reconciliation"],
      interests: ["inventory", "POS"],
      flags: { askedPricing: true },
      score: 72,
      tier: "hot",
      stage: "qualify",
      recommendedNext: "book walkthrough",
    };
    console.log("\nUpserting test lead via lib/radar-crm.js ...");
    const out = await radar.upsertLead(lead);
    console.log("Result:", JSON.stringify(out, null, 2));
    if (out.ok) console.log(`\n➜ Open Radar and confirm CRM Lead "${out.name}" exists, then delete it.`);
  }
})().catch((e) => {
  console.error("test failed:", e.message);
  process.exit(1);
});
