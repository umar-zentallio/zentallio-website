# Iris — Facts to Confirm (kill hallucinations at the source)

**Why this exists.** Iris only invents things when it's asked something its
knowledge base doesn't cover. The fix isn't just prompt tuning — it's *filling
the gaps* with real facts. Every blank below that you fill in is one more thing
Iris answers correctly instead of guessing.

**How to use it.**
1. A team member who knows the real answer fills in each **"✅ The real answer:"** line. Write the truth, or write *"do not have this yet"* — both are useful.
2. Your developer moves each confirmed answer into the matching `knowledge/*.md` file (named in each section), then redeploys + restarts the API.
3. Anything you *don't* fill in stays a known gap — Iris uses the **"🛟 Until confirmed, Iris says…"** fallback for it (offer a consultant), which is safe. It just can't answer as precisely until the real fact is in.

> **The golden rule for Iris:** if a fact isn't in the knowledge base, Iris must **not** state it — it says it'll get a precise answer and offers a call. So the worst case for a blank below is "Iris is vague and books a call," never "Iris makes something up." Filling these in upgrades vague → precise.

---

## 1. Integrations — *the #1 hallucination risk*
> Feeds `knowledge/50-implementation-buying-support.md`

**Visitors ask:** "Does it integrate with QuickBooks / Xero / Tally?" · "Which POS do you support?" · "Do you connect to Foodpanda / Uber Eats / Deliveroo?" · "Can it pull from my ERP?"

- ✅ **POS systems supported:** _______________________________________________
- ✅ **Accounting / ERP supported (QuickBooks? Xero? SAP? Oracle? Tally?):** _______________________________________________
- ✅ **Delivery aggregators / marketplaces:** _______________________________________________
- ✅ **Payment providers:** _______________________________________________
- ✅ **How integration works (native connector / API / file import / built-in):** _______________________________________________

🛟 **Until confirmed, Iris says:** "I want to give you an accurate answer on that specific integration — the fastest way is a quick call with a consultant who can confirm it for your exact stack. Want me to set one up?"

---

## 2. Implementation & onboarding time
> Feeds `knowledge/50-implementation-buying-support.md`

**Visitors ask:** "How long to get live?" · "Who does the setup?" · "What do you need from us?"

- ✅ **Time to onboard one outlet:** _______________________________________________
- ✅ **Time to roll out a group / chain:** _______________________________________________
- ✅ **Who does the setup (Zentallio team / partner / self-serve):** _______________________________________________
- ✅ **What data / access you need from the customer:** _______________________________________________
- ✅ **"No hardware" — what that actually means:** _______________________________________________

🛟 **Until confirmed, Iris says:** the site framing (see it configured → walkthrough/pilot on one branch → roll out; configured demo in ~3–5 working days), then offers a consultant for exact timelines.

---

## 3. The pilot / trial
> Feeds `knowledge/50-implementation-buying-support.md`

**Visitors ask:** "Is there a trial?" · "How long is the pilot?" · "Does the pilot cost anything?" · "What counts as success?"

- ✅ **Pilot length:** _______________________________________________
- ✅ **Pilot scope (one branch? one sector? one module?):** _______________________________________________
- ✅ **Pilot cost (free / paid / credited):** _______________________________________________
- ✅ **Success criteria:** _______________________________________________

🛟 **Until confirmed, Iris says:** the site offers "a pilot on one branch, cancel anytime after"; a consultant can scope the specifics.

---

## 4. Support, SLA & reliability
> Feeds `knowledge/50-implementation-buying-support.md`

**Visitors ask:** "What support do we get?" · "What's your uptime?" · "Do you guarantee an SLA?" · "Is there training?"

- ✅ **Support channels (email / chat / phone / WhatsApp / account manager):** _______________________________________________
- ✅ **Support hours & timezone:** _______________________________________________
- ✅ **Response-time / SLA commitments (only if you actually offer one):** _______________________________________________
- ✅ **Uptime commitment (only if real — otherwise leave blank):** _______________________________________________
- ✅ **Onboarding & training offered:** _______________________________________________
- ✅ **Account management / customer-success model:** _______________________________________________

🛟 **Until confirmed, Iris says:** it'll have a consultant confirm support and reliability specifics — never quotes a number like "99.9% uptime" unless it's filled in here.

---

## 5. Security, data & compliance
> Feeds `knowledge/60-company-faq.md` (legal detail already lives on /privacy, /terms, /data-processing)

**Visitors ask:** "Where is our data hosted?" · "Are you GDPR compliant?" · "Do you have SOC 2 / ISO 27001?" · "Who owns the data?"

