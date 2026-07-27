# Zentallio — Fashion Retail · Sector Solutions
### Developer handoff · v7.0

A single self-contained page. No build step, no framework, no dependencies.

```
Zentallio-Fashion-Sector-Solutions-v7.0.html   288 KB   the page
assets/                                         25 MB   9 banner clips + posters
SWAP-REAL-DATA.md                                       replacing illustrative data
optimise-assets.sh                                      halves asset weight
README-DEV.md                                           this file
```

## Deploying

Drop the HTML and `assets/` alongside each other on any static host. That is the
whole deployment. Fonts load from Google Fonts; everything else is local.

Serve `assets/*.mp4` with a long cache header — they never change between releases.

## Page structure

```
banner            full-bleed video, rotating headline, sector rail
#flagship         6 products, tabbed, one live stage
#solutions        sector solutions in 2 groups, tabbed, one live stage each
#demo             book-a-call
footer
```

Nine sectors × (6 products + 6–7 solutions) = **82 screens**, all rendered client-side
from data in the script. Switching sector re-renders everything below the banner.

## Things a developer needs to know

**Deep links** — `#sector=footwear` selects a sector on load and on `hashchange`.
`history.replaceState` is wrapped in `safeHash()` because it throws inside sandboxed
iframes (`about:srcdoc`). Do not unwrap it.

**Video loading is lazy** — only the sector shown on load fetches its clip.
The rest load on first selection. Nine clips at `preload="auto"` would pull ~25 MB
before anyone clicked.

**Animation** — all transform/opacity, composited. Solution widgets start and stop
via IntersectionObserver so off-screen ones cost nothing. `prefers-reduced-motion`
freezes the headline rotation and hides the banner video.

**Per-sector colour** — `--sx` is set from `SECTORS[i].ac` on selection and drives the
headline, CTA, active pill, tabs and the video wash. Magenta `#ff2d95` is reserved for
Iris and must not be used decoratively.

## Not wired to a backend

- **Book a call** (`#demoGo`) validates the email format and shows a confirmation.
  There is no endpoint. Point it at Formspree or your own handler.
- **Ask Iris anything…** in the POS screen is a visual element, not an input.
- Footer social links are placeholders.
- Menu links (`meet-iris.html`, `about.html`, etc.) assume sibling pages exist.

## Before launch

1. **Replace the illustrative data** — see `SWAP-REAL-DATA.md`. Tenant names live in
   one `BRAND` block; per-screen figures live in `DEEPSCREENS` and `NMM`.
2. **Ethnic banner is still 720p.** Every other clip is 1920×1080. At 720p the banner
   upscales 2.50× on a retina screen; at 1080p it is 1.67×.
3. **Run `./optimise-assets.sh`** once the ethnic clip lands. Assets drop from ~25 MB
   to roughly 11 MB with no visible difference at banner size. Originals are preserved
   in `assets-original/`.
4. **Canonical URL** — set it to wherever this actually serves from.
