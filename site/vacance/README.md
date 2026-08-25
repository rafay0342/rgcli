# Laiba

A single-page, scroll-driven proposal — from Rafay, for Laiba. All on-page copy
is Roman Urdu (`lang="ur-Latn"`); this README stays in English as developer
documentation.

Five movements, each pinned and scrubbed by scroll:

1. **Zindagi bhar tumhare saath** — a 193-frame aerial film over an emptying
   sandbar, with the opening line, four beats about where she already is in his
   day, and a closing passage layered over it.
2. **Ek din ki ginti** — a second 193-frame film of the tide falling, under a
   counter that walks one day from a single first thought at 06:12 up to 340 at
   its highest and back down to one at 23:40.
3. **Kahan le chaloon** — a statement that an aperture opens over, revealing
   four shore clips she can step through.
4. **Kahin bhi, bas saath** — five shores surveyed sideways, ending full-bleed
   on a third 193-frame film.
5. **Ek sawaal, ek jawab** — a circle opening onto paper, the question, and the
   "Haan" button.

The folder is still named `vacance/` (and the deployed app is still
`vacance-5h490l`) because only the copy is ours — the markup, styles and
choreography are exactly the file that was handed over.

## The page is the original build, unmodified

Only text nodes, the six caption `data-crowd`/`data-time` pairs and the loader's
count target differ from the source that was shared. Nothing about the layout,
the motion, the cursor, the controls or the asset wiring was touched, by
explicit instruction. Two consequences are inherited from that source and are
**not** bugs introduced here:

- **The three scroll films do not load.** `sequence()` builds its URLs as
  `open/0001.jpg`, `night/0001.jpg` and `film/0001.jpg` against
  `cdn.jsdelivr.net/gh/Sam1983Aing/aura-assets@1.0.0/vacance/`, where the real
  directories are `opening/`, `tide/` and `unwind/` with an `f_001.jpg` pattern
  and 193 frames each. All three probes 404, so each canvas hides itself and
  the still `<img>` beside it is shown instead. The page reads as three
  photographs rather than three scrubbed films.
- **Two headings overlap their neighbours.** In movement 2 the heading and the
  counter are positioned independently, so they collide by 12px at 390px wide
  and 60-124px across desktop sizes. In the close, the heading shares a
  `clamp(2.6rem, 1rem + 5.8vw, 6.6rem)` scale with the other display lines but
  is the only one capped by a `46rem` parent, so above 1400px it breaks to four
  lines and pushes the button onto the footer credit.

`assets/` is still checked in — 602 vendored frames, clips, stills, fonts and
libraries — but `index.html` does not reference it any more. It is kept so the
self-contained path is one edit away rather than one 41MB download away.

## Running it

`index.html` on its own, no build step. It needs a network connection — see
"What it loads" below. Open it directly, or serve the folder:

```sh
python3 -m http.server --directory site/vacance 8000
# then open http://localhost:8000
```

`?static` on the URL forces the reduced-motion path (see below).

## What it loads

The page fetches from five external origins, exactly as the source did:

| Origin | What comes from it |
| --- | --- |
| `cdn.jsdelivr.net` | GSAP 3.13.0 + ScrollTrigger + SplitText, Lenis 1.1.14, the four shore clips, and the (404ing) frame sequences |
| `cdn.tailwindcss.com` | Tailwind's in-browser JIT runtime |
| `fonts.googleapis.com` / `fonts.gstatic.com` | Archivo and IBM Plex Mono |
| `hoirqrkdgbmvpwutwuwj.supabase.co` | the three fallback stills and the five drift photos |

## Structure

- **Loader** — counts 340 people down to 0, then hands scroll control to Lenis
  and plays the hero reveal. It removes itself from the layout when done.
- **Frame sequences** — `sequence(canvas, fallback, dir, total)` preloads every
  frame into an array and draws one to a canvas per scroll tick, cover-fitted.
  If frame 1 fails to load, the canvas is hidden and the still `<img>` beside it
  is unhidden, so each movement degrades to a photograph rather than a blank.
  The three are constructed in document order, which is also the order the
  browser will service them — the opening's frames are queued first.
- **Pinning** — every movement is a `100svh` stage pinned by ScrollTrigger with
  `scrub: 1`. Movement 2 carries `margin-top: -100vh` so it begins exactly where
  movement 1 unpins.
- **The aperture** — `[data-portal]` animates its own `clip-path` from
  `inset(34% 30%)` to `inset(0%)`. The videos inside are `position: fixed` and
  full-viewport; the ancestor `clip-path` both clips them and gives them their
  containing block, so the effect is a window widening onto a still camera.
- **Shore clips** — only the selected clip plays, and only while the window
  section is on screen (`initShores()` returns a `setLive` that `initWindow`
  drives from its ScrollTrigger callbacks).
