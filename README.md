# Telemetry Monolith

A mission-control display that visualizes its own real execution. Every particle on screen is a real browser event.

**Live:** https://rashedulislamnissan.github.io/telemetry-monolith/

![Demo GIF placeholder](./docs/demo.gif)
<!-- PLACEHOLDER: record a short GIF of the page and save it as docs/demo.gif -->

## How it works
The page draws a full-screen instrument with Canvas 2D, and every labelled value on it comes from the page's own execution. One event bus collects:
- frame timing from `requestAnimationFrame`
- long tasks, paints, Largest Contentful Paint, layout shifts, resource loads and interaction latency from `PerformanceObserver`
- the JS heap from `performance.memory`, where the browser exposes it
- a once-a-second same-origin ping
- cursor velocity, acceleration and jerk
- DOM mutations

Each event becomes a particle that carries its own label and raw data along a conduit into its channel's ring. Moving the cursor bends the conduits and drives a procedural Web Audio hum. If a browser does not expose an API, that ring is dimmed and reads N/A; nothing is simulated. Decorative motion (ring rotation, grid, the scrolling type) never carries a data label. When frames run slow, the page lowers its render scale and particle count instead of stuttering.

No libraries, no build step and no requests beyond the page's own files and the ping.

## Controls
- **Move, scroll, tap or click:** the machine surges.
- **Hover or tap a particle:** freeze it and read its raw event data. Move away, tap elsewhere or press Esc to let it go.
- **M** or the **Sound** button: mute or unmute the hum. Sound starts only after your first click, tap or key press.

## Run locally
ES modules do not load from `file://`, so serve the folder:

```
python -m http.server 8000
```

Then open http://localhost:8000. Add `?debug` to the URL to see each signal's support status and the live event log.

## Credits
Built by [Rashedul Islam Nissan](https://nissan-portfolio.pages.dev/). Owner details live in [`config.js`](./config.js).
