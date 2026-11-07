# Telemetry Monolith

**Live:** _[link goes here after deploy to GitHub Pages]_

![Demo GIF placeholder](./docs/demo.gif)
<!-- PLACEHOLDER: record a short GIF of the page and save it as docs/demo.gif -->

## How it works
A full-screen mission-control display drawn with Canvas 2D. It looks like a motion-graphics loop, but every value with a label comes from the page's own execution: frame timing from `requestAnimationFrame`, long tasks, paints and layout shifts from `PerformanceObserver`, resource loads, JS heap (where the browser exposes it), a same-origin ping, pointer kinematics and DOM mutations. Each ring around the core is one of those channels. If a browser does not expose an API, its ring says so instead of faking a value. Decorative motion (ring rotation, grid, scrolling type) never carries a data label. No libraries, no build step, no external requests.

## Controls
- **Move, scroll, tap or click:** the machine surges *(milestone M4)*
- **Hover or tap a particle:** freeze it and read its raw event *(milestone M6)*
- **M:** mute or unmute the hum *(milestone M5)*

## Run locally
ES modules do not load from `file://`, so serve the folder:

```
python -m http.server 8000
```

Then open http://localhost:8000.

## Personal details
Name, role and links are placeholders in [`config.js`](./config.js).
