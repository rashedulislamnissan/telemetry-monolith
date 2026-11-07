# Progress

## Status
- **Done:** M1, look and skeleton
- **Next:** M2, real signal bus

## M1: look and skeleton (done)
- Full-screen canvas with a fixed-timestep loop (1/120 s step, accumulator, 0.25 s clamp), resize handling, DPR capped at 2, DPR-change watcher, pause on hidden tab.
- Layers: pre-rendered grid (phased through the core, rulers, corner brackets), procedural kinetic type, 8 channel rings, hexagonal core, channel label spine, top-left identity and session clock.
- Already live (real data): the **FRAME** ring is a radial histogram of the last 240 rAF deltas, and its label shows the smoothed frame time. The **SESSION** clock is `performance.now()`.
- Every other channel shows an em dash until M2 wires a real source to it.

### Checks run (Playwright, headless Chromium)
- 1440x900, 1280x720 @2x, 390x844 @3x, 844x390 @3x, live resize to 1024x700, 1920x1080 and 800x1000, reduced motion.
- Canvas backing size always equals viewport x min(DPR, 2): 390x844 @3x gives 780x1688.
- Frame deltas over 3 s: mean 16.67 ms, p95 16.7 ms, max 16.8 ms, at both desktop and mobile sizes.
- Zero console errors or warnings.

## Design decisions
- **Palette:** Void `#000000`, Graphite `#1F1D1B`, Ash `#7E776F`, Bone `#ECE5D8`, Sodium `#FF9E1B`, Fault `#FF2B3A`. Sodium is used **only for live data** and Fault **only for faults** (dropped frames now; long tasks and errors later), so colour itself says what is real.
- **Display type** is a 6x10 block-cell face drawn in code (`js/render/type.js`), with columns merged and scanline gaps between rows. That gives the same heavy condensed look on every OS with no font download. Labels use the system monospace stack.
- **Layout:** on wide screens the core sits at 58% of the width so the type owns the left field. Below 760 px the type becomes a top band and the ring system centres in the space beneath.
- **Labels** sit on each ring at 12 o'clock and knock out the line under them, forming one vertical spine. The core is the HEAP channel. Ring order, inner to outer: interaction, frame, longtask, paint/LCP/CLS, DOM mutation, pointer/wheel, ping, resource.
- **Kinetic type words** are about the machine (TELEMETRY, RUNTIME, OBSERVER, SELF). No personal info appears outside `config.js`.
- **FRAME readout** is an exponential moving average (alpha 0.08) of real rAF deltas, refreshed 5 times a second so it is readable.
- **Reduced motion:** decorative rotation and scroll run at 25% speed, and the type shimmer is off.

## Known issues
- Headless frame timing is idealised. The 60 fps check still needs a look in a real Chrome window on a mid-range laptop.
- The spec's N/A text ("N/A: NOT EXPOSED BY THIS BROWSER") is long for the centred label spine on narrow screens. Decide how to show it in M2.
- Dev note: Playwright's Chromium needs `--no-proxy-server` in this environment to reach the local server.

## Next steps (M2)
- `js/signals/bus.js` plus one module per source in the signal map, each emitting `{type, label, value, t, raw}`.
- Feature-detect each API (`PerformanceObserver.supportedEntryTypes`, `performance.memory`, `navigator.connection`, etc.) and report "unsupported" honestly.
- A debug log (behind a query flag) showing live events per source.
- Add `ping.txt`.
