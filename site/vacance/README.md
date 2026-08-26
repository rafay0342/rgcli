# Laiba

A single-page, scroll-driven proposal — from Rafay, for Laiba. All on-page copy
is Roman Urdu (`lang="ur-Latn"`); this README stays in English as developer
documentation.

Five movements, each pinned and scrubbed by scroll:

1. **Zindagi bhar tumhare saath** — a 193-frame film, with the opening line,
   four beats about where she already is in his day, and a closing passage
   layered over it.
2. **Ek din ki ginti** — a second 193-frame film under a counter that walks one
   day from a single first thought at 06:12 up to 340 at its highest and back
   down to one at 23:40.
3. **Gyarah chhoti clips** — a statement that an aperture opens over, revealing
   eleven clips she can step through.
4. **Kuch tasveerein** — eleven photographs surveyed sideways, ending full-bleed
   on a third 193-frame film.
5. **Ek sawaal, ek jawab** — a circle opening onto paper, the question, and the
   "Haan" button.

The folder is still named `vacance/` (and the deployed app is still
`vacance-5h490l`) after the file this was built from.

## Everything on the page is Laiba's own media

The stock beach footage the source shipped with is gone. Every frame, clip and
photograph now under `assets/laiba/` came from the eleven videos and eleven
photos that were handed over. Nothing is licensed stock, and nothing is generated.

All of it is 9:16 phone media, and the source was built for landscape plates, so
two things were reshaped to fit it — and these are the **only** deviations from
the original build:

- **The canvases letterbox.** `draw()` paints a blurred, dimmed, 20%-oversized
  cover copy of the frame to fill the plate, then draws the whole frame sharp
  inside it, with both vertical edges feathered into that backdrop. On a plate
  wider than 1.25:1 the sharp frame sits at 61.5% across rather than centred, so
  the left-aligned hero copy and the centred manifesto keep their own room and
  no line crosses her face. On phones the plate is already portrait, the frame
  fills it, and the backdrop is never seen.
- **The window clips letterbox the same way.** The three `<video>` elements are
  `object-contain` over a pre-blurred still of their own first frame
  (`vid/wN-bg.jpg`, 240x430, scaled to cover). The aperture's own geometry —
  `min(84vw, 1260px)` by `min(62vh, 700px)`, opening from `inset(34% 30%)` — is
  the original's, untouched.

Motion, timing, pinning, scrub rates and choreography are all unchanged. Two
counts follow from the media rather than the design, and neither costs
anything structurally.

Movement 3 steps through eleven clips where the source had four. It is a
prev/next stepper — `initShores()` cycles `scenes.length` and only the selected
clip plays — so the count is a `/ 11` label and nothing else; page length does
not move.

Movement 4 carries eleven photographs where the source had five. The drift
measures its own `track.scrollWidth` and refreshes on resize, so extra cards
only lengthen the horizontal run. The copy names no number in either place.

**The fourth clip has a second person in it.** Laiba is not alone in it — she is
laughing with someone. That person did not agree to appear anywhere, and this
page is headed for a public URL. Using it is a deliberate choice; dropping it is
one `<video>` element and four caption counts.

## Otherwise the page is the original build

Beyond the copy, the media wiring and the two letterbox changes above, nothing
about the layout, the motion, the cursor or the controls was touched, by
explicit instruction. Two overlaps are inherited from the source and are **not**
bugs introduced here:

- In movement 2 the heading and the counter are positioned independently, so
  they collide by 12px at 390px wide and 60-124px across desktop sizes.
- In the close, the heading shares a `clamp(2.6rem, 1rem + 5.8vw, 6.6rem)` scale
  with the other display lines but is the only one capped by a `46rem` parent,
  so above 1400px it breaks to four lines and pushes the "Haan" button down onto
  the footer credit.

The 602 vendored beach files from the earlier build are still checked in under
`assets/` (41MB) and are no longer referenced by anything. They can be deleted.

## Running it

`index.html` on its own, no build step. It still needs a network connection for
the libraries and fonts — see "What it loads". Serve the folder:

```sh
python3 -m http.server --directory site/vacance 8000
# then open http://localhost:8000
```