- **Chrome** — a 2px scroll rail replaces the hidden native scrollbar, and each
  `[data-bg]` section retints `document.body` as it becomes active.
- **"Find my window"** — the close panel is clipped to `circle(0%)` until the
  drift timeline has run, so a plain `#book` jump lands mid-pin on a blank
  screen. `initBookLinks()` sends those links to the end of the document
  instead, where that timeline is complete and the panel is open.

### Motion and input preferences

`prefers-reduced-motion: reduce` (or `?static`) drops Lenis so scrolling is
native, hides the ring cursor and disables the magnetic buttons. The scrubbed
sequences themselves stay — they are bound to scroll position rather than
self-animating, and without them there is no page. Anyone who needs a fully
still read should use the no-JS path below.

The ring cursor only hides the native pointer once it has actually been put on
screen: `body.has-ring-cursor` is added from JS, so a failed script or a coarse
pointer leaves the normal cursor alone.

### Without JavaScript

A `<noscript>` block flattens the page into a plain vertical read: the loader is
hidden, the canvases are swapped for their stills, everything scroll-revealed is
already revealed, the window section becomes a stacked block, and the sideways
drift is dropped in favour of the close. Nothing animates, but every line of
copy and the CTA are reachable.

## Regenerating the vendored assets

The films, clips and stills come from
[`Sam1983Aing/aura-assets@1.0.0`](https://github.com/Sam1983Aing/aura-assets)
under `vacance/`, copied verbatim:

```sh
BASE=https://cdn.jsdelivr.net/gh/Sam1983Aing/aura-assets@1.0.0/vacance
for d in opening tide unwind; do
  for i in $(seq -w 1 193); do curl -sSfLo "assets/$d/f_$i.jpg" "$BASE/$d/f_$i.jpg"; done
done
for i in 1 2 3 4; do curl -sSfLo "assets/vid/w$i.mp4" "$BASE/vid/w$i.mp4"; done
```

Upstream also ships `shores/s6.jpg`; it duplicates the first frame of `unwind/`,
so the page uses `unwind/f_193.jpg` as that movement's still and s6 is not
vendored.

`styles.css` is `@font-face` blocks followed by Tailwind's preflight and only
the utilities `index.html` uses. Regenerate it after editing the markup:

```sh
npx tailwindcss@3.4.19 -i tailwind.css -o out.css --minify --content index.html
# tailwind.css is just @tailwind base; @tailwind components; @tailwind utilities;
# then re-prepend the @font-face block (urls relative to assets/)
```

Fonts are subset from the upstream Google Fonts sources to the glyphs the page
renders. Archivo has to stay variable: the page sets `font-stretch` to 112%,
118% and 125%, which needs the `wdth` axis, and a static instance would collapse
all three to one width.

```sh
# charset: printable ASCII plus © ° · æ Æ – — ‘ ’ “ ” … →
python3 -m fontTools.subset "Archivo[wdth,wght].ttf" \
  --text-file=charset.txt --layout-features='*' --flavor=woff2 \
  --output-file=assets/fonts/archivo-variable.woff2
```

Note the `→` in "window 06:12 → 07:50": U+2192 sits outside Google Fonts' `latin`
subset, so serving these faces from the CDN would drop that one glyph to a
system fallback. Subsetting locally is what keeps the arrow in IBM Plex Mono.

## Deployed

Live at <https://vacance-5h490l.v2.appdeploy.ai/> (AppDeploy app `vacance-5h490l`).
**The live copy is one version behind this folder** until the next deploy.

The deploy tree wraps this folder in the `html-static` template. Since
`index.html` now loads everything from external origins, the deploy is just that
one file; the `assets/` copy in the AppDeploy snapshot is left in place, unused.

If the vendored, self-contained wiring is ever wanted back, the shape is
recorded in git (see the first three commits touching this folder): `assets/`
moves under the Vite `publicDir`, `assetsDir` moves to `_vite/` so it cannot
collide, and — because AppDeploy caps a single upload at 200 binary parts — the
602 files ship as four merged deploys rather than one.

## Copy notes

The numbers are feeling, not telemetry: the loader counts 340 names down to one,
and the day counter's 1 / 6 / 84 / 340 / 96 / 1 arc is written to start and end
on the same single thought. No real dates, places or events are asserted
anywhere, so nothing in the copy can be wrong about them.

`mailto:rafay@example.com` in the close is a **placeholder** — swap it for
Rafay's real address (or a `wa.me` link) before the page is sent.

## Provenance

The four shore clips are credited in the footer to Benlisquare / Wikimedia
Commons (CC BY-SA 4.0); the rest of the film and stills were generated for this
build.
