# Between Every Moment

All on-page copy is Hinglish written in Roman script (`lang="hi-Latn"`); this
README stays in English as developer documentation.

A single-file, scroll-driven story page. Seven chapters (Aagaaz → Sawaal)
scroll over a persistent WebGL background — an extruded heart, two orbiting
rings, a particle field, and falling petals — with the camera framing, fog, and
palette re-keyed per chapter. Five of the seven chapters close on a couplet by
Mirza Ghalib, set in Nastaliq.

## Running it

`index.html` plus the `assets/` folder, no build step and no network. Open it
directly, or serve the folder:

```sh
python3 -m http.server --directory site/between-every-moment 8000
# then open http://localhost:8000
```

## Self-contained by design

The page makes **zero external requests**. Everything it needs is in `assets/`:

| Asset | What it is |
| --- | --- |
| `styles.css` | `@font-face` rules + Tailwind compiled down to only the classes this page uses |
| `three.js` | three.js r160, tree-shaken to the 26 classes the scene touches |
| `fonts/*.woff2` | Cormorant Garamond 400/500 (roman + italic), Manrope 400/500 — latin subset |
| `fonts/noto-nastaliq-urdu-400.woff2` | Noto Nastaliq Urdu, subset to the glyphs the couplets use |
| `*-{w}.avif` / `*-{w}.webp` | Each photo at two widths, picked by `srcset`/`sizes` |
| `memory-flowers.mp4` | The flower clip, `preload="none"` so it costs nothing until scrolled to |

Icons are inline `<svg>` (Solar, via Iconify) rather than a web component that
fetches each glyph from an API at runtime.

## Structure

- **Intro loader** — dissolves after ~2.2s and removes itself from the DOM.
- **Chapters** — each `<section data-scene data-theme>` drives the header label,
  the right-hand chapter dots, fog color, heart color, and the camera target in
  the `sceneCamera` table. The array is index-matched to the sections, so adding
  a section means adding a row. `setActiveScene` also compares the header label
  against a hard-coded first-chapter name, so renaming chapter one means updating
  that literal too.
- **Reveals** — `[data-reveal]` elements animate in once via IntersectionObserver;
  `[data-depth]` gets a parallax offset; `[data-tilt]` cards tilt on pointer move.
- **Interactions** — "Haan, shuru karte hain" opens a focus-trapped modal (Escape
  and backdrop click close it); "Pehle baat karte hain" shows a toast for 5s; the
  Mahaul button builds a three-oscillator drone through the Web Audio API on
  first click.

`prefers-reduced-motion: reduce` is honored throughout: the loader is removed,
reveals snap to their final state, parallax and petals stop, and smooth scrolling
is disabled.

### The couplets

Five chapters close on a sher by Mirza Ghalib (1797-1869, public domain), each
chosen to answer that chapter's own line:

| Chapter | Opening words |
| --- | --- |
| Aamad | dil se teri nigaah jigar tak utar gayi |
| Kashish | ishq par zor nahin hai ye wo aatish 'Ghalib' |
| Yaadein | muddat hui hai yaar ko mehmaan kiye hue |
| Imkaan | aah ko chahiye ik umr asar hote tak |
| Sawaal | hazaaron khwahishen aisi ki har khwahish pe dam nikle |

Every line was checked against rekhta.org's Urdu-script pages rather than typed
from memory - the Imkaan couplet in particular carries the diwan radif
`hote tak`, not the `hone tak` of the popular sung version.

Each block is `lang="ur" dir="rtl"`, with a Roman transliteration underneath so
the page stays readable for anyone who does not read Nastaliq. A misra must
never wrap - a couplet broken mid-line reads as a mistake - so the Urdu is sized
with `clamp(15px, calc(6.2vw - 2.8px), 30px)`, derived from the widest line's
measured width against the space the block actually gets. Verified unbroken from
320px to 1920px. Note that Tailwind's `text-*` utilities also set a line-height,
so the size is written as `text-[length:...]` and paired with an explicit
`leading-[2.4]`; Nastaliq needs roughly that much leading to breathe.

### The 3D layer is optional

`assets/three.js` is loaded with `defer`, and the scene is built inside a guarded
`buildScene()` that runs at `DOMContentLoaded`. If the script fails to load, WebGL
is unavailable, or scene construction throws, the failure is caught and logged —
chapter tracking, reveals, the modal, the toast and the audio toggle all keep
working. Nothing outside `buildScene()` touches `THREE`.

## Regenerating the vendored assets

Nothing here is generated at page load, so the derived assets are checked in. To
rebuild them (from a scratch directory with `sharp`, `tailwindcss@3` and
`esbuild` installed):

```sh
# styles.css — Tailwind scans index.html; safelist covers the JS-toggled classes
npx tailwindcss -i tailwind.css -o styles.css --minify \
  --content index.html   # safelist: flex, hidden, bg-white/70, bg-white/20
# then prepend the @font-face block (urls relative to assets/)

# three.js — an entry that imports only the classes used and assigns a *plain*
# object to window.THREE; a module namespace object is frozen and the page
# reassigns THREE.ExtrudeGeometry to swap in the refined heart shape
npx esbuild three-entry.mjs --bundle --minify --format=iife --target=es2019

# photos — widths come from the measured max CSS width and its 2x retina cap
sharp(src).resize(w, null, { kernel: 'lanczos3' }).removeAlpha()
  .avif({ quality: 75, effort: 6 })   // and .webp({ quality: 88, effort: 6 })
```

Fonts are the `latin` subset `@font-face` blocks from the Google Fonts CSS for
the six family/weight/style pairs the page actually renders, with the woff2
files downloaded alongside. The latin range covers every character used here
(the only non-ASCII ones are `·`, `—`, `“` and `”`).

Noto Nastaliq Urdu is subset to the couplets' own text. Nastaliq shaping leans
heavily on contextual substitution, so the subsetter has to keep the layout
tables and their glyph closure:

```sh
python3 -m fontTools.subset NotoNastaliqUrdu-arabic.woff2 \
  --text-file=couplets.txt --layout-features='*' --flavor=woff2
```

That is 159KB down to 86KB, and the result renders pixel-identically to the full
face — worth re-checking with a screenshot diff if the couplets ever change.
