# Between Every Moment

A single-file, scroll-driven story page. Seven chapters (Prologue → The
question) scroll over a persistent WebGL background — an extruded heart, two
orbiting rings, a particle field, and falling petals — with the camera framing,
fog, and palette re-keyed per chapter.

## Running it

It is one self-contained `index.html` with no build step. Open it directly, or
serve the folder:

```sh
python3 -m http.server --directory site/between-every-moment 8000
# then open http://localhost:8000
```

## What it depends on

The page is static but not offline-capable — it pulls everything from CDNs at
runtime, so it needs network access to render as designed:

| Dependency | Host |
| --- | --- |
| Tailwind (JIT, browser build) | `cdn.tailwindcss.com` |
| three.js r160 | `cdn.jsdelivr.net` |
| Iconify web component | `code.iconify.design` |
| Cormorant Garamond, Manrope | `fonts.googleapis.com` / `fonts.gstatic.com` |
| Photos and the flower clip | `hoirqrkdgbmvpwutwuwj.supabase.co` |

If three.js fails to load, the inline script throws before it binds the modal,
chapter tracking, and audio handlers, and the page degrades to unstyled markup.
Vendoring the four scripts locally is the fix if that matters.

## Structure

- **Intro loader** — dissolves after ~2.2s.
- **Chapters** — each `<section data-scene data-theme>` drives the header label,
  the right-hand chapter dots, fog color, heart color, and the camera target in
  the `sceneCamera` table. The array is index-matched to the sections, so adding
  a section means adding a row.
- **Reveals** — `[data-reveal]` elements animate in once via IntersectionObserver;
  `[data-depth]` gets a parallax offset; `[data-tilt]` cards tilt on pointer move.
- **Interactions** — "Yes, let's begin" opens a focus-trapped modal (Escape and
  backdrop click close it); "Let's talk first" shows a toast for 5s; the
  Atmosphere button builds a three-oscillator drone through the Web Audio API on
  first click.

`prefers-reduced-motion: reduce` is honored throughout: the loader is removed,
reveals snap to their final state, parallax and petals stop, and smooth scrolling
is disabled.