- ✅ **Where data is hosted (cloud provider / region):** _______________________________________________
- ✅ **Compliance / certifications you may state (GDPR? SOC 2? ISO 27001? PCI?):** _______________________________________________
- ✅ **Data ownership statement:** _______________________________________________
- ✅ **Anything Iris must route to legal pages instead of answering:** _______________________________________________

🛟 **Until confirmed, Iris says:** points to /privacy, /terms, /data-processing and offers a consultant for anything specific — never claims a certification you don't hold.

---

## 6. Customers, case studies & proof
> Feeds `knowledge/60-company-faq.md`  ·  **highest-risk for made-up names/stats**

**Visitors ask:** "Who uses this?" · "Any case studies?" · "Can I talk to a reference?" · "What results have customers seen?"

- ✅ **Customers / logos Iris may name (only ones cleared to mention publicly):** _______________________________________________
- ✅ **Case studies / results Iris may cite (with the real numbers):** _______________________________________________
- ✅ **Reference customers available on request? (yes/no + how):** _______________________________________________

🛟 **Until confirmed, Iris says:** it can arrange for a consultant to share relevant references/results — **never invents a customer name, logo, testimonial, or "X% improvement" stat.**

---

## 7. Company facts
> Feeds `knowledge/60-company-faq.md`

**Visitors ask:** "Who are you?" · "Where are you based?" · "How big is the team?" · "How long have you been around?"

- ✅ **One-line company description (Iris uses verbatim):** _______________________________________________
- ✅ **Founded year:** _______________________________________________
- ✅ **HQ / office locations (only what you want public):** _______________________________________________
- ✅ **Team size (only if you want it public):** _______________________________________________
- ✅ **Anything Iris should explicitly NOT discuss:** _______________________________________________

🛟 **Until confirmed, Iris says:** the confirmed site facts (AI Decision Platform for F&B and Fashion Retail; Iris + Numerus/Nexus/Motus/Manus; info@zentallio.com) and nothing beyond them.

---

## 8. Regions, languages & currencies
> Feeds `knowledge/60-company-faq.md` and `knowledge/40-pricing.md`

**Visitors ask:** "Do you operate in [country]?" · "Is it available in [language]?" · "Can we be billed in [currency]?"

- ✅ **Countries / regions served:** _______________________________________________
- ✅ **Languages supported:** _______________________________________________
- ✅ **Billing currencies:** _______________________________________________

🛟 **Until confirmed, Iris says:** it'll confirm availability for their region with a consultant.

---

## 9. Pricing specifics
> Feeds `knowledge/40-pricing.md` (illustrative ranges already exist there)

**Visitors ask:** "Exact price for X locations?" · "Is there a contract?" · "Setup fee?" · "Hardware cost?"

- ✅ **Anything that would make a firm quote possible without a call (or confirm: quote always needs a consultant):** _______________________________________________
- ✅ **Contract terms Iris may state (site says: no long-term contract, cancel after pilot — confirm):** _______________________________________________
- ✅ **Setup / onboarding fee (if any):** _______________________________________________

🛟 **Until confirmed, Iris says:** the illustrative ranges (always framed as illustrative) + "a consultant gives a firm quote for your setup." **Never invents a number outside the ranges in `40-pricing.md`.**

---

## 10. Product scope edges (what you *don't* do)
> Feeds `knowledge/00-overview.md` / relevant solutions file

**Visitors ask about things Iris might wrongly claim exist:** a module you haven't built, a sector you don't serve, a feature on the roadmap.

- ✅ **Features/modules Iris must NOT claim (not built / not offered):** _______________________________________________
- ✅ **Sectors you do NOT serve:** _______________________________________________
- ✅ **How Iris should handle a roadmap / "do you have X?" question for something unbuilt:** _______________________________________________

🛟 **Until confirmed, Iris says:** describes only capabilities the KB lists, in the KB's own terms, and offers a consultant for anything beyond them.

---

## Quick reference — things Iris must NEVER state unless added above
- A named integration / third-party system
- A specific customer, logo, testimonial, case study, or reference
- Any stat, percentage, ROI figure, or "X% improvement"
- An uptime number or SLA guarantee
- A certification or compliance standard (SOC 2, ISO, PCI, etc.)
- A product feature, module, or roadmap item not in the KB
- A country, language, or currency not listed
- Any price outside the illustrative ranges in `40-pricing.md`

Fill the blanks, hand this to the developer to fold into `knowledge/*.md`,
redeploy, and each confirmed fact permanently retires one class of hallucination.
