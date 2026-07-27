# Zentallio — F&B site package

Static. No build step, no dependencies. Upload the folder contents to
the web root and it runs.

## Files

| File | URL |
|---|---|
| `food-beverage.html` | https://zentallio.com/food-beverage.html |
| `food-beverage-solutions.html` | https://zentallio.com/food-beverage-solutions.html |
| `careers.html` | https://zentallio.com/careers.html |
| `og-image.png` | social share card, 1200x630 |
| `app/` | six workbenches, fetched on demand |
| `media/` | ten sector videos + posters |

`index.html` is deliberately NOT included — your home page is untouched.
The one block to add to it is in `HOME-PAGE-CTA-snippet.html`.

## What changed

**index.html** — no change. CTA supplied as a snippet.

**food-beverage.html**
- The ten sectors under *"Every sector you run, down to the format"*
  now navigate on click, straight to that sector on the solutions page.
- A **See It Live** CTA sits beneath the sector explorer.
- Nothing else touched.

**food-beverage-solutions.html** — new page.
- 149 solution demos across 10 sectors, plus six live workbenches
  (Balanced Scorecard, POS, Numerus, Nexus, Motus, Manus).
- Menu: Home / Food & Beverage / Solutions, plus all ten sectors.
- Footer matches the marketing site.

## Sector ids

`qsr casual fine cafe dessert beverage health cloud b2b niche`

Deep links work on load and on hash change:
`food-beverage-solutions.html#sector=cloud` opens on Cloud Kitchen.

## Serving

- **Must be served over HTTP(S).** The solutions page fetches `app/*.html`
  by XHR, which browsers block on `file://`.
- Cache `media/*` and `app/*` immutable for a year; HTML short or no-cache.
- Videos are `preload="metadata"` — only the active sector downloads.

## Performance

| | |
|---|---|
| food-beverage-solutions.html | 0.92 MB |
| DOMContentLoaded | ~820 ms |

## Outstanding before go-live

1. **Forms have no backend** — contact and careers are `mailto:` only.
2. **Footer social icons** on the solutions page still point at `#`.
   Real URLs are known and should be wired:
   linkedin.com/company/zentallioai/ , x.com/Zentallio ,
   instagram.com/zentallio/ , facebook.com/profile.php?id=61589720611365 ,
   threads.com/@zentallio
3. **Pages linked but not built:** privacy, cookies, terms, data-processing,
   about, contact, meet-iris, fashion.
4. **Logo animation** — the animated wordmark used on about.html has NOT
   been replicated here. The source was not available. Apply the same
   markup/CSS to `.zh-brand` on both pages.
5. **All figures are illustrative.** Maison Croq, Donna's Bakery and the
   200-branch estate are worked examples, not client data. Replace with
   pilot data or keep the LIVE - ILLUSTRATIVE DATA badge visible.
6. **og:image** is absolute to zentallio.com/og-image.png — replace the
   placeholder card with the real one if you have it.
