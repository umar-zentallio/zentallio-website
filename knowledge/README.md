# Iris knowledge base

These markdown files are the **single source of truth** for what the Iris
assistant knows. `lib/iris-knowledge.js` loads every `*.md` here (sorted by
filename), strips owner-only `<!-- GAP … -->` notes, and injects the result
into Iris's system prompt in `api/chat.js`.

To change what Iris says, **edit these files** — no code change needed
(restart `zentallio-api` to pick up edits).

| File | Content |
|---|---|
| `00-overview.md` | Company positioning, what Iris is, how she should behave |
| `10-sectors.md` | Sectors served (auto-mined from the site) |
| `20-solutions-food-beverage.md` | The 20 F&B solutions (auto-mined) |
| `30-solutions-fashion.md` | Fashion flagship + core POS + per-sector (auto-mined) |
| `40-pricing.md` | Pricing policy — model only, no numbers (awaiting pricing doc) |
| `50-implementation-buying-support.md` | Implementation / buying / after-sales (has gaps) |
| `60-company-faq.md` | Company facts + common Q&A (has gaps) |

**Grounding:** Iris is instructed to answer only from this base and never invent
facts, prices, or timelines. So the quality of her answers = the quality of
these files. Search for `GAP` to see what still needs filling.