`?static` on the URL forces the reduced-motion path: Lenis is dropped so
scrolling is native, the ring cursor is hidden and the magnetic buttons are off.
The scrubbed sequences stay — they are bound to scroll position rather than
self-animating, and without them there is no page.

## What it loads

| Origin | What comes from it |
| --- | --- |
| `assets/laiba/` (local) | all three frame sequences, the eleven clips and their posters, the eleven drift photographs |
| `cdn.jsdelivr.net` | GSAP 3.13.0 + ScrollTrigger + SplitText, Lenis 1.1.14 |
| `cdn.tailwindcss.com` | Tailwind's in-browser JIT runtime |
| `fonts.googleapis.com` / `fonts.gstatic.com` | Archivo and IBM Plex Mono |

## Structure

- **Loader** — counts down to one name, then hands scroll control to Lenis and
  plays the hero reveal. It removes itself from the layout when done.
- **Frame sequences** — `sequence(canvas, fallback, dir, total)` preloads every
  frame into an array and draws one to a canvas per scroll tick. If frame 1
  fails to load, the canvas is hidden and the still `<img>` beside it is
  unhidden, so each movement degrades to a photograph rather than a blank. Those
  three stills are each sequence's own frame 193.
- **Pinning** — every movement is a `100svh` stage pinned by ScrollTrigger with
  `scrub: 1`. Movement 2 carries `margin-top: -100vh` so it begins exactly where
  movement 1 unpins.
- **The aperture** — `[data-portal]` animates its own `clip-path` from
  `inset(34% 30%)` to `inset(0%)`. The videos inside are `position: fixed` and
  full-viewport; the ancestor `clip-path` both clips them and gives them their
  containing block, so the effect is a window widening onto a still camera.
- **Chrome** — a 2px scroll rail replaces the hidden native scrollbar, and each
  `[data-bg]` section retints `document.body` as it becomes active.

## How the media was prepared

Eleven portrait videos and eleven portrait photos in, 623 files out. The first
three videos do double duty — each drives a scroll sequence as well as a clip;
the other eight are clips only.

```sh
# 193 frames per clip, matched to the clip's own length, cropped to 480x864
ffmpeg -i clip.mp4 -vf "fps=193/$DURATION,scale=480:864:force_original_aspect_ratio=increase,crop=480:864" \
       -q:v 4 assets/laiba/opening/f_%03d.jpg

# the same three clips as web video: h264, audio stripped, faststart
ffmpeg -i clip.mp4 -an -c:v libx264 -crf 26 -movflags +faststart assets/laiba/vid/w1.mp4

# the blurred backdrop each clip letterboxes over: poster -> 48x86 -> 240x430,
# gaussian blur 9, saturation 0.75, brightness 0.46
```

The eleven drift photographs are cover-cropped to 810x1440 with the crop biased
32% from the top, so a face near the top of a 9:16 frame is never cut. Any solid
black band the phone baked into a frame is trimmed before that crop — without
the trim, `s1` shipped with a 79px bar along its bottom edge.

Three of the fourteen photographs handed over are not used: one is the same
rooftop photograph as `s1` in a worse crop, and the other two are weaker frames
from shoots already represented.

Card order is by palette, not by filename — the two blue-green outfits (`s9`,
`s7`) sat next to each other on the first pass and read as one photograph shown
twice, so they are four cards apart now.

`styles.css` and `assets/fonts/` are left over from the earlier self-contained
build and are not loaded by `index.html`.

## Deployed

Live at <https://vacance-5h490l.v2.appdeploy.ai/> (AppDeploy app `vacance-5h490l`).
**The live copy is several versions behind this folder** — it still serves the
build with the stock beach media. Redeploying will publish Laiba's media to a
public URL.

Because AppDeploy caps a single upload at 200 binary parts, the 623 media files
have to ship as four merged deploys rather than one.

## Copy notes

The numbers are feeling, not telemetry: the day counter's 1 / 6 / 84 / 340 / 96
/ 1 arc is written to start and end on the same single thought. No real dates,
places or events are asserted anywhere. The drift captions describe only what is
visible in each photograph.

`mailto:rafay@example.com` in the close is a **placeholder** — swap it for
Rafay's real address (or a `wa.me` link) before the page is sent.
