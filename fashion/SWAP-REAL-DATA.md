# Going live: replacing the illustrative data

Every figure on this page is illustrative. Two things need replacing.

## 1 · Tenant identity — 1 edit, 9 rows

Open the page HTML and find `var BRAND={` near the top of the script.
It is the only place tenant names live. Change the nine rows:

```js
apparel: {tenant:'Lumière Mode', stores:'180 stores', market:'Europe', ccy:'€'},
```

This drives the scorecard title, the POS browser URL (`app.zentallio.com/lumiere-mode`),
the app chrome user slot and every screen header. Nothing else references them.

## 2 · Per-screen figures

Figures are authored per solution inside `DEEPSCREENS` and `NMM`, keyed
`'sector|Solution name'`. Each screen has four KPI tiles, a five-row table,
three to six bars and an Iris paragraph. Replace the numbers in place —
the structure does not need to change.

Search for the sector key to find its block, e.g. `DEEPSCREENS['footwear|`.

## Currency — one open question

Each sector is internally consistent, with one exception worth a decision:

| sector | currency used | counters / doors named |
|---|---|---|
| cosmetics | `£` | KaDeWe Berlin, Galeries Lafayette, El Corte Inglés |

If Éclat Beauty is a European business, switch `ccy` to `€` and replace `£` with `€`
inside the `DEEPSCREENS['cosmetics|` and `NMM.cosmetics` blocks. If it is a UK
business with European concessions, leave it.

Ethnic deliberately uses local formatting (`480k`) with no symbol.

## 3 · Banner clips still at 720p  (8 of 9 now done)

One of nine still needs a 1080p re-export. Target spec:

- **1920×1080**, H.264, no audio
- 6–10 seconds, loopable
- encode with: `ffmpeg -i SOURCE -an -c:v libx264 -crf 26 -preset slow -pix_fmt yuv420p -movflags +faststart assets/NAME-banner.mp4`

| clip | current | needs |
|---|---|---|
| ethnic | 1280×720 · 10s | 1920×1080 |
| *(all others already 1080p)* | | |

At 720p the banner upscales 2.50× on a retina screen and 3.52× on a phone.
At 1080p that drops to 1.67× and 2.34×.
